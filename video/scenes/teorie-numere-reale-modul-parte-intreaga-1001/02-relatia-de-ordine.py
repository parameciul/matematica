"""Clip 2 of the grade 9 lesson "Numere reale, modul, parte întreagă".

Covers the first half of section 2, "Relația de ordine pe ℝ": the properties of
inequalities (transitivity, adding, multiplying by a positive or a negative number,
inverses and squares). The intervals are clip 3.

Spoken in Romanian, captioned in Romanian and English. Like every clip, it stands alone: it
never mentions what the previous clip covered or what the next one will.

Render:
    uv run manim render -ql scenes/.../02-relatia-de-ordine.py RelatiaDeOrdine   (draft)
    uv run manim render -qh scenes/.../02-relatia-de-ordine.py RelatiaDeOrdine   (final)
"""
import sys
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    FadeIn,
    FadeOut,
    MathTex,
    Rectangle,
    Transform,
    VGroup,
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
    caption,
    ro,
    title,
)

VOICE = "ro-RO-AlinaNeural"
# The same pace as clip 1, so the clips of one lesson sound alike.
RATE = "-8%"
# Extra silence after each sentence, so the viewer can take in one idea before the next.
SENTENCE_PAUSE = 0.8


class RelatiaDeOrdine(BilingualVoiceoverScene):
    def construct(self):
        self.set_speech_service(
            EdgeTTSService(voice=VOICE, rate=RATE, sentence_pause=SENTENCE_PAUSE),
            create_subcaption=True,
        )
        self.opening()
        self.adunare()
        self.inmultire()
        self.inverse_patrate()
        self.closing()
        self.write_english_subtitles()

    # ------------------------------------------------------------------ opening

    def opening(self):
        # The site font draws ℝ thin and pale next to its bold letters, so the set comes from
        # the math font, like everywhere else in the clip.
        words = title("Relația de ordine pe")
        real = MathTex(r"\mathbb{R}", color=INK).scale(1.5)
        # The bottom of the words is the tail of the p, below the line; the R stands on the
        # line, so it lines up with the foot of the last letter, the e.
        real.next_to(words, RIGHT, buff=0.25).align_to(words[-1], DOWN)
        head = VGroup(words, real)
        sub = ro("Proprietăți ale inegalităților", size=36, color=MUTED, weight="BOLD")
        grade = caption("Clasa a IX-a · Numere reale")
        VGroup(head, sub, grade).arrange(DOWN, buff=0.4)
        with self.say(
            ro=(
                "Bine ați venit! Astăzi vorbim despre relația de ordine pe mulțimea "
                "numerelor reale. <bookmark mark='sub'/> Vedem cum se comportă inegalitățile "
                "când adunăm, când înmulțim și când trecem la inverse."
            ),
            en=(
                "Welcome! Today we talk about the order relation on the set "
                "of real numbers. We see how inequalities behave "
                "when we add, when we multiply and when we take inverses."
            ),
        ) as t:
            self.play(FadeIn(head, shift=UP * 0.3), run_time=1.2)
            self.wait_until_bookmark("sub")
            self.play(FadeIn(sub), FadeIn(grade), run_time=0.8)
            self.wait(t.get_remaining_duration())
        self.play(FadeOut(head), FadeOut(sub), FadeOut(grade), run_time=0.6)

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
                "Pentru orice numere reale {a}, {b|be}, {c|ce} și {d|de,} avem câteva reguli. "
                "<bookmark mark='a'/> Prima este tranzitivitatea: dacă {a} este mai mic sau egal cu {b}, "
                "iar {b} este mai mic sau egal cu {c}, atunci {a} este mai mic sau egal cu {c}. "
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
        VGroup(rows, warning, sample).move_to(DOWN * 0.9)

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
        rows.move_to(DOWN * 0.9)

        with self.say(
            ro=(
                "Pentru numere strict pozitive, inversele schimbă ordinea: "
                "dacă {a} este mai mic sau egal cu {b}, atunci unu supra {a} este mai mare "
                "sau egal cu unu supra {b}. "
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

    # ------------------------------------------------------------------ final

    def closing(self):
        head2 = title("De reținut").to_edge(UP, buff=0.8)
        rule = VGroup(
            MathTex(r"c<0:", color=MATH_COLOR),
            MathTex(r"a\le b\ \Rightarrow\ ac", r"\ge", r"bc", color=MATH_COLOR),
        ).scale(1.4).arrange(RIGHT, buff=0.4)
        rule[1][1].set_color(RED)
        rule.move_to(UP * 0.3)
        underline = Rectangle(width=rule.width + 0.6, height=0.22, color=MARKER, stroke_width=0)
        underline.set_fill(MARKER, opacity=0.85)
        underline.next_to(rule, DOWN, buff=0.18)
        note = ro("se schimbă sensul inegalității", size=32, color=RED, weight="BOLD")
        note.next_to(underline, DOWN, buff=0.6)

        with self.say(
            ro=(
                "Să reținem ideea principală. "
                "<bookmark mark='a'/> Când înmulțim ambii membri cu un număr negativ, "
                "<bookmark mark='b'/> se schimbă sensul inegalității. "
                "Pe curând!"
            ),
            en=(
                "Let us keep the main idea. "
                "When we multiply both sides by a negative number, "
                "the inequality changes direction. "
                "See you soon!"
            ),
        ) as t:
            self.play(Transform(self.head, head2), run_time=0.9)
            self.wait_until_bookmark("a")
            self.play(Write(rule), run_time=1.4)
            self.play(FadeIn(underline), run_time=0.6)
            self.wait_until_bookmark("b")
            self.play(FadeIn(note), run_time=0.8)
            self.wait(t.get_remaining_duration())

        self.play(
            FadeOut(self.head), FadeOut(rule), FadeOut(underline), FadeOut(note), run_time=1.0
        )
        self.wait(0.4)


CLIP_TITLE_RO = "Relația de ordine pe ℝ - Proprietăți ale inegalităților — clasa a IX-a"
CLIP_TITLE_EN = "The order relation on ℝ - Properties of inequalities — grade 9"
