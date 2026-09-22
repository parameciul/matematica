# Tests for tools/pdf_replace_span.py. Run: python -m pytest tools -q
import sys
from pathlib import Path

import pymupdf
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pdf_replace_span  # noqa: E402


def make_pdf(path, lines):
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    for i, line in enumerate(lines):
        page.insert_text((72, 72 + 20 * i), line, fontname='helv', fontsize=12)
    doc.save(str(path))
    return path


def text_of(path):
    return "\n".join(page.get_text() for page in pymupdf.open(str(path)))


def test_parse_replacement_splits_on_the_separator():
    assert pdf_replace_span.parse_replacement('a=>b') == ('a', 'b')
    # Only the first separator counts, so NEW may contain one.
    assert pdf_replace_span.parse_replacement('a=>b=>c') == ('a', 'b=>c')


@pytest.mark.parametrize('bad', ['no separator', '=>only new'])
def test_parse_replacement_rejects_a_malformed_pair(bad):
    with pytest.raises(Exception):
        pdf_replace_span.parse_replacement(bad)


def test_replaces_the_span_and_leaves_the_others_alone(tmp_path):
    pdf = make_pdf(tmp_path / 'in.pdf', ['R+ = [0, +inf)', 'keep this line'])
    assert pdf_replace_span.main([str(pdf), 'R+ = [0, +inf)=>R+ = (0, +inf)']) == 0
    text = text_of(pdf)
    assert 'R+ = (0, +inf)' in text
    assert '[0, +inf)' not in text
    assert 'keep this line' in text


def test_a_pattern_that_matches_nothing_writes_nothing(tmp_path):
    pdf = make_pdf(tmp_path / 'in.pdf', ['R+ = [0, +inf)'])
    before = pdf.read_bytes()
    assert pdf_replace_span.main([str(pdf), 'not here=>something']) == 1
    assert pdf.read_bytes() == before


def test_one_missing_pattern_stops_the_whole_run(tmp_path):
    pdf = make_pdf(tmp_path / 'in.pdf', ['first line', 'second line'])
    before = pdf.read_bytes()
    assert pdf_replace_span.main([str(pdf), 'first line=>changed', 'absent=>x']) == 1
    assert pdf.read_bytes() == before


def test_dry_run_reports_but_does_not_write(tmp_path, capsys):
    pdf = make_pdf(tmp_path / 'in.pdf', ['first line'])
    before = pdf.read_bytes()
    assert pdf_replace_span.main([str(pdf), 'first line=>changed', '--dry-run']) == 0
    assert pdf.read_bytes() == before
    assert 'changed' in capsys.readouterr().out


def test_a_replacement_that_introduces_a_class_code_is_reported(tmp_path):
    pdf = make_pdf(tmp_path / 'in.pdf', ['harmless line'])
    assert pdf_replace_span.main([str(pdf), 'harmless line=>clasa 9R2']) == 2


def test_render_writes_an_image_of_each_changed_page(tmp_path):
    pdf = make_pdf(tmp_path / 'in.pdf', ['first line'])
    out = tmp_path / 'render'
    assert pdf_replace_span.main([str(pdf), 'first line=>changed', '--render', str(out)]) == 0
    assert (out / 'page-1.png').exists()


def test_list_prints_the_spans_and_changes_nothing(tmp_path, capsys):
    pdf = make_pdf(tmp_path / 'in.pdf', ['first line', 'second line'])
    before = pdf.read_bytes()
    assert pdf_replace_span.main([str(pdf), '--list']) == 0
    out = capsys.readouterr().out
    assert 'first line' in out and 'second line' in out
    assert pdf.read_bytes() == before
