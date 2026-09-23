"""Clip 4 of the grade 9 lesson "Numere reale, modul, parte întreagă".

Covers section 4.1, "Definiții": for any real x there is a single integer k with
k <= x < k + 1, that k is [x], and {x} = x - [x]. The worked example is 2,6, and the
trap is -2,6: cutting the decimals gives -2, but the integer part is -3, while the
fractional part stays in [0, 1).

On every axis the ends are drawn with the same signs as the notation, [ ] and ( ),
the way the students write them in their notebooks. A wrong notation is shown in red
with its label, never crossed out: a cross hides the very thing the student should read.

Spoken in Romanian, captioned in Romanian and English. Like every clip, it stands alone:
it never mentions what the previous clip covered or what the next one will.

Render:
    uv run manim render -ql scenes/.../04-partea-intreaga-definitii.py ParteaIntreagaDefinitii   (draft)
    uv run manim render -qh scenes/.../04-partea-intreaga-definitii.py ParteaIntreagaDefinitii   (final)
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
    GREEN,
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
SENTENCE_PAUSE = 0.8


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


class ParteaIntreagaDefinitii(BilingualVoiceoverScene):
    def construct(self):
        self.set_speech_service(
            EdgeTTSService(voice=VOICE, rate=RATE, sentence_pause=SENTENCE_PAUSE),
            create_subcaption=True,
        )
        self.opening()
        self.definitie()
        self.exemplu()
        self.capcana()
        self.closing()
        self.write_english_subtitles()

    # ------------------------------------------------------------------ opening

    def opening(self):
        head = title("Partea întreagă și partea fracționară")
        sub = caption("Clasa a IX-a · Numere reale")
        VGroup(head, sub).arrange(DOWN, buff=0.45)
        with self.say(
            ro=(
                "Bine ați venit! Astăzi învățăm partea întreagă și partea fracționară "
                "a unui număr real. "
                "<bookmark mark='sub'/> La final reținem ideea principală pentru numerele negative."
            ),
            en=(
                "Welcome! Today we learn the integer part and the fractional part "
                "of a real number. "
                "At the end we remember the main idea for negative numbers."
            ),
        ) as t:
            self.play(FadeIn(head, shift=UP * 0.3), run_time=1.2)
            self.wait_until_bookmark("sub")
            self.play(FadeIn(sub), run_time=0.8)
            self.wait(t.get_remaining_duration())
        self.play(FadeOut(head), FadeOut(sub), run_time=0.6)

    # ----------------------------------------------------------------- definitie

    def definitie(self):
        head = title("Definiții").to_edge(UP, buff=0.8)
        given = MathTex(r"x\in\mathbb{R},\ \ k\in\mathbb{Z}", color=MUTED).scale(0.9)
        given.next_to(head, DOWN, buff=0.4)

        cond = MathTex(r"k\le x<k+1", color=MATH_COLOR).scale(1.4)
        floor_def = MathTex(r"[x]=k", color=INK).scale(1.4)
        frac_def = MathTex(r"\{x\}=x-[x]", color=GREEN).scale(1.4)
        defs = VGroup(floor_def, frac_def).arrange(RIGHT, buff=1.2)
        block = VGroup(cond, defs).arrange(DOWN, buff=0.55)
        block.next_to(given, DOWN, buff=0.6)

        # A schematic axis: k and k + 1 with x sitting between them, the left end
        # included and the right one left out, drawn with the same signs as [k, k + 1).
        axis = Line(LEFT * 4.5, RIGHT * 4.5, color=MUTED, stroke_width=3)
        axis.add_tip(tip_length=0.2, tip_width=0.2)
        axis.get_tip().set_color(MUTED)
        axis.move_to(DOWN * 2.2)
        k_pos = LEFT * 1.6 + DOWN * 2.2
        kp1_pos = RIGHT * 1.6 + DOWN * 2.2
        x_pos = LEFT * 1.6 + (RIGHT * 3.2) * 0.6 + DOWN * 2.2
        segment = Line(k_pos, kp1_pos, color=INK, stroke_width=8).set_z_index(2)
        left_mark = end_mark(k_pos, True, "left", INK)
        right_mark = end_mark(kp1_pos, False, "right", INK)
        dot = Dot(x_pos, color=RED, radius=0.11).set_z_index(4)
        lab_k = MathTex("k", color=TEXT).scale(0.9).next_to(k_pos, DOWN, buff=0.35)
        lab_kp1 = MathTex("k+1", color=TEXT).scale(0.9).next_to(kp1_pos, DOWN, buff=0.35)
        lab_x = MathTex("x", color=RED).scale(0.9).next_to(x_pos, UP, buff=0.35)
        picture = VGroup(axis, segment, left_mark, right_mark, dot, lab_k, lab_kp1, lab_x)

        with self.say(
            ro=(
                "Pentru orice număr real {x|ics,} există un singur număr întreg {k|ka,} între care "
                "se află {x|ics}: {k|ka,} mai mic sau egal decât {x|ics}, iar {x|ics,} mai mic decât {k|ka,} plus unu. "
                "<bookmark mark='floor'/> Acest {k|ka,} este partea întreagă a lui {x|ics} "
                "și se scrie cu paranteze drepte. "
                "<bookmark mark='frac'/> Partea fracționară este diferența dintre {x|ics} "
                "și partea sa întreagă. "
                "<bookmark mark='axis'/> Pe axă, {x|ics,} stă între {k|ka,} și {k|ka,} plus unu, "
                "cu capătul din stânga inclus și cel din dreapta exclus."
            ),
            en=(
                "For any real number x there is a single integer k around it: "
                "k less than or equal to x, and x less than k plus one. "
                "This k is the integer part of x, written in square brackets. "
                "The fractional part is the difference between x and its integer part. "
                "On the number line, x sits between k and k plus one, "
                "with the left end included and the right end left out."
            ),
        ) as t:
            self.play(FadeIn(head), FadeIn(given), Write(cond), run_time=1.4)
            self.wait_until_bookmark("floor")
            self.play(Write(floor_def), run_time=1.1)
            self.wait_until_bookmark("frac")
            self.play(Write(frac_def), run_time=1.1)
            self.wait_until_bookmark("axis")
            self.play(Create(axis), run_time=0.9)
            self.play(Create(segment), FadeIn(left_mark), FadeIn(right_mark), run_time=1.0)
            self.play(FadeIn(dot), FadeIn(lab_k), FadeIn(lab_kp1), FadeIn(lab_x), run_time=1.0)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(block), FadeOut(given), FadeOut(picture), run_time=0.7)
        self.head = head

    # ------------------------------------------------------------------ exemplu

    def exemplu(self):
        head2 = title("Exemplu").to_edge(UP, buff=0.8)
        question = MathTex(
            r"[2{,}6]=\,?", r"\qquad ", r"\{2{,}6\}=\,?", color=MATH_COLOR
        ).scale(1.2)
        question.next_to(head2, DOWN, buff=0.5)

        line = NumberLine(
            x_range=[0, 5, 1],
            length=10,
            include_numbers=True,
            color=MUTED,
            font_size=30,
        )
        line.numbers.set_color(TEXT)
        line.move_to(DOWN * 0.3)

        lo, hi, xval = 2, 3, 2.6
        start, end = line.n2p(lo) + UP * 0.55, line.n2p(hi) + UP * 0.55
        bar = Line(start, end, color=INK, stroke_width=7).set_z_index(2)
        band = VGroup(bar, end_mark(start, True, "left", INK), end_mark(end, False, "right", INK))
        dot = Dot(line.n2p(xval) + UP * 0.55, color=RED, radius=0.11).set_z_index(4)
        lab = MathTex("x=2{,}6", color=RED).scale(0.9).next_to(dot, UP, buff=0.3)

        # First what we work out, then the picture, then the value: the question is on
        # screen before the axis is read, and each answer comes last.
        ans_floor = MathTex(r"[2{,}6]=", r"2", color=MATH_COLOR).scale(1.2)
        ans_frac = MathTex(r"\{2{,}6\}=2{,}6-2=", r"0{,}6", color=MATH_COLOR).scale(1.2)
        ans_floor[1].set_color(INK)
        ans_frac[1].set_color(GREEN)
        answers = VGroup(ans_floor, ans_frac).arrange(DOWN, buff=0.45, aligned_edge=LEFT)
        answers.to_edge(DOWN, buff=0.5)

        with self.say(
            ro=(
                "Să facem un exemplu. "
                "<bookmark mark='q'/> Calculăm partea întreagă și partea fracționară "
                "pentru doi virgulă șase. "
                "<bookmark mark='ax'/> Pe axă, doi virgulă șase stă între doi și trei. "
                "<bookmark mark='ans'/> Partea întreagă este doi, iar partea fracționară "
                "este zero virgulă șase, anume doi virgulă șase minus doi."
            ),
            en=(
                "Let us work through an example. "
                "We work out the integer part and the fractional part of two point six. "
                "On the number line, two point six sits between two and three. "
                "The integer part is two, and the fractional part is zero point six, "
                "namely two point six minus two."
            ),
        ) as t:
            # The title changes together with its picture: the definitions must not sit
            # under the example title.
            self.play(Transform(self.head, head2), Write(question), run_time=1.3)
            self.wait_until_bookmark("q")
            self.play(Create(line), run_time=1.0)
            self.wait_until_bookmark("ax")
            self.play(Create(band), FadeIn(dot), FadeIn(lab), run_time=1.2)
            self.wait_until_bookmark("ans")
            self.play(Write(ans_floor), run_time=1.2)
            self.play(Write(ans_frac), run_time=1.4)
            self.wait(t.get_remaining_duration())

        self.play(
            FadeOut(line),
            FadeOut(band),
            FadeOut(dot),
            FadeOut(lab),
            FadeOut(question),
            FadeOut(answers),
            run_time=0.7,
        )

    # ------------------------------------------------------------------ capcana

    def capcana(self):
        head3 = title("Atenție la negative").to_edge(UP, buff=0.8)
        question = MathTex(r"[-2{,}6]=\,?", color=MATH_COLOR).scale(1.3)
        question.next_to(head3, DOWN, buff=0.5)

        line = NumberLine(
            x_range=[-5, 0, 1],
            length=10,
            include_numbers=True,
            color=MUTED,
            font_size=30,
        )
        line.numbers.set_color(TEXT)
        line.move_to(DOWN * 0.1)

        lo, hi, xval = -3, -2, -2.6
        start, end = line.n2p(lo) + UP * 0.55, line.n2p(hi) + UP * 0.55
        bar = Line(start, end, color=INK, stroke_width=7).set_z_index(2)
        band = VGroup(bar, end_mark(start, True, "left", INK), end_mark(end, False, "right", INK))
        dot = Dot(line.n2p(xval) + UP * 0.55, color=RED, radius=0.11).set_z_index(4)
        lab = MathTex("x=-2{,}6", color=RED).scale(0.9).next_to(dot, UP, buff=0.3)

        # The wrong form stays readable: red and labelled, never crossed out.
        wrong = MathTex(r"[-2{,}6]=", r"-2", color=RED).scale(1.2)
        no = ro("greșit", size=30, color=RED, weight="BOLD").next_to(wrong, RIGHT, buff=0.6)
        right = MathTex(r"[-2{,}6]=", r"-3", color=INK).scale(1.2)
        yes = ro("corect", size=30, color=GREEN, weight="BOLD").next_to(right, RIGHT, buff=0.6)
        frac = MathTex(r"\{-2{,}6\}=-2{,}6-(-3)=", r"0{,}4", color=MATH_COLOR).scale(1.15)
        frac[1].set_color(GREEN)
        rows = VGroup(VGroup(wrong, no), VGroup(right, yes), frac)
        rows.arrange(DOWN, buff=0.45, aligned_edge=LEFT)
        rows.to_edge(DOWN, buff=0.35)

        with self.say(
            ro=(
                "Atenție la numerele negative! "
                "<bookmark mark='q'/> Calculăm partea întreagă din minus doi virgulă șase. "
                "<bookmark mark='wrong'/> Tăind zecimalele am obține minus doi, dar minus doi "
                "este mai mare decât minus doi virgulă șase, deci nu poate fi partea întreagă. "
                "<bookmark mark='ok'/> Valoarea corectă este minus trei, pentru că minus trei "
                "este mai mic sau egal decât minus doi virgulă șase, iar minus doi virgulă șase "
                "este mai mic decât minus doi. "
                "<bookmark mark='frac'/> Partea fracționară rămâne între zero și unu: diferența "
                "dintre minus doi virgulă șase și minus trei face zero virgulă patru."
            ),
            en=(
                "Mind the negative numbers! "
                "We work out the integer part of minus two point six. "
                "Cutting off the decimals would give minus two, but minus two "
                "is greater than minus two point six, so it cannot be the integer part. "
                "The right value is minus three, because minus three "
                "is less than or equal to minus two point six, and minus two point six "
                "is less than minus two. "
                "The fractional part stays between zero and one: the difference "
                "between minus two point six and minus three is zero point four."
            ),
        ) as t:
            self.play(Transform(self.head, head3), Write(question), run_time=1.2)
            self.wait_until_bookmark("q")
            self.play(Create(line), run_time=1.0)
            self.play(Create(band), FadeIn(dot), FadeIn(lab), run_time=1.2)
            self.wait_until_bookmark("wrong")
            self.play(FadeIn(wrong), FadeIn(no), run_time=1.0)
            self.wait_until_bookmark("ok")
            self.play(FadeOut(VGroup(wrong, no)), run_time=0.5)
            self.play(FadeIn(right), FadeIn(yes), run_time=1.0)
            self.wait_until_bookmark("frac")
            self.play(Write(frac), run_time=1.3)
            self.wait(t.get_remaining_duration())

        self.play(
            FadeOut(line),
            FadeOut(band),
            FadeOut(dot),
            FadeOut(lab),
            FadeOut(question),
            FadeOut(rows),
            run_time=0.7,
        )

    # ------------------------------------------------------------------- final

    def closing(self):
        head4 = title("De reținut").to_edge(UP, buff=0.8)
        rows = VGroup(
            VGroup(
                MathTex(r"[x]", color=INK).scale(1.2),
                ro("cel mai mare întreg mai mic sau egal cu numărul dat", size=32),
            ),
            VGroup(
                MathTex(r"\{x\}=x-[x]", color=GREEN).scale(1.2),
                ro("diferența dintre număr și partea sa întreagă", size=32),
            ),
            VGroup(
                MathTex(r"[-2{,}6]=-3", color=INK).scale(1.2),
                ro("la negative, nu tăiem zecimalele", size=32, color=RED, weight="BOLD"),
            ),
        )
        for pair in rows:
            pair[0].move_to(LEFT * 4.6)
            pair[1].next_to(pair[0], RIGHT, buff=0.6)
            pair[1].align_to(LEFT * 2.4, LEFT)
        rows.arrange(DOWN, buff=0.85, aligned_edge=LEFT)
        rows.move_to(DOWN * 0.2)
        underline = Line(
            rows[2][1].get_corner(DOWN + LEFT),
            rows[2][1].get_corner(DOWN + RIGHT),
            color=MARKER,
            stroke_width=14,
            stroke_opacity=0.85,
        ).shift(DOWN * 0.12).set_z_index(-1)

        with self.say(
            ro=(
                "Să reținem. "
                "<bookmark mark='a'/> Partea întreagă este cel mai mare număr întreg mai mic "
                "sau egal cu numărul dat. "
                "<bookmark mark='b'/> Partea fracționară este diferența dintre număr și partea "
                "sa întreagă și rămâne mereu între zero și unu. "
                "<bookmark mark='c'/> Iar la negative, nu tăiem zecimalele: partea întreagă "
                "din minus doi virgulă șase este minus trei. "
                "Pe curând!"
            ),
            en=(
                "Let us remember. "
                "The integer part is the greatest integer less than or equal to the given number. "
                "The fractional part is the difference between the number and its integer part, "
                "and it always stays between zero and one. "
                "And for negatives, we never just cut the decimals: the integer part "
                "of minus two point six is minus three. "
                "See you soon!"
            ),
        ) as t:
            self.play(Transform(self.head, head4), run_time=0.9)
            for mark, index in (("a", 0), ("b", 1), ("c", 2)):
                self.wait_until_bookmark(mark)
                self.play(FadeIn(rows[index]), run_time=1.0)
            self.play(FadeIn(underline), run_time=0.6)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(self.head), FadeOut(rows), FadeOut(underline), run_time=1.0)
        self.wait(0.4)


CLIP_TITLE_RO = "Partea întreagă și partea fracționară — clasa a IX-a"
CLIP_TITLE_EN = "Integer and fractional part — grade 9"
