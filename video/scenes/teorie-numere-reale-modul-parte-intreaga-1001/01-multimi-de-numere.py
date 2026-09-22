"""Clip 1 of the grade 9 lesson "Numere reale, modul, parte întreagă".

Covers section 1, "Mulțimi de numere": the naturals, the integers, the rationals, the
irrationals, the chain N < Z < Q < R and the R*, R+, R- notations.

Spoken in Romanian, captioned in Romanian and English.

Render:
    uv run manim render -ql scenes/.../01-multimi-de-numere.py MultimiDeNumere   (draft)
    uv run manim render -qh scenes/.../01-multimi-de-numere.py MultimiDeNumere   (final)
"""
import sys
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    MathTex,
    NumberLine,
    Rectangle,
    Transform,
    VGroup,
    Write,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from bilingual import BilingualVoiceoverScene  # noqa: E402
from edge_tts_service import EdgeTTSService  # noqa: E402
from theme import (  # noqa: E402
    GREEN,
    INK,
    MARKER,
    MATH_COLOR,
    MUTED,
    RED,
    TEXT,
    caption,
    title,
)

VOICE = "fr-FR-VivienneMultilingualNeural"


class MultimiDeNumere(BilingualVoiceoverScene):
    def construct(self):
        self.set_speech_service(EdgeTTSService(voice=VOICE), create_subcaption=True)
        self.opening()
        self.naturale()
        self.intregi()
        self.rationale()
        self.irationale()
        self.lantul()
        self.notatii()
        self.closing()
        self.write_english_subtitles()

    # ------------------------------------------------------------------ opening

    def opening(self):
        head = title("Mulțimi de numere")
        sub = caption("Clasa a IX-a · Numere reale")
        VGroup(head, sub).arrange(DOWN, buff=0.45)
        with self.say(
            ro=(
                "Bine ați venit! Astăzi recapitulăm mulțimile de numere. "
                "<bookmark mark='sub'/> Este primul pas din lecția despre numere reale."
            ),
            en=(
                "Welcome! Today we review the sets of numbers. "
                "This is the first step of the lesson on real numbers."
            ),
        ) as t:
            self.play(FadeIn(head, shift=UP * 0.3), run_time=1.2)
            self.wait_until_bookmark("sub")
            self.play(FadeIn(sub), run_time=0.8)
            self.wait(t.get_remaining_duration())
        self.play(FadeOut(head), FadeOut(sub), run_time=0.6)

    # --------------------------------------------------------------- naturale

    def naturale(self):
        head = title("Numerele naturale").to_edge(UP, buff=0.8)
        formula = MathTex(r"\mathbb{N}=\{0,\ 1,\ 2,\ 3,\ \ldots\}", color=MATH_COLOR).scale(1.2)
        formula.next_to(head, DOWN, buff=0.9)

        line = NumberLine(
            x_range=[0, 6, 1],
            length=9,
            include_numbers=True,
            color=MUTED,
            font_size=30,
        )
        # NumberLine's `color` reaches the line and the ticks but not the number labels:
        # those keep Manim's default white, which is invisible on the paper background.
        line.numbers.set_color(TEXT)
        line.next_to(formula, DOWN, buff=1.1)
        dots = VGroup(*[Dot(line.n2p(k), color=INK, radius=0.09) for k in range(7)])

        with self.say(
            ro=(
                "Pornim de la numerele naturale. "
                "<bookmark mark='set'/> Sunt numerele cu care numărăm: zero, unu, doi, trei și așa mai departe. "
                "<bookmark mark='axa'/> Pe axă ele stau la dreapta lui zero, din unu în unu."
            ),
            en=(
                "We start from the natural numbers. "
                "These are the numbers we count with: zero, one, two, three and so on. "
                "On the number line they sit to the right of zero, one step at a time."
            ),
        ) as t:
            self.play(FadeIn(head), run_time=0.8)
            self.wait_until_bookmark("set")
            self.play(Write(formula), run_time=1.6)
            self.wait_until_bookmark("axa")
            self.play(Create(line), run_time=1.2)
            self.play(FadeIn(dots, lag_ratio=0.15), run_time=1.2)
            self.wait(t.get_remaining_duration())

        self.head, self.formula, self.line, self.dots = head, formula, line, dots

    # ---------------------------------------------------------------- întregi

    def intregi(self):
        head2 = title("Numerele întregi").to_edge(UP, buff=0.8)
        formula2 = MathTex(
            r"\mathbb{Z}=\{\ldots,\ -2,\ -1,\ 0,\ 1,\ 2,\ \ldots\}", color=MATH_COLOR
        ).scale(1.2)
        formula2.move_to(self.formula)

        line2 = NumberLine(
            x_range=[-6, 6, 1],
            length=11,
            include_numbers=True,
            include_ticks=True,
            color=MUTED,
            font_size=26,
        )
        line2.numbers.set_color(TEXT)
        line2.move_to(self.line)
        negatives = VGroup(*[Dot(line2.n2p(k), color=RED, radius=0.09) for k in range(-6, 0)])
        positives = VGroup(*[Dot(line2.n2p(k), color=INK, radius=0.09) for k in range(0, 7)])

        with self.say(
            ro=(
                "Adăugăm acum numerele negative și obținem numerele întregi. "
                "<bookmark mark='axa'/> Axa se prelungește la stânga lui zero, "
                "<bookmark mark='neg'/> iar fiecare număr natural capătă un opus."
            ),
            en=(
                "Now we add the negative numbers and we get the integers. "
                "The number line extends to the left of zero, "
                "and every natural number gains an opposite."
            ),
        ) as t:
            # The title, the set and the old axis change in one step. Leaving the natural
            # number axis on screen under the integer title would say something false.
            self.play(
                Transform(self.head, head2),
                Transform(self.formula, formula2),
                FadeOut(self.line),
                FadeOut(self.dots),
                run_time=1.2,
            )
            self.wait_until_bookmark("axa")
            # A Transform between two NumberLines drops their number labels, so the axis is
            # swapped outright instead of morphed.
            self.play(Create(line2), FadeIn(positives, lag_ratio=0.1), run_time=1.3)
            self.wait_until_bookmark("neg")
            self.play(FadeIn(negatives, lag_ratio=0.12), run_time=1.2)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(line2), FadeOut(positives), FadeOut(negatives), run_time=0.7)

    # -------------------------------------------------------------- raționale

    def rationale(self):
        head3 = title("Numerele raționale").to_edge(UP, buff=0.8)
        formula3 = MathTex(
            r"\mathbb{Q}=\left\{\frac{a}{b}\ \middle|\ a\in\mathbb{Z},\ b\in\mathbb{Z}^{*}\right\}",
            color=MATH_COLOR,
        ).scale(1.1)
        formula3.move_to(self.formula)

        examples = VGroup(
            MathTex(r"\frac{1}{2}=0{,}5", color=INK),
            MathTex(r"\frac{1}{3}=0{,}(3)", color=INK),
            MathTex(r"-\frac{7}{4}=-1{,}75", color=INK),
        ).arrange(RIGHT, buff=1.3).scale(1.0)
        examples.next_to(formula3, DOWN, buff=1.2)
        note = caption("scriere zecimală finită sau periodică")
        note.next_to(examples, DOWN, buff=0.7)

        with self.say(
            ro=(
                "Mergem mai departe la numerele raționale: o fracție cu numărătorul întreg "
                "și numitorul întreg nenul. "
                "<bookmark mark='ex'/> Iată trei exemple. "
                "<bookmark mark='note'/> Atenție la regula practică: scrierea lor zecimală "
                "este ori finită, ori periodică."
            ),
            en=(
                "We move on to the rational numbers: a fraction with an integer numerator "
                "and a non-zero integer denominator. "
                "Here are three examples. "
                "Mind the practical rule: their decimal form is either finite or periodic."
            ),
        ) as t:
            # Title and set change together: the integer set must not sit under the
            # rational title.
            self.play(Transform(self.head, head3), Transform(self.formula, formula3), run_time=1.3)
            self.wait_until_bookmark("ex")
            self.play(FadeIn(examples, lag_ratio=0.3), run_time=1.6)
            self.wait_until_bookmark("note")
            self.play(FadeIn(note), run_time=0.8)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(examples), FadeOut(note), run_time=0.6)

    # ------------------------------------------------------------- iraționale

    def irationale(self):
        head4 = title("Numerele iraționale").to_edge(UP, buff=0.8)
        formula4 = MathTex(r"\mathbb{R}\smallsetminus\mathbb{Q}", color=MATH_COLOR).scale(1.4)
        formula4.move_to(self.formula)

        examples = VGroup(
            MathTex(r"\sqrt{2}\approx 1{,}41421\ldots", color=GREEN),
            MathTex(r"\sqrt{3}\approx 1{,}73205\ldots", color=GREEN),
            MathTex(r"\pi\approx 3{,}14159\ldots", color=GREEN),
        ).arrange(DOWN, buff=0.5, aligned_edge=LEFT)
        examples.next_to(formula4, DOWN, buff=1.0)
        note = caption("scriere zecimală infinită și neperiodică")
        note.next_to(examples, DOWN, buff=0.7)

        with self.say(
            ro=(
                "Nu toate numerele sunt raționale: cele iraționale sunt numerele reale "
                "care nu sunt raționale. "
                "<bookmark mark='ex'/> Radical din doi, radical din trei și numărul pi "
                "sunt iraționale. "
                "<bookmark mark='note'/> Scrierea lor zecimală este infinită și nu se repetă niciodată."
            ),
            en=(
                "Not every number is rational: the irrational ones are the real numbers "
                "that are not rational. "
                "The square root of two, the square root of three and pi are irrational. "
                "Their decimal form is infinite and never repeats."
            ),
        ) as t:
            self.play(Transform(self.head, head4), Transform(self.formula, formula4), run_time=1.3)
            self.wait_until_bookmark("ex")
            self.play(FadeIn(examples, lag_ratio=0.35), run_time=1.8)
            self.wait_until_bookmark("note")
            self.play(FadeIn(note), run_time=0.8)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(examples), FadeOut(note), FadeOut(self.formula), run_time=0.7)

    # ----------------------------------------------------------------- lanțul

    def lantul(self):
        head5 = title("Toate la un loc").to_edge(UP, buff=0.8)

        # The steps between the boxes have to be wide enough that the nesting reads at a
        # glance, and each label has to sit clear of the box inside it.
        sizes = [(11.0, 4.6), (8.4, 3.6), (5.6, 2.6), (2.6, 1.4)]
        colors = [MUTED, GREEN, INK, RED]
        labels = [r"\mathbb{R}", r"\mathbb{Q}", r"\mathbb{Z}", r"\mathbb{N}"]
        boxes = VGroup()
        tags = VGroup()
        for (w, h), col, lab in zip(sizes, colors, labels):
            box = Rectangle(width=w, height=h, color=col, stroke_width=5)
            box.set_fill(col, opacity=0.07)
            boxes.add(box)
            tag = MathTex(lab, color=col).scale(1.0)
            tag.move_to(box.get_corner(UP + LEFT) + RIGHT * 0.62 + DOWN * 0.5)
            tags.add(tag)
        # The innermost label would land on top of its own small box, so it goes in the middle.
        tags[3].move_to(boxes[3].get_center())
        diagram = VGroup(boxes, tags).move_to(DOWN * 0.35)

        chain = MathTex(
            r"\mathbb{N}\subset\mathbb{Z}\subset\mathbb{Q}\subset\mathbb{R}", color=MATH_COLOR
        ).scale(1.3)
        chain.to_edge(DOWN, buff=0.45)

        with self.say(
            ro=(
                "Să punem totul într-o singură imagine. "
                "<bookmark mark='r'/> Cea mai cuprinzătoare este mulțimea numerelor reale. "
                "<bookmark mark='q'/> În interiorul ei stau numerele raționale, "
                "<bookmark mark='z'/> apoi numerele întregi, "
                "<bookmark mark='n'/> iar în mijloc, numerele naturale. "
                "<bookmark mark='lant'/> Reținem lanțul de incluziuni."
            ),
            en=(
                "Let us put everything into a single picture. "
                "The widest one is the set of real numbers. "
                "Inside it sit the rational numbers, "
                "then the integers, "
                "and in the middle, the natural numbers. "
                "Remember this chain of inclusions."
            ),
        ) as t:
            self.play(Transform(self.head, head5), run_time=0.8)
            for mark, index in (("r", 0), ("q", 1), ("z", 2), ("n", 3)):
                self.wait_until_bookmark(mark)
                self.play(Create(boxes[index]), FadeIn(tags[index]), run_time=1.0)
            self.wait_until_bookmark("lant")
            self.play(Write(chain), run_time=1.6)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(diagram), run_time=0.7)
        self.chain = chain

    # ---------------------------------------------------------------- notații

    def notatii(self):
        head6 = title("Notații utile").to_edge(UP, buff=0.8)
        rows = VGroup(
            MathTex(r"\mathbb{R}^{*}=\mathbb{R}\smallsetminus\{0\}", color=MATH_COLOR),
            MathTex(r"\mathbb{R}_{+}=(\,0,\ +\infty)", color=MATH_COLOR),
            MathTex(r"\mathbb{R}_{-}=(-\infty,\ 0\,)", color=MATH_COLOR),
        ).arrange(DOWN, buff=0.75, aligned_edge=LEFT).scale(1.15)
        rows.move_to(UP * 0.2)

        with self.say(
            ro=(
                "Mai avem trei notații utile. "
                "<bookmark mark='a'/> R stelat înseamnă numerele reale fără zero. "
                "<bookmark mark='b'/> R plus înseamnă numerele reale strict pozitive, deci fără zero. "
                "<bookmark mark='c'/> R minus înseamnă numerele reale strict negative, tot fără zero."
            ),
            en=(
                "Three more useful notations. "
                "R star means the real numbers without zero. "
                "R plus means the strictly positive real numbers, so zero is left out. "
                "R minus means the strictly negative real numbers, again without zero."
            ),
        ) as t:
            self.play(Transform(self.head, head6), FadeOut(self.chain), run_time=0.9)
            for mark, index in (("a", 0), ("b", 1), ("c", 2)):
                self.wait_until_bookmark(mark)
                self.play(Write(rows[index]), run_time=1.3)
            self.wait(t.get_remaining_duration())

        self.rows = rows

    # ------------------------------------------------------------------ final

    def closing(self):
        head7 = title("De reținut").to_edge(UP, buff=0.8)
        summary = MathTex(
            r"\mathbb{N}\subset\mathbb{Z}\subset\mathbb{Q}\subset\mathbb{R}", color=INK
        ).scale(1.6)
        underline = Rectangle(width=7.4, height=0.22, color=MARKER, stroke_width=0)
        underline.set_fill(MARKER, opacity=0.85)
        underline.next_to(summary, DOWN, buff=0.18)
        bye = caption("În clipul următor: relația de ordine și intervalele.")
        bye.next_to(underline, DOWN, buff=1.1)

        with self.say(
            ro=(
                "Să reținem ideea principală: "
                "<bookmark mark='sum'/> fiecare mulțime o conține pe cea dinaintea ei. "
                "<bookmark mark='bye'/> În clipul următor continuăm cu relația de ordine și cu intervalele. "
                "Pe curând!"
            ),
            en=(
                "Let us keep the main idea: "
                "every set contains the one before it. "
                "In the next clip we continue with the order relation and the intervals. "
                "See you soon!"
            ),
        ) as t:
            self.play(Transform(self.head, head7), FadeOut(self.rows), run_time=0.9)
            self.wait_until_bookmark("sum")
            self.play(Write(summary), run_time=1.5)
            self.play(FadeIn(underline), run_time=0.7)
            self.wait_until_bookmark("bye")
            self.play(FadeIn(bye), run_time=0.9)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(self.head), FadeOut(summary), FadeOut(underline), FadeOut(bye), run_time=1.0)
        self.wait(0.4)


CLIP_TITLE_RO = "Mulțimi de numere — clasa a IX-a"
CLIP_TITLE_EN = "Sets of numbers — grade 9"
