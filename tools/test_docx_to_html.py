# Tests for tools/docx_to_html.py. Run: python -m pytest tools -q
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import docx_to_html  # noqa: E402


def test_inline_and_display_math_become_dollars():
    html = ('<p>Area: <span class="math inline">\\(a^{2} &lt; b\\)</span></p>\n'
            '<p><span class="math display">\\[\\frac{1}{2}\\]</span></p>')
    assert docx_to_html.math_to_dollars(html) == '<p>Area: $a^{2} &lt; b$</p>\n<p>$$\\frac{1}{2}$$</p>'


def test_tidy_removes_pandoc_layout_noise_and_keeps_content():
    html = ('<blockquote>\n<p>• item</p>\n</blockquote>\n<hr />\n'
            '<table>\n<colgroup>\n<col style="width: 50%" />\n</colgroup>\n<tbody><tr><td>x</td></tr></tbody>\n</table>')
    out = docx_to_html.tidy(html)
    assert '<blockquote>' not in out and '</blockquote>' not in out
    assert '<hr' not in out and '<colgroup>' not in out
    assert '<p>• item</p>' in out and '<td>x</td>' in out


def test_counts_dollar_signs_outside_formulas():
    assert docx_to_html.dollar_warnings('<p>Costs 5 $</p>') == 1
    assert docx_to_html.dollar_warnings('<p><span class="math inline">\\(x\\)</span></p>') == 0


@pytest.mark.skipif(docx_to_html.find_pandoc() is None, reason='pandoc is not installed')
def test_converts_a_real_docx_with_formulas(tmp_path):
    md = tmp_path / 'in.md'
    md.write_text('Area: $a^2 < b$\n\n$$\\frac{1}{2}$$\n\nText.\n', encoding='utf-8')
    docx = tmp_path / 'in.docx'
    subprocess.run([docx_to_html.find_pandoc(), str(md), '-f', 'markdown', '-t', 'docx', '-o', str(docx)], check=True)
    html = docx_to_html.convert(docx)
    assert '$a^{2} &lt; b$' in html
    assert '$$\\frac{1}{2}$$' in html
    assert 'class="math' not in html


def test_trailing_control_space_does_not_leave_a_backslash():
    html = '<p><span class="math inline">\\(\\left| x \\right|\\ \\)</span></p>'
    assert docx_to_html.math_to_dollars(html) == '<p>$\\left| x \\right|$</p>'


def test_trailing_control_space_in_display_math():
    html = '<p><span class="math display">\\[f(x) = x\\ \\]</span></p>'
    assert docx_to_html.math_to_dollars(html) == '<p>$$f(x) = x$$</p>'


def test_a_real_line_break_at_the_end_stays():
    html = '<p><span class="math display">\\[a \\\\ \\]</span></p>'
    assert docx_to_html.math_to_dollars(html) == '<p>$$a \\\\$$</p>'


def test_split_answers_cuts_the_section_off():
    main = ('<p><strong>1.</strong> Text $x$.</p>\n'
            '<p><strong>RĂSPUNSURI ȘI INDICAȚII</strong></p>\n'
            '<p><strong>1.</strong> $4$.</p>\n')
    kept, answers = docx_to_html.split_answers(main)
    assert 'RĂSPUNSURI' not in kept and '$x$' in kept
    assert answers.startswith('<p><strong>RĂSPUNSURI')
    assert '$4$' in answers


def test_split_answers_matches_barem_and_ignores_case_and_cedilla():
    html = '<p>Exercise</p>\n<p><strong>barem de evaluare şi indicaţii</strong></p>\n<p>Key</p>\n'
    kept, answers = docx_to_html.split_answers(html)
    assert kept == '<p>Exercise</p>\n'
    assert answers is not None and 'Key' in answers


def test_split_answers_ignores_a_heading_word_inside_an_exercise():
    html = ('<p><strong>1.</strong> Scrieți răspunsuri complete și indicații pe scurt.</p>\n'
            '<p><strong>2.</strong> Alt exercițiu.</p>\n')
    kept, answers = docx_to_html.split_answers(html)
    assert answers is None and kept == html


def test_split_answers_without_a_heading_returns_the_file_unchanged():
    html = '<p><strong>1.</strong> Text.</p>\n'
    kept, answers = docx_to_html.split_answers(html)
    assert answers is None and kept == html


