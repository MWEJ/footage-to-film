# Editing

## The beat grid

Choose the tempo before anything else, and measure the music's real tempo (`references/music.md`; for the user's own song, `music-grid.py` there). 120 BPM gives 2 s bars and 0.5 s beats, which land on whole frames at 30 fps. Other tempos work: cuts are rounded to the nearest frame.

`film.config.ts` holds `bpm` and `bars` (the film's length). Each section has a first bar and a length in bars, and a `grid`:

- `'beat'` (the default): every shot and photo must start and end on a half-beat. `npm run check` fails otherwise. A layer can opt out with `free: true`.
- `'free'`: for a section cut to speech, where the words decide the cuts.

Write times as `T(bar, beat)`.

## Story and energy

Lay sections on bar lines with an energy plan that follows the music: soft under speech, full at the peaks, a silence or a drop on the key moment. Show the user the outline before building.

With the song's stems (`music.md`), the plan is carried out by each section's `music` in `film.config.ts`: sections under speech as `'bed'` or `'no-vocals'`, peaks as `'full'` starting on a bar line (the song comes back whole on it), a silence as `'off'`.

- Full-energy music: shots of 1 to 2 s, with occasional half-second bursts. Medium: 2 to 3 s. Soft or under speech: 2 to 4 s.
- Each bar should look different from the last: alternate full-frame shots, panel rows and cards. Avoid more than about 3 s of one layout.
- Pick the best moment of each clip: faces visible, smiles, action.
- A change of day or place can take a wipe (`wipeOut` at the end of one section, `wipeIn` at the start of the next) and a `chapterTag`; use it a few times in a film, not at every cut.

## Frame shape

- **Wide (16:9).** Put vertical clips and photos in a `panelRow`: three across, or two. Use a vertical clip full frame only when the action fits a 16:9 window, which is about 32% of the clip's height at zoom 1; set `full: true` on the shot and `"full": true` on its select, or the crop is soft. Landscape clips go full frame.
- **Tall (9:16).** Vertical clips go full frame. Landscape clips are stacked in a `panelRow` (two or three rows), or cropped full frame when the subject is in the middle; such a crop is about 32% of the clip's width, so set `full: true` there too. Keep text out of the top 10% and the bottom 16% of the frame (`SAFE`); the components do.
- **Square.** Both kinds of clip are cropped; check every focus.
- Telephoto clips shot from far away fall apart beyond about 1.6 times zoom. Put them in a panel.

## Framing

Every shot has a `focus` `[x, y, zoom]`. Check the focus of every shot on a contact sheet: heads not cropped, headroom left, no gutter through a face. Slow push-ins (`zoomTo` a little above the starting zoom) suit stills and calm shots. `faceFocus(clip, t)` gives a focus on the largest face. `npm run check` fails when a crop cuts through one.

## Speech

- A shot with `audio: 'speech'` plays the clip's own sound from the same in-point as its picture, so lips are in sync without any offset arithmetic. Keep its `speed` at 1.
- Every spoken shot needs a `caption` over it. Correct names in captions by passing `lines`.
- The music ducks under speech by itself, as far as `npm run speech` measured it needs to (`sound.md`).
- Read the transcript of any natural-sound bed (`audio: 'nat'`) before using it: it may contain strangers' names.

## Text

- Sizes: hero title 200 to 320 px at 1080p, headings 72 to 120, labels 22 to 40, never below 22.
- Keep text inside the safe margin and off faces. Over footage, text needs a scrim; the house components bring their own.
- Text animates in, holds long enough to read (1.2 s or more for a label, 2 s or more for a title), and leaves.
- One accent-coloured element per frame.

## Checking your work

It is the only way to catch mistakes.

- `npm run check` after every change.
- `npm run sheet -- <start> <end>` for each stretch of at most 24 beats (12 s at 120 BPM; 36 beats in a tall or square film, whose narrower cells go six to a row): that fills one sheet; a longer stretch is split into sheets ending `_p1`, `_p2`. Read every sheet. For each shot ask: is the subject framed well? Any cropped heads? Is text readable, spelled right, inside the margins, off faces, clear of other text? Any backdrop showing where a picture should be? Does each cut land on a beat?
- `npm run still -- <seconds>` for a closer look at type and framing.
