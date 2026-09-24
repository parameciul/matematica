"""Write the search metadata of each material PDF from data/materials.source.json.

Usage:
  python tools/pdf_meta.py [UID ...]           write the metadata (all PDFs when no uid is given)
  python tools/pdf_meta.py --check [UID ...]   exit 1 when a PDF does not hold the metadata of its material

Google shows the PDF Title as the title of a PDF in search results. Without
one it guesses from the first lines of the page. The metadata comes from the
data only, never from the source file: clean_pdf.py clears the source
metadata, and a teacher PDF copied with --pdf may carry a name or a class.

Title: the Romanian seoTitle (or title) plus the grade, as in the page <title>. Author: Laura Miron.
Subject: the Romanian description. Keywords: the Romanian keywords. /Lang: ro.
Every other field is empty and the XMP stream is removed.

A PDF that already holds the right metadata is not written again, so reruns
change no bytes. A written PDF keeps the fixed trailer /ID of clean_pdf.py.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
AUTHOR = 'Laura Miron'
LANG = 'ro'
ROMAN = {5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'}
FIXED_ID = '[<00000000000000000000000000000000><00000000000000000000000000000000>]'
FIELDS = ('title', 'author', 'subject', 'keywords', 'creator', 'producer', 'creationDate', 'modDate', 'trapped')


def names_class(title):
    """Same rule as namesClass in tools/build_pages.mjs."""
    return re.search(r'\bclasa\b|\bclasei\b|\bclasele\b|\bgrade\b', title or '', re.IGNORECASE) is not None


def wanted(material, grade):
    # The same words as the page <title> (tools/build_pages.mjs), without the brand.
    title = (material.get('seoTitle') or {}).get('ro') or material['title']['ro']
    if not names_class(title):
        title = f'{title} – clasa a {grade}-a ({ROMAN[grade]})'
    keywords = (material.get('keywords') or {}).get('ro') or []
    return {
        'title': title,
        'author': AUTHOR,
        'subject': material['description']['ro'],
        'keywords': ', '.join(keywords),
    }


def current(doc):
    meta = doc.metadata or {}
    return {key: meta.get(key) or '' for key in ('title', 'author', 'subject', 'keywords')}


def is_current(path, meta):
    doc = pymupdf.open(str(path))
    try:
        other = {k: v for k, v in (doc.metadata or {}).items() if k in FIELDS and k not in meta and v}
        return (current(doc) == meta and not other and doc.language == LANG
                and not doc.get_xml_metadata())
    finally:
        doc.close()


def write(path, meta):
    """Write meta into the PDF at path. Returns False when it already held it."""
    if is_current(path, meta):
        return False
    doc = pymupdf.open(str(path))
    doc.set_metadata({key: meta.get(key, '') for key in FIELDS})
    doc.del_xml_metadata()
    doc.set_language(LANG)
    doc.xref_set_key(-1, 'ID', FIXED_ID)
    tmp = Path(f'{path}.meta')
    doc.save(str(tmp), garbage=4, deflate=True, no_new_id=1)
    doc.close()
    tmp.replace(path)
    return True


def materials_with_pdf(root, uids):
    data = json.loads((root / 'data' / 'materials.source.json').read_text(encoding='utf8'))
    grades = {t['id']: t['grade'] for t in data['topics']}
    found = []
    for m in data['materials']:
        if uids and m['uid'] not in uids:
            continue
        if m.get('pdf'):
            found.append((m, grades[m['topic']]))
    missing = sorted(set(uids) - {m['uid'] for m in data['materials']})
    if missing:
        raise ValueError(f'no live material with uid {", ".join(missing)}')
    return found


def main(argv=None, root=ROOT):
    parser = argparse.ArgumentParser(description='Write the search metadata of each material PDF.')
    parser.add_argument('uids', nargs='*')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args(argv)
    try:
        items = materials_with_pdf(root, args.uids)
    except ValueError as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    stale = []
    for material, grade in items:
        path = root / material['pdf']
        if not path.exists():
            print(f'ERROR: {material["pdf"]} does not exist', file=sys.stderr)
            return 1
        meta = wanted(material, grade)
        if args.check:
            if not is_current(path, meta):
                stale.append(material['pdf'])
        elif write(path, meta):
            print(f'metadata written {material["pdf"]}')
        else:
            print(f'unchanged {material["pdf"]}')
    for pdf in stale:
        print(f'STALE: {pdf}: run python tools/pdf_meta.py', file=sys.stderr)
    return 1 if stale else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
