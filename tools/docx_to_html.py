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


def math_to_dollars(html):
    def replace(match):
        tex = match.group(2).strip()
        if match.group(1) == 'inline':
            if tex.startswith('\\(') and tex.endswith('\\)'):
                tex = tex[2:-2]
            return f'${tex.strip()}$'
        if tex.startswith('\\[') and tex.endswith('\\]'):
            tex = tex[2:-2]
        return f'$${tex.strip()}$$'
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


def main(argv=None):
    parser = argparse.ArgumentParser(description='Convert a Word document to an HTML fragment for a material page.')
    parser.add_argument('source')
    parser.add_argument('-o', '--output')
    args = parser.parse_args(argv)
    raw = pandoc_html(args.source)
    html = tidy(math_to_dollars(raw))
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
