"""Convert a Word document to an HTML fragment for a material page.

Usage: python tools/docx_to_html.py SOURCE.docx [-o OUTPUT.html]

Runs pandoc (Word equations become LaTeX), then:
- writes formulas as $...$ (inline) and $$...$$ (display), the way the site expects them;
- removes pandoc's <colgroup> width hints, <hr /> rules and <blockquote> wrappers made from indentation.
The result still needs a human pass: headings, lists, class marks, name lines and answers.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

MATH_RE = re.compile(r'<span class="math (inline|display)">(.*?)</span>', re.S)


def find_pandoc():
    found = shutil.which('pandoc')
    if found:
        return found
    candidates = [
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Pandoc' / 'pandoc.exe',
        Path(r'C:\Program Files\Pandoc\pandoc.exe'),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def pandoc_html(source):
    exe = find_pandoc()
    if not exe:
        raise FileNotFoundError('pandoc not found. Install it: winget install --id JohnMacFarlane.Pandoc')
    result = subprocess.run(
        [exe, str(source), '-f', 'docx', '-t', 'html5', '--math-method=mathjax', '--wrap=none'],
        capture_output=True, text=True, encoding='utf-8', check=True,
    )
    return result.stdout


def _drop_dangling_backslash(tex):
    # pandoc can end a formula with a control space "\ "; once stripped, a lone "\" would break KaTeX.
    # An even number of trailing backslashes is a real line break "\\" and stays.
    tex = tex.strip()
    trailing = len(tex) - len(tex.rstrip('\\'))
    if trailing % 2 == 1:
        tex = tex[:-1].rstrip()
    return tex


def math_to_dollars(html):
    def replace(match):
        tex = match.group(2).strip()
        if match.group(1) == 'inline':
            if tex.startswith('\\(') and tex.endswith('\\)'):
                tex = tex[2:-2]
            return f'${_drop_dangling_backslash(tex)}$'
        if tex.startswith('\\[') and tex.endswith('\\]'):
            tex = tex[2:-2]
        return f'$${_drop_dangling_backslash(tex)}$$'
    return MATH_RE.sub(replace, html)


def dollar_warnings(html):
    """Count $ signs outside formulas in pandoc output; KaTeX would read them as formula delimiters."""
    return MATH_RE.sub('', html).count('$')


def tidy(html):
    html = re.sub(r'<colgroup>.*?</colgroup>\s*', '', html, flags=re.S)
    html = re.sub(r'<hr\s*/?>\s*', '', html)
    html = re.sub(r'</?blockquote>\s*', '', html)
    return html


def convert(source):
    return tidy(math_to_dollars(pandoc_html(source)))


def strip_diacritics(text):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')


def plain_text(html):
    return re.sub(r'<[^>]+>', '', html or '')


# Headings that start the answer key at the end of a worksheet. The match
# ignores case and diacritics, both comma-below (ș ț) and cedilla (ş ţ).
ANSWER_HEADINGS = [
    'raspunsuri',
    'barem de evaluare',
    'barem de corectare',
    'indicatii de rezolvare',
    'solutii',
    'rezolvari',
    'pagina destinata profesorului',
]


def top_blocks(html):
    """The top-level block elements of pandoc output, in order."""
    return [m.group(0) for m in re.finditer(
        r'<(?:p|h[1-6]|table|ul|ol|div|pre|blockquote)\b[^>]*>.*?</(?:p|h[1-6]|table|ul|ol|div|pre|blockquote)>'
        r'|<hr\s*/?>',
        html, re.S)]


def is_answer_heading(block):
    """A short, all-bold block starting with an answer heading word.

    An exercise sentence never matches: it is longer and not all bold.
    """
    text = plain_text(block).strip()
    if not text or len(text) > 100:
        return False
    # All bold: nothing but whitespace outside <strong> spans.
    rest = re.sub(r'<strong\b[^>]*>.*?</strong>', '', block, flags=re.S)
    if plain_text(rest).strip():
        return False
    norm = strip_diacritics(text).lower()
    return any(norm.startswith(h) for h in ANSWER_HEADINGS)


def split_answers(html):
    """Cut the answer section off a converted worksheet.

    Returns (main, answers): everything from the answer heading to the end, or
    (html, None) when no heading is found. ro.html never holds the answers.
    """
    blocks = top_blocks(html)
    for i, block in enumerate(blocks):
        if is_answer_heading(block):
            join = lambda parts: ''.join(p + '\n' for p in parts)
            return join(blocks[:i]), join(blocks[i:])
    return html, None


SECTION_NUMBER_RE = re.compile(r'^(?:[IVXLCDM]+\.|\d+\.)\s')


def drop_title_block(html):
    """Drop the title block of a separate answers document: every leading
    block up to, but not including, the first block starting with a section
    number (a Roman numeral and a dot, or a digit and a dot).

    Returns (kept, dropped): kept is the whole file when nothing starts with
    a section number. Raises ValueError when more than 5 leading blocks would
    go: the file is not shaped as expected.
    """
    blocks = top_blocks(html)
    for i, block in enumerate(blocks):
        if SECTION_NUMBER_RE.match(plain_text(block).strip()):
            if i > 5:
                raise ValueError(f'{i} blocks before the first section number: not an answers file as expected')
            join = lambda parts: ''.join(p + '\n' for p in parts)
            return join(blocks[i:]), blocks[:i]
    return html, []


def exercise_numbers(html):
    """The numbered exercises of a converted file: <strong>N.</strong> blocks."""
    return sorted({int(n) for n in re.findall(r'<strong>\s*(\d+)\s*\.', html)})


def main(argv=None):
    parser = argparse.ArgumentParser(description='Convert a Word document to an HTML fragment for a material page.')
    parser.add_argument('source')
    parser.add_argument('-o', '--output')
    parser.add_argument('--answers', metavar='OUT',
                        help='also write the answer section (from its heading to the end) to OUT')
    parser.add_argument('--answers-only', action='store_true',
                        help='convert a separate answers document: no split, drop the title block')
    args = parser.parse_args(argv)
    if args.answers and args.answers_only:
        parser.error('--answers and --answers-only never appear together')
    raw = pandoc_html(args.source)
    html = tidy(math_to_dollars(raw))
    if args.answers_only:
        try:
            html, dropped = drop_title_block(html)
        except ValueError as error:
            print(f'ERROR: {error}', file=sys.stderr)
            return 1
        if not dropped:
            print('title block not found, kept everything')
    elif args.answers:
        html, answers = split_answers(html)
        if answers is None:
            print('no answer section found')
        else:
            Path(args.answers).parent.mkdir(parents=True, exist_ok=True)
            Path(args.answers).write_text(answers, encoding='utf-8')
            print(f'written {args.answers}')
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(html, encoding='utf-8')
        print(f'written {args.output}')
    else:
        sys.stdout.write(html)
    count = dollar_warnings(raw)
    if count:
        print(f'WARNING: {count} "$" sign(s) outside formulas. Write them as &#36; so KaTeX does not read them as formulas.',
              file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
