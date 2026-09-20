# Tests for tools/docx_to_pdf.py. Run: python -m pytest tools -q
import subprocess
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import docx_to_pdf  # noqa: E402


def needs_libreoffice():
    exe = docx_to_pdf.find_soffice()
    if exe is None:
        pytest.skip('LibreOffice is not installed')
    return exe


def make_docx(path):
    """A small fixture DOCX with a known word. Pandoc first (it is already a
    test dependency), python-docx as a fallback; skip when neither exists."""
    md = path.parent / 'in.md'
    md.write_text('Hello from the fixture.\n', encoding='utf-8')
    import docx_to_html
    pandoc = docx_to_html.find_pandoc()
    if pandoc is not None:
        subprocess.run(
            [pandoc, str(md), '-f', 'markdown', '-t', 'docx', '-o', str(path)],
            check=True,
        )
        return path
    docx = pytest.importorskip('docx')
    doc = docx.Document()
    doc.add_paragraph('Hello from the fixture.')
    doc.save(str(path))
    return path


def test_soffice_env_wins(monkeypatch, tmp_path):
    fake = tmp_path / 'soffice.exe'
    fake.write_bytes(b'x')
    monkeypatch.setenv('SOFFICE', str(fake))
    assert docx_to_pdf.find_soffice() == str(fake)


def test_soffice_missing_returns_none(monkeypatch):
    monkeypatch.setenv('SOFFICE', str(Path('C:/nonexistent-soffice-xyz/soffice.exe')))
    monkeypatch.setenv('PATH', '')
    # The fixed install paths do not exist on this machine's PATH now; the
    # result is None unless LibreOffice is installed at a fixed path. Either
    # way the function must not run anything.
    found = docx_to_pdf.find_soffice()
    assert found is None or Path(found).is_file()


def test_missing_libreoffice_exits_1_with_install_line(monkeypatch, tmp_path, capsys):
    src = tmp_path / 'in.docx'
    src.write_bytes(b'x')
    monkeypatch.setenv('SOFFICE', str(tmp_path / 'no-such-soffice.exe'))
    monkeypatch.setenv('PATH', '')
    # When LibreOffice really is installed at a fixed path this test cannot
    # force "missing": skip instead of asserting the wrong thing.
    if docx_to_pdf.find_soffice() is not None:
        pytest.skip('LibreOffice is installed at a fixed path')
    code = docx_to_pdf.main([str(src), '-o', str(tmp_path / 'out.pdf')])
    assert code == 1
    assert 'winget install --id TheDocumentFoundation.LibreOffice' in capsys.readouterr().err


def test_missing_source_is_an_error(tmp_path, capsys):
    code = docx_to_pdf.main([str(tmp_path / 'nope.docx'), '-o', str(tmp_path / 'out.pdf')])
    assert code == 1
    assert 'does not exist' in capsys.readouterr().err


def test_timeout_is_reported_not_a_crash(monkeypatch, tmp_path, capsys):
    def boom(*args, **kwargs):
        raise subprocess.TimeoutExpired(cmd=args[0], timeout=60)

    monkeypatch.setattr(subprocess, 'run', boom)
    monkeypatch.setattr(docx_to_pdf, 'find_soffice', lambda: 'soffice')
    src = tmp_path / 'in.docx'
    src.write_bytes(b'x')
    code = docx_to_pdf.main([str(src), '-o', str(tmp_path / 'out.pdf')])
    assert code == 1
    err = capsys.readouterr().err
    assert 'timed out' in err and 'in.docx' in err


def test_never_asks_the_version(monkeypatch, tmp_path):
    src = tmp_path / 'in.docx'
    src.write_bytes(b'x')
    captured = {}

    def record(cmd, **kwargs):
        captured['cmd'] = cmd
        # Pretend LibreOffice wrote the converted file next to --outdir.
        idx = cmd.index('--outdir')
        (Path(cmd[idx + 1]) / 'in.pdf').write_bytes(b'%PDF-1.4\n%%EOF\n')
        return subprocess.CompletedProcess(cmd, 0, '', '')

    monkeypatch.setattr(subprocess, 'run', record)
    monkeypatch.setattr(docx_to_pdf, 'find_soffice', lambda: 'soffice')
    out = tmp_path / 'out.pdf'
    docx_to_pdf.convert(src, out)
    assert out.is_file()
    assert '--version' not in captured['cmd']
    # A private profile, so an open LibreOffice window cannot block the run.
    assert any(str(a).startswith('-env:UserInstallation=file:///') for a in captured['cmd'])
    assert '--headless' in captured['cmd'] and '--norestore' in captured['cmd']


def test_converts_a_small_docx(tmp_path):
    needs_libreoffice()
    src = make_docx(tmp_path / 'in.docx')
    out = tmp_path / 'out.pdf'
    start = time.monotonic()
    assert docx_to_pdf.main([str(src), '-o', str(out)]) == 0
    assert time.monotonic() - start < 60
    import pymupdf
    doc = pymupdf.open(str(out))
    assert doc.page_count == 1
    assert 'Hello' in doc[0].get_text()


def test_two_runs_give_the_same_cleaned_bytes(tmp_path):
    # The proof the fixed /ID landed: asserted on the cleaned, committed file,
    # not on the git-ignored LibreOffice output (which always differs).
    needs_libreoffice()
    import clean_pdf

    src = make_docx(tmp_path / 'in.docx')
    outs = []
    for i in ('a', 'b'):
        gen = tmp_path / f'gen-{i}.pdf'
        assert docx_to_pdf.main([str(src), '-o', str(gen)]) == 0
        final = tmp_path / f'clean-{i}.pdf'
        assert clean_pdf.main([str(gen), str(final)]) == 0
        outs.append(final.read_bytes())
    assert outs[0] == outs[1]
