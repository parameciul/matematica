"""Clip 6 of the grade 9 lesson "Numere reale, modul, parte întreagă".

Covers section 4.4, "Ecuații cu parte întreagă și parte fracționară": the basic method
[E(x)] = k, with k an integer, turned into the double inequality k <= E(x) < k + 1 (and no
solution when the right-hand side is not an integer). The worked example is
[(x - 1) / 2] = 3, solved step by step and read on an axis before the solution set
S = [7, 9) is written.

On the axis the ends are drawn with the same signs as the notation, [ ] and ( ), the way
the students write them in their notebooks.

Spoken in Romanian, captioned in Romanian and English. Like every clip, it stands alone: it
never mentions what the previous clip covered or what the next one will.

Render:
    uv run manim render -ql scenes/.../06-ecuatii-parte-intreaga.py EcuatiiParteIntreaga   (draft)
    uv run manim render -qh scenes/.../06-ecuatii-parte-intreaga.py EcuatiiParteIntreaga   (final)
"""
import sys
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    PI,
    RIGHT,
    UP,
    ArcBetweenPoints,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    Line,
    MathTex,
    NumberLine,
    Transform,
    VGroup,
    VMobject,
    Write,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from bilingual import BilingualVoiceoverScene  # noqa: E402
from edge_tts_service import EdgeTTSService  # noqa: E402
from theme import (  # noqa: E402
    INK,
    MARKER,
    MATH_COLOR,
    MUTED,
    RED,
    TEXT,
    caption,
    ro,
    title,
)

VOICE = "ro-RO-AlinaNeural"
# The same pace as the other clips of the lesson, so they sound alike.
RATE = "-8%"
# Extra silence after each sentence, so the viewer can take in one idea before the next.
# Longer than in the earlier clips: a new method needs a moment to settle.
SENTENCE_PAUSE = 1.4


def end_mark(point, closed, side, color, height=0.44):
    """The end of an interval drawn as its bracket: [ or ] when the end belongs to the
    interval, ( or ) when it does not.

    `side` is "left" or "right": which end of the interval `point` is. The bracket opens
    towards the inside of the interval.
    """
    half = height / 2
    inward = RIGHT if side == "left" else LEFT
    if closed:
        bracket = VMobject(stroke_color=color, stroke_width=5)
        bracket.set_points_as_corners(
            [
                point + UP * half + inward * 0.13,
                point + UP * half,
                point + DOWN * half,
                point + DOWN * half + inward * 0.13,
            ]
        )
    else:
        # The chord sits a little inside the interval, so the curve bulges back out to the
        # end itself. An arc from top to bottom bulges left, from bottom to top it bulges right.
        top = point + UP * half + inward * 0.1
        bottom = point + DOWN * half + inward * 0.1
        start, end = (top, bottom) if side == "left" else (bottom, top)
        bracket = ArcBetweenPoints(start, end, angle=PI / 2, color=color, stroke_width=5)
    return bracket.set_z_index(3)


