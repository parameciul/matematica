# Make a lesson clip

A lesson clip is a short Manim video of one part of a material, spoken in Romanian, with Romanian and English subtitles. The project is `video/` (Python, `uv`); the renders and the upload files go to `.work/video/` (git ignores it). Files: `docs/agents/architecture.md`, "Video".

1. **Pick one idea.** One clip covers one part of a section (for example "Proprietăți ale inegalităților", then "Intervale" + its example as the next clip). Split a part when the clip would get long.
2. **Write the scene** in `video/scenes/<material name>/NN-<slug>.py` (`NN` = the clip number within the material). Copy the header of an existing clip: `VOICE = "ro-RO-AlinaNeural"`, `RATE = "-8%"`, `SENTENCE_PAUSE = 0.8`, a `BilingualVoiceoverScene`, `create_subcaption=True`, and `self.write_english_subtitles()` at the end. Every spoken block is `with self.say(ro="…", en="…") as t:`. Put `CLIP_TITLE_RO` / `CLIP_TITLE_EN` at the bottom.
3. **Render a draft** from `video/`: `uv run manim render -ql scenes/<material name>/NN-<slug>.py <Scene>`. Make a contact sheet of frames (`ffmpeg -i <mp4> -vf "fps=1/5,scale=427:-1,tile=5x7" -frames:v 1 sheet.png`) and look at every frame: no text off the frame, no overlaps, no title above the wrong picture. Commit the scene as soon as the draft renders.
4. **Render the final** with `-qh`. Copy from `.work/video/videos/NN-<slug>/1080p60/` to `.work/video/final/`:
   - `<Scene>.mp4` → `NN-<slug>.mp4`
   - `<Scene>.srt` → `NN-<slug>.ro.srt`
   - `<Scene>.en.srt` → `NN-<slug>.en.srt`
5. **Write the upload files** in `.work/video/final/`:
   - `NN-<slug>.youtube-title.txt`: `CLIP_TITLE_RO` ("<topic> — clasa a IX-a").
   - `NN-<slug>.youtube-description.txt`: line 1 is the material page URL (copy it from the page's `<link rel="canonical">`). Then one sentence on the clip, a short "În acest clip:" list, "Capitole:" with timestamps, a link to https://lauramiron.pages.dev/, "Subtitrări: română și engleză." and 3-4 hashtags. Read the chapter times from the first cue of each part in `NN-<slug>.ro.srt`. YouTube needs the first chapter at `0:00`, at least 3 chapters, and each chapter at least 10 s long. The description never mentions other clips, and never holds class codes or school dates.
   - `NN-<slug>.youtube-tags.txt`: comma-separated tags, under 500 characters in total: the topic words, the same words without diacritics for the main ones ("multimi de numere"), both grade forms ("clasa a 9-a", "clasa a IX-a"), "matematică clasa a 9-a", "Laura Miron".
6. **Check and send.** Both `.srt` files have about the same number of cues, no `{`, no `<bookmark`, only comma-below `ș ț`. Send the frames, the `.mp4`, both `.srt` files and the three text files to the user. The user uploads to YouTube: the video, the title, the description, the tags, `.ro.srt` as the Romanian track and `.en.srt` as the English track.
7. **After a change**, render only the clips that changed, copy them again and update the chapter times in the description (they move when a sentence changes).

To show a clip on the material page, follow "Add a YouTube video" in `docs/agents/manage-materials.md`.

## Rules for clips

- **Every clip stands alone.** Never mention what the previous clip covered or what the next clip will cover, neither at the start nor at the end.
- **The voice needs help:**
  - Write the math as Romanian words ("minus doi", "plus infinit", "unu supra a"), never as symbols or digits.
  - Write every math letter in braces in the Romanian text: `{a}`, `{B}`. The voice swallows a lone letter (a lone "a" lasts 10 ms); the braces make it say the letter with a short pause after it, and the subtitles show the plain letter.
  - Where the voice reads a letter wrongly, give its spoken form after a bar: `{b|be}`, `{c|ce}`. A comma inside it adds the pause the other letters get: `{d|de,}` before a word ("… {c|ce} și {d|de,} avem …").
  - Avoid the one-letter word "o" ("cu o inegalitate"): the voice swallows it too. Rephrase ("cu inegalitățile", "ambii membri").
  - A pause or a pronunciation can be measured before a render: edge-tts reports each word with its duration and offset (`boundary="WordBoundary"`).
- **Leave time to think.** `SENTENCE_PAUSE = 0.8` adds silence after each sentence, and `say()` waits 1 s after each block. The English line must have the same number of sentences as the Romanian one; `say()` stops with an error otherwise.
- **Good Romanian.** Avoid cacophony in all Romanian text (spoken, captions, pages): no "că ca…", "că că…", "că co…", "că cu", "la la", "cu cu" and similar. Rephrase ("Paranteza dreaptă ne spune: capătul aparține…", not "arată că capătul").
- **Drawings:**
  - A title changes together with its picture, in one step: a title never stays above the wrong content.
  - On an axis, draw the ends of an interval with the same signs as the notation: `[` `]` for an end that belongs to it, `(` `)` for one that does not. No filled dots or hollow circles.
  - Show a wrong form in red with a `greșit` label. Never draw an X over it: the student must still read it.
  - Draw a letter like ℝ next to text with `MathTex(r"\mathbb{R}")`, lined up with the foot of the last letter, not with the tail of a `p`.
  - Manim colours number labels white by default: call `line.numbers.set_color(TEXT)` after every `NumberLine`.
- **Worked examples:** first write what is being calculated (`A ∪ B =`), then find it on the drawing, and write the value last.
- **Voice and pace are fixed:** `ro-RO-AlinaNeural`, `-8%`, chosen by listening tests. Change them only when the user asks.
