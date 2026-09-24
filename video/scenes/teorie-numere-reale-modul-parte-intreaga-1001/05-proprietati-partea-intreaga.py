"""Clip 5 of the grade 9 lesson "Numere reale, modul, parte întreagă".

Covers section 4.2, "Proprietăți": the basic framing [x] <= x < [x] + 1, the splitting
x = [x] + {x} with 0 <= {x} < 1, pulling an integer out of the brackets, and the link
between a number and its opposite. The worked example is [pi] + [-pi] = -1, read on two
small axes before the value is written.

On every axis the ends are drawn with the same signs as the notation, [ ] and ( ), the way
the students write them in their notebooks.

Spoken in Romanian, captioned in Romanian and English. Like every clip, it stands alone: it
never mentions what the previous clip covered or what the next one will.

Render:
    uv run manim render -ql scenes/.../05-proprietati-partea-intreaga.py ProprietatiParteaIntreaga   (draft)
    uv run manim render -qh scenes/.../05-proprietati-partea-intreaga.py ProprietatiParteaIntreaga   (final)
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
# Longer than in the earlier clips: a new property needs a moment to settle.
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


class ProprietatiParteaIntreaga(BilingualVoiceoverScene):
    # A longer pause after each idea than the base scene leaves, so the student has a
    # moment with the picture before the next idea starts.
    idea_pause = 1.5

    def construct(self):
        self.set_speech_service(
            EdgeTTSService(voice=VOICE, rate=RATE, sentence_pause=SENTENCE_PAUSE),
            create_subcaption=True,
        )
        self.opening()
        self.baza()
        self.intreg()
        self.opus()
        self.exemplu()
        self.closing()
        self.write_english_subtitles()

    # ------------------------------------------------------------------ opening

    def opening(self):
        head = title("Proprietăți ale părții întregi")
        sub = caption("Clasa a IX-a · Numere reale")
        VGroup(head, sub).arrange(DOWN, buff=0.45)
        with self.say(
            ro=(
                "Partea întreagă și partea fracționară urmează câteva proprietăți simple, "
                "iar astăzi le descoperim împreună. "
                "<bookmark mark='sub'/> La final le verificăm pe un exemplu cu numărul pi."
            ),
            en=(
                "The integer part and the fractional part follow a few simple properties, "
                "and today we discover them together. "
                "At the end we check them on an example with the number pi."
            ),
        ) as t:
            self.play(FadeIn(head, shift=UP * 0.3), run_time=1.2)
            self.wait_until_bookmark("sub")
            self.play(FadeIn(sub), run_time=0.8)
            self.wait(t.get_remaining_duration())
        self.play(FadeOut(head), FadeOut(sub), run_time=0.6)

    # ------------------------------------------------------- incadrarea de baza

    def baza(self):
        head = title("Încadrarea fundamentală").to_edge(UP, buff=0.8)
        frame = MathTex(r"[x]\le x<[x]+1", color=MATH_COLOR).scale(1.4)
        split = MathTex(r"x=[x]+\{x\},\qquad 0\le\{x\}<1", color=MATH_COLOR).scale(1.25)
        block = VGroup(frame, split).arrange(DOWN, buff=0.7)
        block.move_to(DOWN * 0.4)

        with self.say(
            ro=(
                "Pornim de la încadrarea fundamentală: partea întreagă din {x|ics,} "
                "este mai mică sau egală decât {x|ics,}, iar {x|ics,} este mai mic decât "
                "partea întreagă plus unu. "
                "<bookmark mark='b'/> Tot aici apare descompunerea oricărui număr real: "
                "{x|ics,} este egal cu partea sa întreagă plus partea sa fracționară, "
                "iar partea fracționară rămâne mereu între zero și unu."
            ),
            en=(
                "We start from the basic framing: the integer part of x "
                "is less than or equal to x, and x is less than "
                "the integer part plus one. "
                "Here we also get the splitting of any real number: "
                "x equals its integer part plus its fractional part, "
                "and the fractional part always stays between zero and one."
            ),
        ) as t:
            self.play(FadeIn(head), Write(frame), run_time=1.4)
            self.wait_until_bookmark("b")
            self.play(Write(split), run_time=1.4)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(block), run_time=0.6)
        self.head = head

    # ------------------------------------------------- intregul iese din paranteze

    def intreg(self):
        head2 = title("Întregul iese din paranteze").to_edge(UP, buff=0.8)
        shift = MathTex(r"[x+3]=[x]+3", color=INK).scale(1.4)
        same = MathTex(r"\{x+3\}=\{x\}", color=GREEN).scale(1.4)
        check = MathTex(
            r"[2{,}6+3]=[5{,}6]=5,\quad [2{,}6]+3=2+3=5", color=MATH_COLOR
        ).scale(1.05)
        block = VGroup(shift, same, check).arrange(DOWN, buff=0.6)
        block.move_to(DOWN * 0.4)

        with self.say(
            ro=(
                "Când adunăm un număr întreg, partea întreagă crește cu exact acel număr, "
                "<bookmark mark='frac'/> iar partea fracționară nu se schimbă. "
                "<bookmark mark='ex'/> De pildă, doi virgulă șase plus trei face cinci "
                "virgulă șase, deci partea întreagă crește de la doi la cinci, "
                "iar partea fracționară rămâne zero virgulă șase."
            ),
            en=(
                "When we add an integer, the integer part grows by exactly that number, "
                "and the fractional part does not change. "
                "For instance, two point six plus three is five point six, "
                "so the integer part grows from two to five, "
                "and the fractional part stays zero point six."
            ),
        ) as t:
            self.play(Transform(self.head, head2), Write(shift), run_time=1.4)
            # One formula at a time: the fractional part appears exactly when the voice
            # names it, never before.
            self.wait_until_bookmark("frac")
            self.play(Write(same), run_time=1.1)
            self.wait_until_bookmark("ex")
            self.play(Write(check), run_time=1.4)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(block), run_time=0.6)

    # ------------------------------------------------------ numarul si opusul sau

    def opus(self):
        head3 = title("Numărul și opusul său").to_edge(UP, buff=0.8)
        zero = MathTex(r"[x]+[-x]=0\ \ \text{(număr întreg)}", color=INK).scale(1.15)
        minus = MathTex(r"[x]+[-x]=-1\ \ \text{(altfel)}", color=INK).scale(1.15)
        frac = MathTex(r"\{x\}+\{-x\}=1\ \ \text{(altfel)}", color=GREEN).scale(1.15)
        block = VGroup(zero, minus, frac).arrange(DOWN, buff=0.55)
        block.move_to(DOWN * 0.4)

        with self.say(
            ro=(
                "Interesantă este și legătura dintre un număr și opusul său: dacă numărul "
                "este întreg, părțile întregi se anulează reciproc. "
                "<bookmark mark='b'/> Dacă numărul nu este întreg, suma părților întregi "
                "face minus unu, "
                "<bookmark mark='c'/> iar suma părților fracționare face unu."
            ),
            en=(
                "The link between a number and its opposite is interesting too: "
                "if the number is an integer, the integer parts cancel each other out. "
                "If the number is not an integer, the sum of the integer parts "
                "is minus one, and the sum of the fractional parts is one."
            ),
        ) as t:
            self.play(Transform(self.head, head3), Write(zero), run_time=1.3)
            self.wait_until_bookmark("b")
            self.play(Write(minus), run_time=1.2)
            self.wait_until_bookmark("c")
            self.play(Write(frac), run_time=1.2)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(block), run_time=0.6)

    # ------------------------------------------------------------------ exemplu

    def exemplu(self):
        head4 = title("Exemplu").to_edge(UP, buff=0.8)
        question = MathTex(r"[\pi]+[-\pi]=\,?", color=MATH_COLOR).scale(1.3)
        question.next_to(head4, DOWN, buff=0.5)

        def row(y, lo, hi, frac, name, color):
            axis = Line(LEFT * 3.4, RIGHT * 3.4, color=MUTED, stroke_width=3)
            axis.move_to(UP * y)
            lo_pos = LEFT * 3.4 + (RIGHT * 6.8) * 0.3 + UP * y
            hi_pos = LEFT * 3.4 + (RIGHT * 6.8) * 0.7 + UP * y
            bar = Line(lo_pos, hi_pos, color=INK, stroke_width=7).set_z_index(2)
            dot = Dot(lo_pos + (hi_pos - lo_pos) * frac, color=color, radius=0.11)
            dot.set_z_index(4)
            lab_lo = MathTex(str(lo), color=TEXT).scale(0.9).next_to(lo_pos, DOWN, buff=0.3)
            lab_hi = MathTex(str(hi), color=TEXT).scale(0.9).next_to(hi_pos, DOWN, buff=0.3)
            lab_dot = MathTex(name, color=color).scale(0.9).next_to(dot, UP, buff=0.3)
            return VGroup(
                axis, bar, end_mark(lo_pos, True, "left", INK),
                end_mark(hi_pos, False, "right", INK),
                dot, lab_lo, lab_hi, lab_dot,
            )

        upper = row(0.6, 3, 4, 0.35, r"\pi", RED)
        lower = row(-1.3, -4, -3, 0.6, r"-\pi", RED)

        # First what we work out, then the picture, then the value: the question is on
        # screen before the axes are read, and each answer comes last.
        ans = MathTex(r"[\pi]=3,\quad [-\pi]=-4", color=MATH_COLOR).scale(1.15)
        total = MathTex(r"[\pi]+[-\pi]=3+(-4)=", r"-1", color=MATH_COLOR).scale(1.3)
        total[1].set_color(INK)
        answers = VGroup(ans, total).arrange(DOWN, buff=0.4, aligned_edge=LEFT)
        answers.to_edge(DOWN, buff=0.45)

        with self.say(
            ro=(
                "Să verificăm totul pe un exemplu: calculăm suma dintre partea întreagă "
                "din pi și partea întreagă din minus pi. "
                "<bookmark mark='ax'/> Pe axă, pi se află între trei și patru, deci partea "
                "sa întreagă este trei, iar minus pi se află între minus patru și minus trei, "
                "deci partea sa întreagă este minus patru. "
                "<bookmark mark='res'/> Suma face minus unu, așa cum arată proprietatea "
                "pentru numerele care nu sunt întregi."
            ),
            en=(
                "Let us check everything on one example: we work out the sum "
                "of the integer part of pi and the integer part of minus pi. "
                "On the number line, pi lies between three and four, so its integer part "
                "is three, and minus pi lies between minus four and minus three, "
                "so its integer part is minus four. "
                "The sum is minus one, exactly as the property says "
                "for numbers that are not integers."
            ),
        ) as t:
            # The title changes together with its picture: the rules must not sit under
            # the example title.
            self.play(Transform(self.head, head4), Write(question), run_time=1.3)
            self.wait_until_bookmark("ax")
            self.play(Create(upper), run_time=1.2)
            self.play(Create(lower), run_time=1.2)
            self.wait_until_bookmark("res")
            self.play(Write(ans), run_time=1.2)
            self.play(Write(total), run_time=1.3)
            self.wait(t.get_remaining_duration())

        self.play(
            FadeOut(upper), FadeOut(lower), FadeOut(question), FadeOut(answers),
            run_time=0.7,
        )

    # ------------------------------------------------------------------- final

    def closing(self):
        head5 = title("De reținut").to_edge(UP, buff=0.8)
        rows = VGroup(
            VGroup(
                MathTex(r"[x]\le x<[x]+1", color=INK).scale(1.2),
                ro("încadrarea fundamentală", size=32),
            ),
            VGroup(
                MathTex(r"[x+k]=[x]+k", color=INK).scale(1.2),
                ro("întregul iese din paranteze", size=32),
            ),
            VGroup(
                MathTex(r"[\pi]+[-\pi]=-1", color=INK).scale(1.2),
                ro("opusele neîntregi dau minus unu", size=32, color=RED, weight="BOLD"),
            ),
        )
        for pair in rows:
            pair[1].next_to(pair[0], RIGHT, buff=1.2)
        # The notes share one column: each starts well clear of the widest formula,
        # so no explanation ever crowds its formula.
        left_edge = max(pair[1].get_left()[0] for pair in rows)
        for pair in rows:
            pair[1].shift(RIGHT * (left_edge - pair[1].get_left()[0]))
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
                "<bookmark mark='a'/> Partea întreagă încadrează numărul: este mai mică "
                "sau egală decât el, iar numărul este mai mic decât ea plus unu. "
                "<bookmark mark='b'/> Un număr întreg adunat înăuntru iese direct afară "
                "din paranteze. "
                "<bookmark mark='c'/> Iar pentru două numere opuse, care nu sunt întregi, "
                "suma părților întregi face minus unu. "
                "Pe curând!"
            ),
            en=(
                "Let us remember. "
                "The integer part frames the number: it is less than or equal to it, "
                "and the number is less than it plus one. "
                "An integer added inside comes straight out of the brackets. "
                "And for two opposite numbers that are not integers, "
                "the sum of the integer parts is minus one. "
                "See you soon!"
            ),
        ) as t:
            self.play(Transform(self.head, head5), run_time=0.9)
            for mark, index in (("a", 0), ("b", 1), ("c", 2)):
                self.wait_until_bookmark(mark)
                self.play(FadeIn(rows[index]), run_time=1.0)
            self.play(FadeIn(underline), run_time=0.6)
            self.wait(t.get_remaining_duration())

        self.play(FadeOut(self.head), FadeOut(rows), FadeOut(underline), run_time=1.0)
        self.wait(0.4)


CLIP_TITLE_RO = "Proprietăți ale părții întregi și ale părții fracționare — clasa a IX-a"
CLIP_TITLE_EN = "Properties of the integer and fractional parts — grade 9"
