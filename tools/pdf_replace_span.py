"""Replace a run of text inside a published PDF, keeping the page's own font.

Use this only when a published PDF states something the site has since corrected and the
correction cannot come from the source. It finds a text span whose characters spell OLD,
removes it, and draws NEW at the same spot with the font that span already used, so the
replacement matches the surrounding text exactly.

  python tools/pdf_replace_span.py FILE.pdf "OLD=>NEW" ["OLD=>NEW" ...] [--render DIR]

Options:
  --render DIR   after writing, save every changed page as DIR/page-N.png to look at
  --dry-run      report what would change and write nothing

Every OLD must match at least one whole span, otherwise nothing is written (exit code 1).
A span is what a PDF calls one run of text in one font, which is usually shorter than a
sentence: run --list to see the spans of a page. After writing, the text is scanned for
class marks and answer headings, the same rule clean_pdf.py applies (exit code 2).

CAUTION: this edits the published copy only. The file in Website-Content still says the old
thing, so a later `node tools/material.mjs pdf <uid>` regenerates the PDF from the source
and throws the correction away. Fix the source when you can, and re-run this when you
cannot.
"""
import argparse
import os
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent))

from clean_pdf import ANSWER_HEADINGS, CLASS_MARKS

SEPARATOR = "=>"


class SpanNotFound(Exception):
    """An OLD text does not spell out any whole span in the document."""


def parse_replacement(text):
    if SEPARATOR not in text:
        raise argparse.ArgumentTypeError(f'expected "OLD{SEPARATOR}NEW", got {text!r}')
    old, new = text.split(SEPARATOR, 1)
    if not old:
        raise argparse.ArgumentTypeError("the OLD side must not be empty")
    return old, new


def span_text(span):
    return "".join(char["c"] for char in span["chars"])


def spans_of(page):
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                yield span


def font_buffer(doc, page, span_font):
    """The embedded font file a span uses. PDF base font names carry a subset prefix."""
    for xref, _ext, _type, basefont, *_rest in page.get_fonts(full=True):
        if basefont == span_font or basefont.split("+")[-1] == span_font:
            _name, _ext2, _type2, buffer = doc.extract_font(xref)
            if buffer:
                return buffer
    return None


def base14_name(span_font):
    """The built-in font to fall back on when a span's font is not embedded.

    The 14 standard PDF fonts carry no font file, so there is nothing to extract; a viewer
    supplies them. pymupdf knows them under short names such as "helv" and "tiro".
    """
    wanted = span_font.split("+")[-1].replace(" ", "").lower()
    for short, full in pymupdf.Base14_fontdict.items():
        if full.replace("-", "").lower() == wanted.replace("-", ""):
            return short
    return None


def plan(doc, replacements):
    """Find every span to redraw. Returns a list of (page number, span, new text)."""
    jobs = []
    seen = set()
    for number, page in enumerate(doc, start=1):
        for span in spans_of(page):
            text = span_text(span)
            for old, new in replacements:
                if text == old:
                    jobs.append((number, span, new))
                    seen.add(old)
    missing = [old for old, _new in replacements if old not in seen]
    if missing:
        raise SpanNotFound(", ".join(repr(m) for m in missing))
    return jobs


def apply(doc, jobs):
    by_page = {}
    for number, span, new in jobs:
        by_page.setdefault(number, []).append((span, new))
    for number, items in by_page.items():
        page = doc[number - 1]
        buffers = {}
        for span, _new in items:
            if span["font"] not in buffers:
                buffers[span["font"]] = font_buffer(doc, page, span["font"])
            page.add_redact_annot(pymupdf.Rect(span["bbox"]))
        page.apply_redactions()
        order = {}
        for index, (font, buffer) in enumerate(buffers.items()):
            if buffer is not None:
                name = f"Rf{index}"
                page.insert_font(fontname=name, fontbuffer=buffer)
            else:
                name = base14_name(font)
                if name is None:
                    raise SpanNotFound(f"no embedded font file for {font!r}")
            order[font] = name
        for span, new in items:
            page.insert_text(
                pymupdf.Point(span["chars"][0]["origin"]),
                new,
                fontname=order[span["font"]],
                fontsize=span["size"],
                color=(0, 0, 0),
            )
    return sorted(by_page)


def scan(doc):
    problems = []
    for number, page in enumerate(doc, start=1):
        text = page.get_text()
        for pattern, description in CLASS_MARKS:
            match = pattern.search(text)
            if match:
                problems.append(f"page {number}: {description}: {match.group(0)!r}")
        upper = text.upper()
        for heading in ANSWER_HEADINGS:
            if heading in upper:
                problems.append(f"page {number}: answer heading: {heading}")
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("replacements", nargs="*", type=parse_replacement)
    parser.add_argument("--render", type=Path, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--list", action="store_true", help="print every span and exit")
    args = parser.parse_args(argv)

    doc = pymupdf.open(args.pdf)

    if args.list:
        for number, page in enumerate(doc, start=1):
            for span in spans_of(page):
                print(f"{number}: {span_text(span)!r}")
        return 0

    if not args.replacements:
        parser.error('give at least one "OLD=>NEW"')

    try:
        jobs = plan(doc, args.replacements)
    except SpanNotFound as e:
        print(f"not found as a whole span: {e}", file=sys.stderr)
        print("Run with --list to see the spans of the document.", file=sys.stderr)
        return 1

    for number, span, new in jobs:
        print(f"page {number}: {span_text(span)!r} -> {new!r}")
    if args.dry_run:
        return 0

    try:
        changed = apply(doc, jobs)
    except SpanNotFound as e:
        print(str(e), file=sys.stderr)
        return 1

    # pymupdf refuses a full save over the file it has open, and writing beside the original
    # first means a crash mid-save cannot leave a half-written PDF in the repo.
    temporary = args.pdf.with_name(args.pdf.name + ".new")
    doc.save(temporary, garbage=3, deflate=True)
    doc.close()
    os.replace(temporary, args.pdf)
    doc = pymupdf.open(args.pdf)

    if args.render:
        args.render.mkdir(parents=True, exist_ok=True)
        for number in changed:
            doc[number - 1].get_pixmap(dpi=150).save(args.render / f"page-{number}.png")

    problems = scan(doc)
    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        return 2
    print(f"written: {args.pdf} ({len(jobs)} span(s) on {len(changed)} page(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
