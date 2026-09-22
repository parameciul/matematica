"""Colours, fonts and small helpers shared by every lesson clip.

The colours are the light-theme tokens of `assets/css/style.css`, so a clip looks like the
page it belongs to. The font is "Segoe UI", which the site's own `--font` stack already
names as its fallback for "Atkinson Hyperlegible Next", and which carries the Romanian
comma-below letters `ș ț Ș Ț`.
"""
from manim import Text

PAPER = "#FBFCFE"  # --paper, the background
TEXT = "#24272D"  # --text
MUTED = "#586070"  # --muted
INK = "#1D3C8F"  # --ink, headings and emphasis
RED = "#CF3A2F"  # --red, warnings
MARKER = "#FFD94A"  # --marker-edge, the highlighter
GREEN = "#1B6B43"  # --b-fise-fg
FILL = "#C9D6F3"  # --fill

FONT = "Segoe UI"

# Manim's own default is white-on-black; every clip draws on paper instead.
MATH_COLOR = TEXT

# Watch out: anything Manim colours by default stays WHITE and so becomes invisible here.
# A NumberLine's `color` reaches its line and ticks but not its number labels, so call
# `line.numbers.set_color(TEXT)` after building one. The same trap applies to any mobject
# built with sub-parts you did not colour yourself.


def ro(text, size=32, color=TEXT, weight="NORMAL", **kwargs):
    """Romanian on-screen text in the site font."""
    return Text(text, font=FONT, font_size=size, color=color, weight=weight, **kwargs)


def title(text):
    return ro(text, size=52, color=INK, weight="BOLD")


def caption(text):
    return ro(text, size=26, color=MUTED)