class EcuatiiParteIntreaga(BilingualVoiceoverScene):
    # A longer pause after each idea than the base scene leaves, so the student has a
    # moment with the picture before the next idea starts.
    idea_pause = 1.5

    def construct(self):
        self.set_speech_service(
            EdgeTTSService(voice=VOICE, rate=RATE, sentence_pause=SENTENCE_PAUSE),
            create_subcaption=True,
        )
        self.opening()
        self.metoda()
        self.exemplu()
        self.closing()
        self.write_english_subtitles()

    # ------------------------------------------------------------------ opening

    def opening(self):
        head = title("Ecuații cu parte întreagă")
        sub = caption("Clasa a IX-a · Numere reale")
        VGroup(head, sub).arrange(DOWN, buff=0.45)
        with self.say(
            ro=(
                "Partea întreagă apare des în ecuații, iar metoda de rezolvare rămâne "
                "mereu aceeași. "
                "<bookmark mark='sub'/> La final rezolvăm împreună un exemplu, pas cu pas."
            ),
            en=(
                "The integer part often shows up in equations, "
                "and the solving method always stays the same. "
                "At the end we solve one example together, step by step."
            ),
        ) as t:
            self.play(FadeIn(head, shift=UP * 0.3), run_time=1.2)
            self.wait_until_bookmark("sub")
            self.play(FadeIn(sub), run_time=0.8)
            self.wait(t.get_remaining_duration())
        self.play(FadeOut(head), FadeOut(sub), run_time=0.6)

    # ------------------------------------------------------------------- metoda

    def metoda(self):
        head = title("Metoda").to_edge(UP, buff=0.8)
        rule = MathTex(
            r"[E(x)]=k\ \Leftrightarrow\ k\le E(x)<k+1", color=MATH_COLOR
        ).scale(1.2)
        rule.next_to(head, DOWN, buff=0.6)
        cond = ro("cu k număr întreg", size=32, color=MUTED)
        cond.next_to(rule, DOWN, buff=0.4)
        empty = MathTex(
            r"\left[E(x)\right]=\frac{5}{2}\ \Rightarrow\ S=\varnothing", color=RED
        ).scale(1.1)
        empty.next_to(cond, DOWN, buff=0.6)
        no = ro("membrul drept nu este întreg: nicio soluție", size=30, color=RED)
        no.next_to(empty, DOWN, buff=0.35)

        with self.say(
            ro=(
                "Pornim de la ideea de bază: dacă partea întreagă dintr-o expresie este "
                "egală cu {k|ka,}, atunci {k|ka,} este mai mic sau egal decât expresia, "
                "iar expresia este mai mică decât {k|ka,} plus unu."
            ),
            en=(
                "We start from the basic idea: if the integer part of an expression "
                "equals k, then k is less than or equal to the expression, "
                "and the expression is less than k plus one."
            ),
        ) as t:
            self.play(FadeIn(head), Write(rule), run_time=1.5)
            self.play(FadeIn(cond), run_time=0.6)
            self.wait(t.get_remaining_duration())

        # The condition gets its own block, so the student meets one idea at a time
        # instead of reading everything up front.
        with self.say(
            ro=(
                "Atenție la condiție: {k|ka,} trebuie să fie număr întreg. "
                "Dacă membrul drept nu este întreg, ecuația nu are nicio soluție."
            ),
            en=(
                "Mind the condition: k must be an integer. "
                "If the right-hand side is not an integer, the equation has no solution."
            ),
        ) as t:
            self.play(Write(empty), FadeIn(no), run_time=1.4)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(rule), FadeOut(cond), FadeOut(empty), FadeOut(no), run_time=0.6)
        self.head = head

    # ------------------------------------------------------------------ exemplu

    def exemplu(self):
        head2 = title("Exemplu").to_edge(UP, buff=0.8)
        question = MathTex(r"\left[\frac{x-1}{2}\right]=3", color=MATH_COLOR).scale(1.4)
        question.next_to(head2, DOWN, buff=0.45)

        step1 = MathTex(r"3\le\frac{x-1}{2}<4", color=MATH_COLOR).scale(1.1)
        step2a = MathTex(r"6\le x-1<8", color=MATH_COLOR).scale(1.1)
        step2b = MathTex(r"\Rightarrow\ 7\le x<9", color=MATH_COLOR).scale(1.1)
        steprow = VGroup(step2a, step2b).arrange(RIGHT, buff=0.3)
        steps = VGroup(step1, steprow).arrange(DOWN, buff=0.4, aligned_edge=LEFT)
        steps.next_to(question, DOWN, buff=0.4)

        line = NumberLine(
            x_range=[5, 10, 1],
            length=9,
            include_numbers=True,
            color=MUTED,
            font_size=28,
        )
        line.numbers.set_color(TEXT)
        line.move_to(DOWN * 1.4)

        lo, hi = 7, 9
        start, end = line.n2p(lo) + UP * 0.55, line.n2p(hi) + UP * 0.55
        bar = Line(start, end, color=INK, stroke_width=7).set_z_index(2)
        band = VGroup(bar, end_mark(start, True, "left", INK), end_mark(end, False, "right", INK))

        # First what we work out, then the steps, then the picture, then the value: the
        # equation is on screen before it is read, and the solution set comes last.
        sol = MathTex(r"S=[7,\ 9)", color=INK).scale(1.3)
        sol.to_edge(DOWN, buff=0.4)

        with self.say(
            ro=(
                "Să rezolvăm un exemplu: partea întreagă din {x|ics,} minus unu supra doi "
                "este egală cu trei. "
                "<bookmark mark='ineq'/> Aplicăm metoda: trei este mai mic sau egal decât "
                "fracția, iar fracția este mai mică decât patru. "
                "<bookmark mark='a'/> Înmulțim cu doi: obținem șase mai mic sau egal decât "
                "{x|ics,} minus unu, iar {x|ics,} minus unu mai mic decât opt. "
                "<bookmark mark='b'/> Adunăm unu și obținem șapte mai mic sau egal decât "
                "{x|ics,}, iar {x|ics,} mai mic decât nouă. "
                "<bookmark mark='res'/> Pe axă, soluțiile formează intervalul de la șapte, "
                "închis, până la nouă, deschis."
            ),
            en=(
                "Let us solve one example: the integer part of x minus one over two "
                "equals three. "
                "We apply the method: three is less than or equal to the fraction, "
                "and the fraction is less than four. "
                "We multiply by two: we get six less than or equal to x minus one, "
                "and x minus one less than eight. "
                "We add one and we get seven less than or equal to x, "
                "and x less than nine. "
                "On the number line, the solutions form the interval "
                "from seven, closed, to nine, open."
            ),
        ) as t:
            # The title changes together with its picture: the method must not sit under
            # the example title.
            self.play(Transform(self.head, head2), Write(question), run_time=1.3)
            self.wait_until_bookmark("ineq")
            self.play(Write(step1), run_time=1.2)
            # Each algebra step appears exactly when the voice works it out: first the
            # multiplication by two, then adding one.
            self.wait_until_bookmark("a")
            self.play(Write(step2a), run_time=1.2)
            self.wait_until_bookmark("b")
            self.play(Write(step2b), run_time=1.2)
            self.wait_until_bookmark("res")
            # The algebra leaves before the geometry arrives: with the question, the
            # steps and the axis all on screen at once, the line would cross the text.
            self.play(FadeOut(steps), run_time=0.5)
            self.play(Create(line), run_time=1.0)
            self.play(Create(band), run_time=1.1)
            self.play(Write(sol), run_time=1.1)
            self.wait(t.get_remaining_duration())

        self.play(
            FadeOut(line),
            FadeOut(band),
            FadeOut(question),
            FadeOut(sol),
            run_time=0.7,
        )

    # ------------------------------------------------------------------- final

    def closing(self):
        head3 = title("De reținut").to_edge(UP, buff=0.8)
        rows = VGroup(
            VGroup(
                MathTex(r"[E(x)]=k\Leftrightarrow k\le E(x)<k+1", color=INK).scale(0.95),
                ro("dubla inegalitate dintre număr și următorul", size=32),
            ),
            VGroup(
                MathTex(r"S=[7,\ 9)", color=INK).scale(1.2),
                ro("soluțiile se scriu ca interval", size=32),
            ),
        )
        for row in rows:
            row.arrange(DOWN, buff=0.25, aligned_edge=LEFT)
        rows.arrange(DOWN, buff=0.6, aligned_edge=LEFT)
        rows.move_to(DOWN * 0.2)
        underline = Line(
            rows[0][1].get_corner(DOWN + LEFT),
            rows[0][1].get_corner(DOWN + RIGHT),
            color=MARKER,
            stroke_width=14,
            stroke_opacity=0.85,
        ).shift(DOWN * 0.12).set_z_index(-1)

        with self.say(
            ro=(
                "Să reținem. "
                "<bookmark mark='a'/> Când partea întreagă dintr-o expresie este egală cu "
                "un număr întreg, scriem dubla inegalitate dintre acel număr și următorul. "
                "<bookmark mark='b'/> Rezolvăm inegalitatea obținută, iar soluțiile se scriu "
                "sub formă de interval. "
                "Pe curând!"
            ),
            en=(
                "Let us remember. "
                "When the integer part of an expression equals an integer, "
                "we write the double inequality between that number and the next one. "
                "We solve the inequality we get, and we write the solutions as an interval. "
                "See you soon!"
            ),
        ) as t:
            self.play(Transform(self.head, head3), run_time=0.9)
            for mark, index in (("a", 0), ("b", 1)):
                self.wait_until_bookmark(mark)
                self.play(FadeIn(rows[index]), run_time=1.0)
            self.play(FadeIn(underline), run_time=0.6)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(self.head), FadeOut(rows), FadeOut(underline), run_time=1.0)
        self.wait(0.4)


CLIP_TITLE_RO = "Ecuații cu parte întreagă și parte fracționară — clasa a IX-a"
CLIP_TITLE_EN = "Equations with integer and fractional part — grade 9"
