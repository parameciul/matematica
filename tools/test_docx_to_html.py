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
