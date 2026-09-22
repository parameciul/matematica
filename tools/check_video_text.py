"""Check a lesson clip's narration and on-screen words for class marks and answers.

The same rule the PDFs follow: a published clip must not carry a class code, a school week,
an exact date, or an answer heading. The patterns come from clean_pdf.py, so the video and
the PDF can never disagree about what counts as a class mark.

Usage:
  python tools/check_video_text.py video/scenes/<name>/<clip>.py [more files...]

Exit code 0 when clean, 2 when something was found.
"""
import ast
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from clean_pdf import ANSWER_HEADINGS, CLASS_MARKS


def strings_of(source):
    """Every string literal in a Python file, with its line number."""
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            yield node.lineno, node.value


def check(path):
    found = []
    source = Path(path).read_text(encoding="utf-8")
    for lineno, text in strings_of(source):
        for pattern, description in CLASS_MARKS:
            match = pattern.search(text)
            if match:
                found.append((lineno, description, match.group(0)))
        upper = text.upper()
        for heading in ANSWER_HEADINGS:
            if heading in upper:
                found.append((lineno, "answer heading", heading))
    return found


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    total = 0
    for path in argv:
        for lineno, description, text in check(path):
            print(f"{path}:{lineno}: {description}: {text!r}")
            total += 1
    if total:
        print(f"\n{total} problem(s) found. A clip must carry no class marks and no answers.")
        return 2
    print(f"clean: {len(argv)} file(s), no class marks and no answers")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
