"""Make a clean copy of a PDF for the site: delete pages, white out text, clear metadata.

Usage:
  python tools/clean_pdf.py SOURCE.pdf OUTPUT.pdf [options]
  python tools/clean_pdf.py SOURCE.pdf --lines

Options:
  --delete-pages 4,5        delete these pages (page numbers of the source file, from 1)
  --whiteout TEXT           remove every occurrence of TEXT
  --whiteout "TEXT@CONTEXT" remove TEXT only inside occurrences of CONTEXT
  --whiteout "START...END"  remove from START to the next END on the same line
  --whiteout-line TEXT      remove the whole text line that contains TEXT
  --render DIR              after writing, save every page as DIR/page-N.png to look at
  --lines                   print every text line with its page number (to copy exact text)

Every pattern must be found at least once; otherwise nothing is written (exit code 1).
After writing, the text is scanned for class marks and answer headings (exit code 2 when found).
"""
import argparse
import re
import sys
from pathlib import Path

import pymupdf

CLASS_MARKS = [
    (re.compile(r'\b[IVX]+-a\s+[A-Z]\d\b'), 'class name like "IX-a R2"'),
    (re.compile(r'\b(?:[5-9]|1[0-2])[A-Z]\d\b'), 'class code like "9R2"'),
    (re.compile(r'\bS\d{1,2}\s*:\s*\d'), 'school week like "S2: 14"'),
    (re.compile(r'\b\d{1,2}\.\d{1,2}\.20\d{2}\b'), 'calendar date like "16.09.2026"'),
]
ANSWER_HEADINGS = ['RĂSPUNSURI ȘI INDICAȚII', 'BAREM DE EVALUARE', 'INDICAȚII DE REZOLVARE']


class PatternNotFound(Exception):
    """A --whiteout or --whiteout-line text does not occur in the kept pages."""


def parse_pages(text):
    return sorted({int(p) for p in text.split(',') if p.strip()}) if text else []


def _same_line(a, b):
    return abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) < 3


def _band(rect):
    # Only the middle of a text line: its own letters cross the band, letters of the lines above and below do not.
    middle = (rect.y0 + rect.y1) / 2
    half = (rect.y1 - rect.y0) * 0.2
    return pymupdf.Rect(rect.x0, middle - half, rect.x1, middle + half)


def find_rects(page, pattern):
    if '...' in pattern:
        start, end = pattern.split('...', 1)
        ends = page.search_for(end)
        rects = []
        for s in page.search_for(start):
            after = [e for e in ends if e.x0 >= s.x1 - 0.5 and _same_line(s, e)]
            if after:
                e = min(after, key=lambda r: r.x0)
                rects.append(pymupdf.Rect(s.x0, min(s.y0, e.y0), e.x1, max(s.y1, e.y1)))
        return rects
    if '@' in pattern:
        text, context = pattern.split('@', 1)
        return [r for c in page.search_for(context) for r in page.search_for(text, clip=c)]
    return page.search_for(pattern)


def find_line_rects(page, text):
    lines = [pymupdf.Rect(line['bbox'])
             for block in page.get_text('dict')['blocks'] for line in block.get('lines', [])]
    rects = []
    for hit in page.search_for(text):
        center = pymupdf.Point((hit.x0 + hit.x1) / 2, (hit.y0 + hit.y1) / 2)
        for line in lines:
            if center in line:
                rects.append(line)
    return rects


def clean(source, output, delete_pages=(), whiteouts=(), whiteout_lines=()):
    """Write a cleaned copy of source to output. Returns {pattern label: number of removals}."""
    doc = pymupdf.open(str(source))
    total = doc.page_count
    wrong = [p for p in delete_pages if not 1 <= p <= total]
    if wrong:
        raise ValueError(f'page numbers out of range 1-{total}: {wrong}')
    deleted = set(delete_pages)
    keep = [i for i in range(total) if i + 1 not in deleted]
    counts = {f'--whiteout {p}': 0 for p in whiteouts}
    counts.update({f'--whiteout-line {p}': 0 for p in whiteout_lines})
    for i in keep:
        page = doc[i]
        rects = []
        for pattern in whiteouts:
            found = find_rects(page, pattern)
            counts[f'--whiteout {pattern}'] += len(found)
            rects.extend(found)
        for text in whiteout_lines:
            found = find_line_rects(page, text)
            counts[f'--whiteout-line {text}'] += len(found)
            rects.extend(found)
        for rect in rects:
            page.add_redact_annot(_band(rect), fill=False)  # no box is drawn: the text goes, the background stays
        if rects:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
    missing = [label for label, n in counts.items() if n == 0]
    if missing:
        raise PatternNotFound('not found: ' + '; '.join(missing))
    doc.select(keep)
    doc.set_metadata({})
    doc.del_xml_metadata()
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output), garbage=4, deflate=True)
    return counts


def scan(path):
    """List class marks and answer headings still present in the text of a PDF."""
    problems = []
    for number, page in enumerate(pymupdf.open(str(path)), start=1):
        text = page.get_text()
        for regex, what in CLASS_MARKS:
            problems.extend(f'page {number}: {what}: "{m.group(0)}"' for m in regex.finditer(text))
        upper = text.upper()
        problems.extend(f'page {number}: answer heading "{h}"' for h in ANSWER_HEADINGS if h in upper)
    return problems


def render(path, out_dir, dpi=70):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for number, page in enumerate(pymupdf.open(str(path)), start=1):
        file = out / f'page-{number}.png'
        page.get_pixmap(dpi=dpi).save(str(file))
        files.append(file)
    return files


def print_lines(path):
    for number, page in enumerate(pymupdf.open(str(path)), start=1):
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(span['text'] for span in line['spans']).strip()
                if text:
                    print(f'p{number} y={round(line["bbox"][1])}: {text}')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Make a clean copy of a PDF for the site.')
    parser.add_argument('source')
    parser.add_argument('output', nargs='?')
    parser.add_argument('--delete-pages', default='')
    parser.add_argument('--whiteout', action='append', default=[])
    parser.add_argument('--whiteout-line', action='append', default=[])
    parser.add_argument('--render')
    parser.add_argument('--lines', action='store_true')
    args = parser.parse_args(argv)
    if args.lines:
        print_lines(args.source)
        return 0
    if not args.output:
        parser.error('OUTPUT is required unless --lines is used')
    try:
        counts = clean(args.source, args.output, parse_pages(args.delete_pages), args.whiteout, args.whiteout_line)
    except (PatternNotFound, ValueError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    for label, n in counts.items():
        print(f'{n:3d} x {label}')
    if args.render:
        for file in render(args.output, args.render):
            print(f'rendered {file}')
    problems = scan(args.output)
    for problem in problems:
        print(f'WARNING: {problem}', file=sys.stderr)
    print(f'written {args.output}')
    return 2 if problems else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
