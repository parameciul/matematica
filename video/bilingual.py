"""A VoiceoverScene that writes Romanian and English subtitles from one render.

The clip is spoken in Romanian. manim-voiceover writes one `.srt` from the spoken text,
which gives us the Romanian captions for free. English captions need the same cue times
with different words, so `say()` records a second list of cues from an English translation
of the same line and `write_english_subtitles()` writes it beside the video as `.en.srt`.

The English text is never spoken. It only has to carry the same meaning in roughly the same
number of words, so the cues stay close to what is being said.

Usage:

    class MyScene(BilingualVoiceoverScene):
        def construct(self):
            self.set_speech_service(EdgeTTSService(voice=VOICE))
            with self.say(ro="Pornim de la numerele naturale.",
                          en="We start from the natural numbers.") as t:
                self.play(..., run_time=t.duration)
            self.write_english_subtitles()
"""
from contextlib import contextmanager
from pathlib import Path

import srt
from manim_voiceover import VoiceoverScene
from manim_voiceover.helper import remove_bookmarks


class BilingualVoiceoverScene(VoiceoverScene):
    en_subcaptions: list

    @contextmanager
    def say(self, ro, en):
        """Speak `ro` and record `en` as a parallel caption track over the same seconds."""
        if not hasattr(self, "en_subcaptions"):
            self.en_subcaptions = []
        with self.voiceover(text=ro) as tracker:
            # add_wrapped_subcaption splits the line and stamps it from the current scene
            # time, exactly as it just did for the Romanian one. Pointing the file writer at
            # our own list for that one call collects the English cues without touching the
            # Romanian track or duplicating the splitting rules.
            writer = self.renderer.file_writer
            romanian = writer.subcaptions
            writer.subcaptions = self.en_subcaptions
            try:
                self.add_wrapped_subcaption(remove_bookmarks(en), tracker.duration)
            finally:
                writer.subcaptions = romanian
            yield tracker

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
