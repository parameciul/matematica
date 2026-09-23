"""A VoiceoverScene that writes Romanian and English subtitles from one render.

The clip is spoken in Romanian. `say()` writes a Romanian and an English caption track over
the same seconds: one cue per sentence, timed from the words the voice actually speaks, so a
cue starts with its sentence even when the service puts silence between sentences.
`write_english_subtitles()` writes the English track beside the video as `.en.srt`; Manim
writes the Romanian one as `.srt`.

The English text is never spoken. It must have the same number of sentences as the
Romanian, so each English cue covers the same seconds as its Romanian sentence.

Math letters are written in braces, `{a}`. The voice swallows a lone letter ("a" lasts a
hundredth of a second), so the spoken text holds it with a short pause after it ("a -"),
while the captions show the plain letter. Where the voice reads a letter wrongly, give the
spoken form after a bar: `{b|be}` is read "be" and shown "b".

After every `say()` the scene waits `idea_pause` seconds, so the viewer has a moment with
the picture before the next idea starts.

Usage:

    class MyScene(BilingualVoiceoverScene):
        def construct(self):
            self.set_speech_service(EdgeTTSService(voice=VOICE))
            with self.say(ro="Dacă {a} este mai mic decât {b}.",
                          en="If a is less than b.") as t:
                self.play(..., run_time=t.duration)
            self.write_english_subtitles()
"""
import re
from contextlib import contextmanager
from math import ceil
from pathlib import Path

import srt
from manim_voiceover import VoiceoverScene
from manim_voiceover.helper import remove_bookmarks

from edge_tts_service import split_sentences

# A math letter in braces. Before punctuation the punctuation already makes the pause.
LETTER_BEFORE_MARK = re.compile(r"\{([A-Za-z])\}(?=[.,;:!?])")
LETTER = re.compile(r"\{([A-Za-z])\}")
# A letter with its spoken form, `{b|be}`.
NAMED_LETTER = re.compile(r"\{([A-Za-z])\|([^}]+)\}")
MAX_CUE = 70  # characters on one caption, as manim-voiceover uses


def spoken(text):
    """The text the voice reads: every `{a}` becomes "a -", which the voice holds."""
    text = NAMED_LETTER.sub(r"\2", text)
    return LETTER.sub(r"\1 -", LETTER_BEFORE_MARK.sub(r"\1", text))


def shown(text):
    """The caption text: every `{a}` becomes the plain letter."""
    return LETTER.sub(r"\1", NAMED_LETTER.sub(r"\1", text))


def split_cue(text, start, end):
    """One sentence as cues of at most MAX_CUE characters, sharing its seconds by length."""
    tokens = " ".join(text.split()).split()
    pieces = ceil(len(" ".join(tokens)) / MAX_CUE) or 1
    size = ceil(len(tokens) / pieces)
    parts = [" ".join(tokens[i : i + size]) for i in range(0, len(tokens), size)]
    total = sum(len(part) for part in parts)
    cues, at = [], start
    for part in parts:
        length = (end - start) * len(part) / total
        cues.append((part, at, at + length))
        at += length
    return cues


class BilingualVoiceoverScene(VoiceoverScene):
    en_subcaptions: list
    idea_pause = 1.0

    @contextmanager
    def say(self, ro, en):
        """Speak `ro`, caption it in Romanian and English, then leave a pause."""
        if not hasattr(self, "en_subcaptions"):
            self.en_subcaptions = []
        voice_text = spoken(ro)
        # Captions are written below from the word timings, not by manim-voiceover.
        wanted = self.create_subcaption
        self.create_subcaption = False
        try:
            with self.voiceover(text=voice_text) as tracker:
                if wanted:
                    self._caption(tracker, voice_text, shown(ro), en)
                yield tracker
        finally:
            self.create_subcaption = wanted
        self.wait(self.idea_pause)

    def _caption(self, tracker, voice_text, ro_text, en_text):
        ro_sentences = [
            remove_bookmarks(ro_text)[s:e] for s, e in split_sentences(remove_bookmarks(ro_text))
        ]
        en_clean = remove_bookmarks(en_text)
        en_sentences = [en_clean[s:e] for s, e in split_sentences(en_clean)]
        if len(en_sentences) != len(ro_sentences):
            raise ValueError(
                f"The English line has {len(en_sentences)} sentences and the Romanian one "
                f"{len(ro_sentences)}; they must match so the cues share their seconds.\n"
                f"RO: {ro_text}\nEN: {en_text}"
            )

        windows = self._sentence_windows(tracker, remove_bookmarks(voice_text))
        writer = self.renderer.file_writer
        romanian = writer.subcaptions
        for sentences, track in ((ro_sentences, romanian), (en_sentences, self.en_subcaptions)):
            writer.subcaptions = track
            try:
                for sentence, (start, end) in zip(sentences, windows):
                    for text, cue_start, cue_end in split_cue(sentence, start, end):
                        self.add_subcaption(
                            text, duration=max(cue_end - cue_start - 0.05, 0.1), offset=cue_start
                        )
            finally:
                writer.subcaptions = romanian

    @staticmethod
    def _sentence_windows(tracker, text):
        """The seconds, from the start of the line, during which each sentence shows.

        A cue starts with the first word of its sentence and stays up through the pause,
        until the next sentence starts. The last one stays until the audio ends.
        """
        words = tracker.data["word_boundaries"]
        spans = split_sentences(text)
        starts = []
        for s, e in spans:
            inside = [w["audio_offset"] / 1e7 for w in words if s <= w["text_offset"] < e]
            starts.append(min(inside) if inside else None)
        # A sentence without a matched word (a number the voice spelled out) takes the
        # start of the one before it; the first always starts at zero.
        starts[0] = 0.0
        for i in range(1, len(starts)):
            if starts[i] is None:
                starts[i] = starts[i - 1]
        ends = starts[1:] + [tracker.duration]
        return list(zip(starts, ends))

    def write_english_subtitles(self):
        """Write the English cues next to the video, as <SceneName>.en.srt."""
        cues = getattr(self, "en_subcaptions", [])
        if not cues:
            return None
        numbered = [
            srt.Subtitle(index=i + 1, content=cue.content, start=cue.start, end=cue.end)
            for i, cue in enumerate(cues)
        ]
        # The path comes from the file writer, which already resolved it. config.video_dir
        # is only the raw template ("{media_dir}/videos/{module_name}/{quality}") and
        # config.get_dir needs arguments we would have to guess.
        movie = Path(self.renderer.file_writer.movie_file_path)
        path = movie.with_suffix(".en.srt")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(srt.compose(numbered), encoding="utf-8")
        return path
