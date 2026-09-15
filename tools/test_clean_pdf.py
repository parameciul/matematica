# Tests for tools/clean_pdf.py. Run: python -m pytest tools -q
import sys
from pathlib import Path

import pymupdf
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clean_pdf  # noqa: E402


def make_pdf(path, pages, author='Someone'):
    doc = pymupdf.open()
    for lines in pages:
        page = doc.new_page(width=595, height=842)
        # Lines 12pt apart, like real worksheets: a removal must not touch the lines above and below.
        for i, line in enumerate(lines):
            page.insert_text((72, 72 + 12 * i), line, fontname='helv', fontsize=11)
    doc.set_metadata({'author': author, 'title': 'Draft'})
    doc.save(str(path))
    return path


def page_texts(path):
    return [page.get_text() for page in pymupdf.open(str(path))]


def test_deletes_pages_and_keeps_the_rest_in_order(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Page one'], ['Page two'], ['Page three']])
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out, delete_pages=[2])
    texts = page_texts(out)
    assert len(texts) == 2
    assert 'Page one' in texts[0] and 'Page three' in texts[1]


def test_whiteout_with_context_removes_only_the_class_suffix(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Title above', 'Clasa a IX-a R2 - Anul scolar', 'Exercise R2 stays']])
    out = tmp_path / 'out.pdf'
    counts = clean_pdf.clean(src, out, whiteouts=['R2@IX-a R2'])
    text = page_texts(out)[0]
    assert 'Title above' in text
    assert 'Clasa a IX-a' in text and '- Anul scolar' in text
    assert 'IX-a R2' not in text
    assert 'Exercise R2 stays' in text
    assert counts == {'--whiteout R2@IX-a R2': 1}


def test_whiteout_span_removes_from_start_to_the_next_end_on_the_line(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Line above', 'Matematica * 16.09.2026 * pagina 1 din 2', 'Line below']])
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out, whiteouts=['16.09.2026...*'])
    text = page_texts(out)[0]
    assert '16.09.2026' not in text
    assert 'Line above' in text and 'Line below' in text
    assert 'Matematica *' in text and 'pagina 1 din 2' in text
    assert text.count('*') == 1


def test_whiteout_line_removes_the_whole_line_only(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Title', 'Clasa a IX-a R2 - Unitatea 1 (S2: 14-18.09.2026)', 'Body text']])
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out, whiteout_lines=['Unitatea 1'])
    text = page_texts(out)[0]
    assert 'Title' in text and 'Body text' in text
    assert 'Clasa' not in text and 'Unitatea' not in text


def test_pattern_not_found_raises_and_writes_nothing(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Hello']])
    out = tmp_path / 'out.pdf'
    with pytest.raises(clean_pdf.PatternNotFound, match='Missing text'):
        clean_pdf.clean(src, out, whiteouts=['Missing text'])
    assert not out.exists()


def test_page_number_out_of_range_raises(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Hello']])
    with pytest.raises(ValueError, match='out of range'):
        clean_pdf.clean(src, tmp_path / 'out.pdf', delete_pages=[2])


def test_metadata_is_cleared(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Hello']], author='gabi')
    out = tmp_path / 'out.pdf'
    clean_pdf.clean(src, out)
    meta = pymupdf.open(str(out)).metadata
    assert not meta.get('author') and not meta.get('title')


def test_scan_reports_class_marks_and_answer_headings(tmp_path):
    bad = make_pdf(tmp_path / 'bad.pdf', [['Clasa a IX-a R2', 'Grupa 9R2', 'S2: 14-18', 'Data 16.09.2026'], ['BAREM DE EVALUARE']])
    joined = '\n'.join(clean_pdf.scan(bad))
    assert 'IX-a R2' in joined and '9R2' in joined and 'S2: 1' in joined and '16.09.2026' in joined
    assert 'page 2' in joined and 'BAREM DE EVALUARE' in joined
    good = make_pdf(tmp_path / 'good.pdf', [['Clasa a IX-a', 'Pagina 1 din 3']])
    assert clean_pdf.scan(good) == []


def test_main_exit_codes(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['Clasa a IX-a R2'], ['Hello']])
    assert clean_pdf.main([str(src), str(tmp_path / 'a.pdf'), '--whiteout', 'R2@IX-a R2']) == 0
    assert clean_pdf.main([str(src), str(tmp_path / 'b.pdf'), '--whiteout', 'Nope']) == 1
    assert clean_pdf.main([str(src), str(tmp_path / 'c.pdf'), '--delete-pages', '2']) == 2


def test_render_writes_one_png_per_page(tmp_path):
    src = make_pdf(tmp_path / 'in.pdf', [['One'], ['Two']])
    files = clean_pdf.render(src, tmp_path / 'png')
    assert [f.name for f in files] == ['page-1.png', 'page-2.png']
    assert all(f.stat().st_size > 0 for f in files)
