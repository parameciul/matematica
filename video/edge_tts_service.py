"""Speech service for manim-voiceover backed by edge-tts (Microsoft Edge neural voices).

manim-voiceover ships services for OpenAI, Azure, Gemini, gTTS, pyttsx3, ElevenLabs and a
microphone recorder, but not for edge-tts. This adds one.

edge-tts is free and needs no API key. Its Romanian voices are `ro-RO-AlinaNeural` (female)
and `ro-RO-EmilNeural` (male).

edge-tts reports word timings in 100-nanosecond ticks, the same unit manim-voiceover's
`WordBoundary.audio_offset` uses (`AUDIO_OFFSET_RESOLUTION == 10_000_000`), so the timings
pass through unconverted. That means `<bookmark mark="..."/>` and `wait_until_bookmark()`
work without a Whisper transcription.

Usage:

    from edge_tts_service import EdgeTTSService

    class MyScene(VoiceoverScene):
        def construct(self):
            self.set_speech_service(EdgeTTSService(voice="ro-RO-AlinaNeural"))
"""
import asyncio
import re
import tempfile
from pathlib import Path

import edge_tts
from pydub import AudioSegment
from manim_voiceover._typing import VoiceoverData, WordBoundary
from manim_voiceover.helper import remove_bookmarks
from manim_voiceover.services.base import (
    PathLike,
    SpeechService,
    initialize_speech_service,
    path_to_string,
)

DEFAULT_VOICE = "ro-RO-AlinaNeural"

# The end of a sentence: . ! or ? followed by white space.
SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text):
    """The sentences of `text`, each as (start, end) character positions."""
    spans = []
    start = 0
    for gap in SENTENCE_END.finditer(text):
        spans.append((start, gap.start()))
        start = gap.end()
    if start < len(text):
        spans.append((start, len(text)))
    return spans


async def _synthesize(text, voice, rate, volume, pitch, out_path):
    """Write the mp3 and collect the word boundary events edge-tts sends with it."""
    # The default is SentenceBoundary, which would give one timing per sentence and make
    # bookmarks useless. Word boundaries are the whole point of using this service.
    communicate = edge_tts.Communicate(
        text, voice, rate=rate, volume=volume, pitch=pitch, boundary="WordBoundary"
    )
    chunks = []
    with open(out_path, "wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                chunks.append(chunk)
    return chunks


def to_word_boundaries(chunks, text):
    """Turn edge-tts WordBoundary events into manim-voiceover WordBoundary entries.

    `text` must already have its bookmarks removed: the tracker interpolates audio time from
    the character position of a bookmark inside the bookmark-free text, so `text_offset` has
    to index that same string.
    """
    boundaries: list[WordBoundary] = []
    cursor = 0
    for chunk in chunks:
        word = chunk["text"]
        found = text.find(word, cursor)
        if found < 0:
            # A voice may normalise what it speaks (a number read out as words, say), so the
            # spoken word is not always in the text. Keep the cursor where it is; the
            # interpolation between the surrounding words stays sound.
            found = cursor
        else:
            cursor = found + len(word)
        boundaries.append(
            {
                "audio_offset": chunk["offset"],
                "duration_milliseconds": chunk["duration"] // 10_000,
                "text_offset": found,
                "word_length": len(word),
                "text": word,
                "boundary_type": "Word",
            }
        )
    return boundaries


class EdgeTTSService(SpeechService):
    """Speech service for the free Microsoft Edge neural voices."""

    def __init__(
        self,
        voice: str = DEFAULT_VOICE,
        rate: str = "+0%",
        volume: str = "+0%",
        pitch: str = "+0Hz",
        sentence_pause: float = 0.0,
        **kwargs: object,
    ) -> None:
        """
        Args:
            voice: an edge-tts voice name, e.g. "ro-RO-AlinaNeural".
            rate: speech speed as a signed percentage, e.g. "-10%".
            volume: loudness as a signed percentage.
            pitch: pitch shift in Hz, e.g. "+10Hz".
            sentence_pause: seconds of silence added after every sentence but the last.
                The voice's own pause between sentences is short for a lesson, and
                edge-tts accepts no SSML <break>, so each sentence is spoken on its own
                and the pieces are joined with silence.
        """
        initialize_speech_service(self, kwargs)
        self.voice = voice
        self.rate = rate
        self.volume = volume
        self.pitch = pitch
        self.sentence_pause = sentence_pause

    def generate_from_text(
        self,
        text: str,
        cache_dir: PathLike | None = None,
        path: PathLike | None = None,
        **kwargs: object,
    ) -> VoiceoverData:
        if cache_dir is None:
            cache_dir = self.cache_dir

        input_text = remove_bookmarks(text)
        input_data = {
            "input_text": input_text,
            "service": "edge-tts",
            "voice": self.voice,
            "rate": self.rate,
            "volume": self.volume,
            "pitch": self.pitch,
        }
        # Only when set, so the cached audio of a clip without pauses stays valid.
        if self.sentence_pause:
            input_data["sentence_pause"] = self.sentence_pause

        cached_result = self.get_cached_result(input_data, cache_dir)
        if cached_result is not None:
            return cached_result

        if path is None:
            audio_path = self.get_audio_basename(input_data) + ".mp3"
        else:
            audio_path = path_to_string(path)

        out_path = Path(cache_dir) / audio_path
        if self.sentence_pause:
            chunks = self._synthesize_with_pauses(input_text, out_path)
        else:
            chunks = asyncio.run(
                _synthesize(input_text, self.voice, self.rate, self.volume, self.pitch, out_path)
            )

        return {
            "input_text": text,
            "input_data": input_data,
            "original_audio": audio_path,
            "word_boundaries": to_word_boundaries(chunks, input_text),
        }

    def _synthesize_with_pauses(self, text, out_path):
        """Speak each sentence on its own and join them with `sentence_pause` of silence.

        The word boundary events of every sentence are shifted by the audio that comes
        before it, so bookmarks and captions still land on the right word.
        """
        pause = AudioSegment.silent(duration=round(self.sentence_pause * 1000))
        joined = AudioSegment.empty()
        chunks = []
        with tempfile.TemporaryDirectory() as tmp:
            spans = split_sentences(text)
            for index, (start, end) in enumerate(spans):
                piece_path = Path(tmp) / f"{index}.mp3"
                events = asyncio.run(
                    _synthesize(
                        text[start:end], self.voice, self.rate, self.volume, self.pitch, piece_path
                    )
                )
                shift = len(joined) * 10_000  # milliseconds to 100 ns ticks
                for event in events:
                    chunks.append({**event, "offset": event["offset"] + shift})
                joined += AudioSegment.from_mp3(piece_path)
                if index < len(spans) - 1:
                    joined += pause
        joined.export(out_path, format="mp3", bitrate="64k")
        return chunks
