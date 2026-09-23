"""Clip 2 of the grade 9 lesson "Numere reale, modul, parte întreagă".

Covers section 2, "Relația de ordine pe ℝ. Intervale": the properties of inequalities, the
four kinds of intervals, the worked example with A = [-2, 3) and B = (1, 5], and the rule
that an interval is always open at infinity.

Spoken in Romanian, captioned in Romanian and English.

Render:
    uv run manim render -ql scenes/.../02-relatia-de-ordine-intervale.py RelatiaDeOrdine   (draft)
    uv run manim render -qh scenes/.../02-relatia-de-ordine-intervale.py RelatiaDeOrdine   (final)
"""
import sys
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Circle,
    Create,
    Cross,
    Dot,
    FadeIn,
    FadeOut,
    Line,
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
    PAPER,
    RED,
    TEXT,
    caption,
    ro,
    title,
)

VOICE = "ro-RO-AlinaNeural"
# The same pace as clip 1, so the clips of one lesson sound alike.
RATE = "-8%"

# The x positions of the three columns in the interval table: notation, set, picture.
COL_NOTATION = -5.3
COL_SET = -1.3
COL_AXIS = 3.9


def end_mark(point, closed, color):
    """A filled dot for an end that belongs to the interval, a hollow ring for one that does not."""
    if closed:
        return Dot(point, radius=0.1, color=color).set_z_index(3)
    ring = Circle(radius=0.1, color=color, stroke_width=4).move_to(point)
    # The paper fill hides the segment under the ring, so the end reads as "left out".
    return ring.set_fill(PAPER, opacity=1).set_z_index(3)


def interval_picture(left, right, names, width=4.4):
    """A small axis with one interval on it.

    `left` and `right` are "closed", "open" or "inf". `names` are the labels of the numeric
    ends, left to right.
    """
    half = width / 2
    axis = Line(LEFT * half, RIGHT * half, color=MUTED, stroke_width=3)
    axis.add_tip(tip_length=0.2, tip_width=0.2)
    axis.get_tip().set_color(MUTED)

    if left != "inf" and right != "inf":
        xs = [-0.25 * width, 0.25 * width]
    elif left == "inf":
        xs = [0.15 * width]
    else:
        xs = [-0.15 * width]
    start = LEFT * (half - 0.05) if left == "inf" else RIGHT * xs[0]
    end = RIGHT * (half - 0.25) if right == "inf" else RIGHT * xs[-1]
    segment = Line(start, end, color=INK, stroke_width=8).set_z_index(2)

    parts = VGroup(axis, segment)
    for x, name in zip(xs, names):
        parts.add(Line(RIGHT * x + UP * 0.12, RIGHT * x + DOWN * 0.12, color=MUTED, stroke_width=3))
        parts.add(MathTex(name, color=TEXT).scale(0.8).move_to(RIGHT * x + DOWN * 0.45))
    if left != "inf":
        parts.add(end_mark(start, left == "closed", INK))
    if right != "inf":
        parts.add(end_mark(end, right == "closed", INK))
    return parts


def interval_row(notation, members, left, right, names, y):
    """One line of the interval table: the notation, the set it stands for, and its picture."""
    note = MathTex(notation, color=INK).scale(0.95).move_to([COL_NOTATION, y, 0])
    body = MathTex(members, color=MATH_COLOR).scale(0.85).move_to([COL_SET, y, 0])
    picture = interval_picture(left, right, names).move_to([COL_AXIS, y - 0.1, 0])
    return VGroup(note, body, picture)