def test_answers_only_drops_the_title_block(tmp_path):
    html = ('<p><strong>Răspunsuri – Fișă de lucru: Modulul</strong></p>\n'
            '<p><em>Clasa a IX-a · pentru profesor</em></p>\n'
            '<p><strong>I. Calculul modulului</strong></p>\n'
            '<p><strong>1.</strong> a) $4$.</p>\n')
    kept, dropped = docx_to_html.drop_title_block(html)
    assert kept.startswith('<p><strong>I. Calculul')
    assert len(dropped) == 2
    assert '$4$' in kept


def test_answers_only_keeps_everything_without_a_section_number():
    html = '<p><strong>Răspunsuri</strong></p>\n<p>Toate rezolvările în cuvinte.</p>\n'
    kept, dropped = docx_to_html.drop_title_block(html)
    assert kept == html and dropped == []


def test_answers_only_refuses_too_many_leading_blocks():
    html = ''.join(f'<p>Intro {i}</p>\n' for i in range(6)) + '<p><strong>1.</strong> $4$.</p>\n'
    with pytest.raises(ValueError, match='not an answers file'):
        docx_to_html.drop_title_block(html)


def test_exercise_numbers_lists_the_numbered_exercises():
    html = '<p><strong>1.</strong> a</p>\n<p><strong>2.</strong> b</p>\n<p><strong>2.</strong> c</p>\n'
    assert docx_to_html.exercise_numbers(html) == [1, 2]


LEVEL_TEMPLATE = (
    '<p><strong>Fișă de lucru</strong></p>\n'
    '<p><strong>Partea întreagă</strong></p>\n'
    '<p><em>Clasa a IX-a · Barem și rezolvări</em></p>\n'
    '<table>\n<thead>\n<tr>\n<th><p><strong>Reamintim</strong></p>\n'
    '<p>$x = \\lbrack x\\rbrack + \\{ x\\}$</p>\n<p>$0 \\leq \\{ x\\} &lt; 1$</p></th>\n'
    '</tr>\n</thead>\n<tbody>\n</tbody>\n</table>\n'
    '<table>\n<thead>\n<tr>\n<th><strong>NIVELUL I – Calcul direct</strong></th>\n'
    '</tr>\n</thead>\n<tbody>\n</tbody>\n</table>\n'
    '<p><strong>1.</strong> Calculați $\\lbrack 7,3\\rbrack$.</p>\n'
    '<p><em>Rezolvare:</em> $7$.</p>\n'
    '<table>\n<thead>\n<tr>\n<th><strong>NIVELUL II – Ecuații</strong></th>\n'
    '</tr>\n</thead>\n<tbody>\n</tbody>\n</table>\n'
    '<p><strong>2.</strong> Rezolvați $\\lbrack x\\rbrack = 4$.</p>\n'
)


def test_top_blocks_keeps_a_table_with_paragraphs_as_one_block():
    html = '<table>\n<tr><th><p>a</p>\n<p>b</p></th></tr>\n</table>\n<p>c</p>\n'
    assert docx_to_html.top_blocks(html) == [
        '<table>\n<tr><th><p>a</p>\n<p>b</p></th></tr>\n</table>', '<p>c</p>']


def test_heading_tables_become_bold_paragraphs():
    html = docx_to_html.unwrap_heading_tables(LEVEL_TEMPLATE)
    assert '<p><strong>NIVELUL I – Calcul direct</strong></p>' in html
    assert '<p><strong>NIVELUL II – Ecuații</strong></p>' in html
    assert html.count('<table>') == 1  # the Reamintim box is not a one-line heading


def test_answers_only_drops_the_title_and_reminder_box_before_a_level_heading():
    html = docx_to_html.unwrap_heading_tables(LEVEL_TEMPLATE)
    kept, dropped = docx_to_html.drop_title_block(html)
    assert kept.startswith('<p><strong>NIVELUL I – Calcul direct</strong></p>')
    assert len(dropped) == 4
    assert 'Reamintim' not in kept and 'Clasa' not in kept
    assert '<p><strong>NIVELUL II – Ecuații</strong></p>' in kept
    assert docx_to_html.exercise_numbers(kept) == [1, 2]


def test_a_level_word_inside_a_title_is_not_a_section():
    html = '<p><strong>Nivelul clasei</strong></p>\n<p><strong>1.</strong> $4$.</p>\n'
    kept, dropped = docx_to_html.drop_title_block(html)
    assert kept.startswith('<p><strong>1.</strong>') and len(dropped) == 1