class RelatiaDeOrdine(BilingualVoiceoverScene):
    def construct(self):
        self.set_speech_service(
            EdgeTTSService(voice=VOICE, rate=RATE), create_subcaption=True
        )
        self.opening()
        self.adunare()
        self.inmultire()
        self.inverse_patrate()
        self.intervale()
        self.exemplu()
        self.infinit()
        self.closing()
        self.write_english_subtitles()

    # ------------------------------------------------------------------ opening

    def opening(self):
        head = title("Relația de ordine. Intervale")
        sub = caption("Clasa a IX-a · Numere reale")
        VGroup(head, sub).arrange(DOWN, buff=0.45)
        with self.say(
            ro=(
                "Bine ați revenit! În clipul trecut am recapitulat mulțimile de numere. "
                "<bookmark mark='sub'/> Acum vorbim despre relația de ordine pe mulțimea "
                "numerelor reale și despre intervale."
            ),
            en=(
                "Welcome back! In the last clip we reviewed the sets of numbers. "
                "Now we talk about the order relation on the set of real numbers "
                "and about intervals."
            ),
        ) as t:
            self.play(FadeIn(head, shift=UP * 0.3), run_time=1.2)
            self.wait_until_bookmark("sub")
            self.play(FadeIn(sub), run_time=0.8)
            self.wait(t.get_remaining_duration())
        self.play(FadeOut(head), FadeOut(sub), run_time=0.6)

    # ---------------------------------------------------------- adunare, tranzitivitate

    def adunare(self):
        head = title("Proprietăți ale inegalităților").to_edge(UP, buff=0.8)
        given = MathTex(r"a,\ b,\ c,\ d\in\mathbb{R}", color=MUTED).scale(0.9)
        given.next_to(head, DOWN, buff=0.4)

        rows = VGroup(
            MathTex(r"a\le b,\ \ b\le c\ \Rightarrow\ a\le c", color=MATH_COLOR),
            MathTex(r"a\le b\ \Rightarrow\ a+c\le b+c", color=MATH_COLOR),
            MathTex(r"a\le b,\ \ c\le d\ \Rightarrow\ a+c\le b+d", color=MATH_COLOR),
        ).scale(1.1).arrange(DOWN, buff=0.9, aligned_edge=LEFT)
        notes = VGroup(
            caption("tranzitivitate").next_to(rows[0], RIGHT, buff=0.7),
            caption("adunăm același număr").next_to(rows[1], RIGHT, buff=0.7),
            caption("se adună membru cu membru").next_to(rows[2], RIGHT, buff=0.7),
        )
        # The notes of the three rows start on one vertical line.
        left_edge = max(note.get_left()[0] for note in notes)
        for note in notes:
            note.shift(RIGHT * (left_edge - note.get_left()[0]))
        # The rows and their notes sit as one block in the free space under the title.
        VGroup(rows, notes).move_to(DOWN * 0.5)

        with self.say(
            ro=(
                "Pentru orice numere reale a, b, c și d avem câteva reguli. "
                "<bookmark mark='a'/> Prima este tranzitivitatea: dacă a este mai mic sau egal cu b, "
                "iar b este mai mic sau egal cu c, atunci a este mai mic sau egal cu c. "
                "<bookmark mark='b'/> Putem aduna același număr în ambii membri, "
                "iar inegalitatea se păstrează. "
                "<bookmark mark='c'/> Și putem aduna două inegalități de același sens, "
                "membru cu membru."
            ),
            en=(
                "For any real numbers a, b, c and d we have a few rules. "
                "The first is transitivity: if a is less than or equal to b, "
                "and b is less than or equal to c, then a is less than or equal to c. "
                "We can add the same number to both sides, "
                "and the inequality still holds. "
                "And we can add two inequalities that point the same way, "
                "side by side."
            ),
        ) as t:
            self.play(FadeIn(head), FadeIn(given), run_time=0.9)
            for mark, index in (("a", 0), ("b", 1), ("c", 2)):
                self.wait_until_bookmark(mark)
                self.play(Write(rows[index]), run_time=1.3)
                self.play(FadeIn(notes[index]), run_time=0.6)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(rows), FadeOut(notes), run_time=0.6)
        self.head, self.given = head, given

    # ---------------------------------------------------------------- înmulțire

    def inmultire(self):
        rows = VGroup(
            MathTex(r"a\le b,\ \ c>0\ \Rightarrow\ ac\le bc", color=MATH_COLOR),
            MathTex(r"a\le b,\ \ c<0\ \Rightarrow\ ac", r"\ge", r"bc", color=MATH_COLOR),
        ).scale(1.1).arrange(DOWN, buff=0.9, aligned_edge=LEFT)
        rows[1][1].set_color(RED)
        warning = ro("se schimbă sensul inegalității!", size=30, color=RED, weight="BOLD")
        warning.next_to(rows[1], DOWN, buff=0.35).align_to(rows, LEFT)

        sample = VGroup(
            MathTex(r"2<3", color=MATH_COLOR),
            MathTex(r"\big|\cdot(-1)", color=MUTED),
            MathTex(r"\Rightarrow", color=MATH_COLOR),
            MathTex(r"-2", r">", r"-3", color=MATH_COLOR),
        ).scale(1.1).arrange(RIGHT, buff=0.35)
        sample[3][1].set_color(RED)
        sample.next_to(warning, DOWN, buff=0.8).align_to(rows, LEFT)
        VGroup(rows, warning, sample).move_to(DOWN * 0.5)

        with self.say(
            ro=(
                "Acum înmulțim. <bookmark mark='a'/> Dacă înmulțim ambii membri cu un număr "
                "strict pozitiv, inegalitatea se păstrează. "
                "<bookmark mark='b'/> Dacă înmulțim cu un număr strict negativ, "
                "<bookmark mark='warn'/> se schimbă sensul inegalității! "
                "<bookmark mark='ex'/> De exemplu, doi este mai mic decât trei, "
                "dar minus doi este mai mare decât minus trei."
            ),
            en=(
                "Now we multiply. If we multiply both sides by a strictly positive "
                "number, the inequality still holds. "
                "If we multiply by a strictly negative number, "
                "the inequality changes direction! "
                "For example, two is less than three, "
                "but minus two is greater than minus three."
            ),
        ) as t:
            self.wait_until_bookmark("a")
            self.play(Write(rows[0]), run_time=1.3)
            self.wait_until_bookmark("b")
            self.play(Write(rows[1]), run_time=1.3)
            self.wait_until_bookmark("warn")
            self.play(FadeIn(warning, shift=LEFT * 0.2), run_time=0.8)
            self.wait_until_bookmark("ex")
            self.play(FadeIn(sample, lag_ratio=0.3), run_time=1.6)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(rows), FadeOut(warning), FadeOut(sample), run_time=0.6)

    # ---------------------------------------------------- inverse și pătrate

    def inverse_patrate(self):
        rows = VGroup(
            MathTex(r"0<a\le b\ \Rightarrow\ \frac{1}{a}\ge\frac{1}{b}", color=MATH_COLOR),
            MathTex(r"x^{2}\ge 0\ \ \text{pentru orice}\ x\in\mathbb{R}", color=MATH_COLOR),
            MathTex(r"x^{2}=0\ \Leftrightarrow\ x=0", color=MATH_COLOR),
        ).scale(1.2).arrange(DOWN, buff=0.8, aligned_edge=LEFT)
        rows.move_to(DOWN * 0.5)

        with self.say(
            ro=(
                "Pentru numere strict pozitive, inversele schimbă ordinea: "
                "dacă a este mai mic sau egal cu b, atunci unu supra a este mai mare "
                "sau egal cu unu supra b. "
                "<bookmark mark='b'/> Și nu uitați: pătratul oricărui număr real este "
                "mai mare sau egal cu zero, "
                "<bookmark mark='c'/> iar el este egal cu zero doar când numărul este zero."
            ),
            en=(
                "For strictly positive numbers, the inverses swap the order: "
                "if a is less than or equal to b, then one over a is greater "
                "than or equal to one over b. "
                "And do not forget: the square of any real number is "
                "greater than or equal to zero, "
                "and it equals zero only when the number is zero."
            ),
        ) as t:
            self.play(Write(rows[0]), run_time=1.3)
            for mark, index in (("b", 1), ("c", 2)):
                self.wait_until_bookmark(mark)
                self.play(Write(rows[index]), run_time=1.3)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(rows), FadeOut(self.given), run_time=0.6)

    # ---------------------------------------------------------------- intervale

    def intervale(self):
        head2 = title("Intervale de numere reale").to_edge(UP, buff=0.8)
        given = MathTex(r"a,\ b\in\mathbb{R},\ \ a<b", color=MUTED).scale(0.9)
        given.next_to(head2, DOWN, buff=0.4)

        def kind(text):
            return ro(text, size=34, color=INK, weight="BOLD").next_to(given, DOWN, buff=0.45)

        member = r"\{x\in\mathbb{R}\ \mid\ "

        closed = interval_row(r"[a,\ b]", member + r"a\le x\le b\}", "closed", "closed", "ab", 0.0)
        opened = interval_row(r"(a,\ b)", member + r"a<x<b\}", "open", "open", "ab", 0.0)
        half = VGroup(
            interval_row(r"[a,\ b)", member + r"a\le x<b\}", "closed", "open", "ab", 0.5),
            interval_row(r"(a,\ b]", member + r"a<x\le b\}", "open", "closed", "ab", -1.1),
        )
        rays = VGroup(
            interval_row(r"[a,\ +\infty)", member + r"x\ge a\}", "closed", "inf", "a", 0.55),
            interval_row(r"(a,\ +\infty)", member + r"x>a\}", "open", "inf", "a", -0.55),
            interval_row(r"(-\infty,\ b]", member + r"x\le b\}", "inf", "closed", "b", -1.65),
            interval_row(r"(-\infty,\ b)", member + r"x<b\}", "inf", "open", "b", -2.75),
        )

        with self.say(
            ro=(
                "Trecem la intervale. Fie a și b două numere reale, cu a mai mic decât b. "
                "<bookmark mark='closed'/> Intervalul închis de la a la b conține toate "
                "numerele reale dintre a și b, inclusiv capetele. "
                "<bookmark mark='dots'/> Pe axă, punctele pline arată că a și b "
                "aparțin intervalului."
            ),
            en=(
                "We move on to intervals. Let a and b be two real numbers, with a less than b. "
                "The closed interval from a to b holds all the "
                "real numbers between a and b, the ends included. "
                "On the number line, the filled dots show that a and b "
                "belong to the interval."
            ),
        ) as t:
            self.play(Transform(self.head, head2), run_time=0.9)
            self.play(FadeIn(given), run_time=0.6)
            label = kind("Interval închis")
            self.wait_until_bookmark("closed")
            self.play(FadeIn(label), Write(closed[0]), Write(closed[1]), run_time=1.4)
            self.wait_until_bookmark("dots")
            self.play(Create(closed[2]), run_time=1.4)
            self.wait(t.get_remaining_duration())

        with self.say(
            ro=(
                "Intervalul deschis de la a la b are aceleași numere, "
                "dar fără capete. "
                "<bookmark mark='rings'/> Cercurile goale arată că a și b nu aparțin intervalului."
            ),
            en=(
                "The open interval from a to b has the same numbers, "
                "but without the ends. "
                "The hollow circles show that a and b do not belong to the interval."
            ),
        ) as t:
            label2 = kind("Interval deschis")
            self.play(
                Transform(label, label2),
                FadeOut(closed),
                FadeIn(opened[0]),
                FadeIn(opened[1]),
                run_time=1.0,
            )
            self.wait_until_bookmark("rings")
            self.play(Create(opened[2]), run_time=1.4)
            self.wait(t.get_remaining_duration())

        with self.say(
            ro=(
                "Un interval semideschis păstrează un singur capăt: "
                "<bookmark mark='l'/> fie pe cel din stânga, "
                "<bookmark mark='r'/> fie pe cel din dreapta."
            ),
            en=(
                "A half-open interval keeps only one end: "
                "either the left one, "
                "or the right one."
            ),
        ) as t:
            self.play(Transform(label, kind("Interval semideschis")), FadeOut(opened), run_time=1.0)
            self.wait_until_bookmark("l")
            self.play(FadeIn(half[0]), run_time=1.0)
            self.wait_until_bookmark("r")
            self.play(FadeIn(half[1]), run_time=1.0)
            self.wait(t.get_remaining_duration())

        with self.say(
            ro=(
                "Un interval nemărginit continuă la nesfârșit într-o parte. "
                "<bookmark mark='plus'/> Spre plus infinit, el pornește din a, "
                "cu a inclus sau nu. "
                "<bookmark mark='minus'/> Spre minus infinit, el se oprește în b, "
                "cu b inclus sau nu."
            ),
            en=(
                "An unbounded interval goes on forever to one side. "
                "Towards plus infinity, it starts at a, "
                "with a included or not. "
                "Towards minus infinity, it stops at b, "
                "with b included or not."
            ),
        ) as t:
            self.play(Transform(label, kind("Interval nemărginit")), FadeOut(half), run_time=1.0)
            self.wait_until_bookmark("plus")
            self.play(FadeIn(rays[0]), run_time=0.9)
            self.play(FadeIn(rays[1]), run_time=0.9)
            self.wait_until_bookmark("minus")
            self.play(FadeIn(rays[2]), run_time=0.9)
            self.play(FadeIn(rays[3]), run_time=0.9)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(rays), FadeOut(label), FadeOut(given), run_time=0.7)

    # ------------------------------------------------------------------ exemplu

    def exemplu(self):
        head3 = title("Exemplu").to_edge(UP, buff=0.8)
        sets = MathTex(
            r"A=[-2,\ 3)", r",\qquad ", r"B=(1,\ 5]", color=MATH_COLOR
        ).scale(1.15)
        sets[0].set_color(INK)
        sets[2].set_color(GREEN)
        sets.next_to(head3, DOWN, buff=0.5)

        line = NumberLine(
            x_range=[-3, 6, 1],
            length=11,
            include_numbers=True,
            color=MUTED,
            font_size=30,
        )
        line.numbers.set_color(TEXT)
        line.move_to(DOWN * 0.1)

        def band(lo, hi, lo_closed, hi_closed, lift, color, name):
            start, end = line.n2p(lo) + UP * lift, line.n2p(hi) + UP * lift
            bar = Line(start, end, color=color, stroke_width=7).set_z_index(2)
            tag = MathTex(name, color=color).scale(0.9).next_to(bar, LEFT, buff=0.3)
            return VGroup(bar, end_mark(start, lo_closed, color), end_mark(end, hi_closed, color), tag)

        band_a = band(-2, 3, True, False, 0.55, INK, "A")
        band_b = band(1, 5, False, True, 1.1, GREEN, "B")

        def highlight(lo, hi, lo_closed, hi_closed):
            # A highlighter stroke laid on the axis, under its ticks, with the ends marked
            # on the axis itself.
            start, end = line.n2p(lo), line.n2p(hi)
            stroke = Line(start, end, color=MARKER, stroke_width=22, stroke_opacity=0.9)
            stroke.set_z_index(-1)
            return VGroup(stroke, end_mark(start, lo_closed, RED), end_mark(end, hi_closed, RED))

        results = VGroup(
            MathTex(r"A\cap B=(1,\ 3)", color=MATH_COLOR),
            MathTex(r"A\cup B=[-2,\ 5]", color=MATH_COLOR),
            MathTex(r"A\smallsetminus B=[-2,\ 1]", color=MATH_COLOR),
            MathTex(r"B\smallsetminus A=[3,\ 5]", color=MATH_COLOR),
        ).scale(1.0)
        results.arrange_in_grid(rows=2, cols=2, buff=(1.6, 0.45), col_alignments="ll")
        results.to_edge(DOWN, buff=0.45)

        with self.say(
            ro=(
                "Să facem un exemplu. "
                "<bookmark mark='sets'/> Fie A intervalul de la minus doi, închis, "
                "până la trei, deschis, și B intervalul de la unu, deschis, până la cinci, închis. "
                "<bookmark mark='a'/> Desenăm A pe axă, "
                "<bookmark mark='b'/> apoi pe B, deasupra lui."
            ),
            en=(
                "Let us work through an example. "
                "Let A be the interval from minus two, closed, "
                "to three, open, and B the interval from one, open, to five, closed. "
                "We draw A on the number line, "
                "then B, above it."
            ),
        ) as t:
            self.play(Transform(self.head, head3), run_time=0.9)
            self.wait_until_bookmark("sets")
            self.play(Write(sets), run_time=1.6)
            self.play(Create(line), run_time=1.0)
            self.wait_until_bookmark("a")
            self.play(Create(band_a), run_time=1.2)
            self.wait_until_bookmark("b")
            self.play(Create(band_b), run_time=1.2)
            self.wait(t.get_remaining_duration())

        steps = [
            (
                (1, 3, False, False),
                (
                    "Intersecția conține numerele care sunt în ambele "
                    "mulțimi: de la unu la trei. "
                    "<bookmark mark='ends'/> Unu nu este în B, iar trei nu este în A, "
                    "deci ambele capete sunt deschise. "
                    "<bookmark mark='res'/> A intersectat cu B este intervalul deschis "
                    "de la unu la trei."
                ),
                (
                    "The intersection holds the numbers that are in both "
                    "sets: from one to three. "
                    "One is not in B, and three is not in A, "
                    "so both ends are open. "
                    "A intersected with B is the open interval "
                    "from one to three."
                ),
            ),
            (
                (-2, 5, True, True),
                (
                    "Reuniunea conține numerele din cel puțin una "
                    "dintre mulțimi: de la minus doi la cinci. "
                    "<bookmark mark='ends'/> Minus doi este în A, iar cinci este în B, "
                    "deci ambele capete sunt incluse. "
                    "<bookmark mark='res'/> A reunit cu B este intervalul închis "
                    "de la minus doi la cinci."
                ),
                (
                    "The union holds the numbers that are in at least one "
                    "of the sets: from minus two to five. "
                    "Minus two is in A, and five is in B, "
                    "so both ends are included. "
                    "A union B is the closed interval "
                    "from minus two to five."
                ),
            ),
            (
                (-2, 1, True, True),
                (
                    "A minus B păstrează numerele din A care nu sunt "
                    "în B: de la minus doi la unu. "
                    "<bookmark mark='ends'/> Unu rămâne inclus, pentru că B nu îl conține. "
                    "<bookmark mark='res'/> Obținem intervalul închis de la minus doi la unu."
                ),
                (
                    "A minus B keeps the numbers of A that are not "
                    "in B: from minus two to one. "
                    "One stays included, because B does not contain it. "
                    "We get the closed interval from minus two to one."
                ),
            ),
            (
                (3, 5, True, True),
                (
                    "B minus A păstrează numerele din B care nu sunt "
                    "în A: de la trei la cinci. "
                    "<bookmark mark='ends'/> Trei este inclus, pentru că A nu îl conține. "
                    "<bookmark mark='res'/> Obținem intervalul închis de la trei la cinci."
                ),
                (
                    "B minus A keeps the numbers of B that are not "
                    "in A: from three to five. "
                    "Three is included, because A does not contain it. "
                    "We get the closed interval from three to five."
                ),
            ),
        ]

        shown = None
        for index, ((lo, hi, lo_closed, hi_closed), ro_text, en_text) in enumerate(steps):
            mark = highlight(lo, hi, lo_closed, hi_closed)
            with self.say(ro=ro_text, en=en_text) as t:
                if shown is None:
                    self.play(FadeIn(mark[0]), run_time=0.9)
                else:
                    self.play(FadeOut(shown), FadeIn(mark[0]), run_time=0.9)
                self.wait_until_bookmark("ends")
                self.play(FadeIn(mark[1]), FadeIn(mark[2]), run_time=0.8)
                self.wait_until_bookmark("res")
                self.play(Write(results[index]), run_time=1.2)
                self.wait(t.get_remaining_duration())
            shown = mark

        self.play(
            FadeOut(shown),
            FadeOut(band_a),
            FadeOut(band_b),
            FadeOut(line),
            FadeOut(sets),
            FadeOut(results),
            run_time=0.8,
        )

    # ------------------------------------------------------------------ infinit

    def infinit(self):
        head4 = title("Atenție la infinit").to_edge(UP, buff=0.8)
        right = MathTex(r"[a,\ +\infty)", color=GREEN).scale(1.6)
        wrong = MathTex(r"[a,\ +\infty]", color=RED).scale(1.6)
        pair = VGroup(right, wrong).arrange(RIGHT, buff=3.0).move_to(UP * 0.4)
        yes = ro("corect", size=30, color=GREEN, weight="BOLD").next_to(right, DOWN, buff=0.5)
        no = ro("greșit", size=30, color=RED, weight="BOLD").next_to(wrong, DOWN, buff=0.5)
        cross = Cross(wrong, stroke_color=RED, stroke_width=6)
        reason = caption("Infinitul nu este un număr, deci nu aparține intervalului.")
        reason.to_edge(DOWN, buff=1.0)

        with self.say(
            ro=(
                "Încă o regulă importantă. "
                "<bookmark mark='rule'/> La plus infinit sau la minus infinit, "
                "intervalul este întotdeauna deschis. "
                "<bookmark mark='ok'/> Scriem paranteză rotundă lângă infinit, "
                "<bookmark mark='no'/> niciodată paranteză dreaptă. "
                "<bookmark mark='why'/> Infinitul nu este un număr, deci nu poate aparține intervalului."
            ),
            en=(
                "One more important rule. "
                "At plus infinity or at minus infinity, "
                "the interval is always open. "
                "We write a round bracket next to infinity, "
                "never a square bracket. "
                "Infinity is not a number, so it cannot belong to the interval."
            ),
        ) as t:
            self.play(Transform(self.head, head4), run_time=0.9)
            self.wait_until_bookmark("ok")
            self.play(Write(right), FadeIn(yes), run_time=1.2)
            self.wait_until_bookmark("no")
            self.play(Write(wrong), run_time=1.0)
            self.play(Create(cross), FadeIn(no), run_time=0.8)
            self.wait_until_bookmark("why")
            self.play(FadeIn(reason), run_time=0.8)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(VGroup(right, wrong, yes, no, cross, reason)), run_time=0.7)

    # ------------------------------------------------------------------ final

    def closing(self):
        head5 = title("De reținut").to_edge(UP, buff=0.8)
        first = VGroup(
            MathTex(r"c<0:", color=MATH_COLOR),
            MathTex(r"a\le b\ \Rightarrow\ ac", r"\ge", r"bc", color=MATH_COLOR),
        ).scale(1.3).arrange(RIGHT, buff=0.4)
        first[1][1].set_color(RED)
        second = MathTex(r"(-\infty,\ b],\qquad [a,\ +\infty)", color=MATH_COLOR).scale(1.3)
        points = VGroup(first, second).arrange(DOWN, buff=1.0).move_to(UP * 0.4)
        underline = Rectangle(width=first.width + 0.6, height=0.22, color=MARKER, stroke_width=0)
        underline.set_fill(MARKER, opacity=0.85)
        underline.next_to(first, DOWN, buff=0.18)
        bye = caption("În clipul următor: modulul unui număr real.")
        bye.to_edge(DOWN, buff=0.9)

        with self.say(
            ro=(
                "Să reținem două idei. "
                "<bookmark mark='a'/> Când înmulțim cu un număr negativ, se schimbă "
                "sensul inegalității. "
                "<bookmark mark='b'/> Și la infinit, intervalul este mereu deschis. "
                "<bookmark mark='bye'/> În clipul următor continuăm cu modulul unui număr real. "
                "Pe curând!"
            ),
            en=(
                "Let us keep two ideas. "
                "When we multiply by a negative number, the inequality "
                "changes direction. "
                "And at infinity, the interval is always open. "
                "In the next clip we continue with the absolute value of a real number. "
                "See you soon!"
            ),
        ) as t:
            self.play(Transform(self.head, head5), run_time=0.9)
            self.wait_until_bookmark("a")
            self.play(Write(first), run_time=1.4)
            self.play(FadeIn(underline), run_time=0.6)
            self.wait_until_bookmark("b")
            self.play(Write(second), run_time=1.4)
            self.wait_until_bookmark("bye")
            self.play(FadeIn(bye), run_time=0.9)
            self.wait(t.get_remaining_duration())

        self.play(
            FadeOut(self.head),
            FadeOut(points),
            FadeOut(underline),
            FadeOut(bye),
            run_time=1.0,
        )
        self.wait(0.4)


CLIP_TITLE_RO = "Relația de ordine pe ℝ. Intervale — clasa a IX-a"
CLIP_TITLE_EN = "The order relation on ℝ. Intervals — grade 9"
