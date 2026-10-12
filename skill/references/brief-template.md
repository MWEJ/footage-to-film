# Brief: "<film title>"

You are one of several editors working in parallel on one short film. Each editor owns one section and writes one file that describes its layers (shots, photos, text). A lead editor combines the sections, renders and checks. Nobody here can play video or hear audio: you verify by rendering stills and contact sheets and reading them.

## The film

- <What it is, who it is for, what happened, in two or three sentences.>
- Spell exactly: `<Name>`, `<Title or degree>`, `<Place>`, `<Date>`. Do not put any fact, name, quote or number on screen that is not in this brief or your section's spec.
- People: <who is who, and how to recognise them in the footage>.
- Tone: <for example: joyful, proud, warm, a little playful>. Look: clean and editorial; no clip-art, no emoji.
- Format: <1920x1080 wide, 1080x1920 tall or 1080x1080 square>, <30> fps, <N> s. Theme, exactly as in `film.config.ts`: <a preset's name (house, paper, night, coast, postcard, fiesta, candy, hearth), or the film's own object, for example `{ base: 'coast', color: { accent: '#FFD166' } }`>. Components take their colours and fonts from it; do not set your own.
- Taste and privacy: <what must never be shown>. Do not linger on strangers' faces.

## Timeline

The music is fixed: <BPM> BPM, a bar is <N> s, a beat is <N> s, bar 1 beat 1 is 0 s. `T(bar, beat)` gives seconds.

| Section | Editor | Bars | Time (s) | Cut to | Music | Story |
|---|---|---|---|---|---|---|
| open | 1 | 1 to 7 | 0 to 14 | speech (`grid: 'free'`) | soft under speech | <…> |
| title | 1 | 8 to 11 | 14 to 22 | the beat | full, drop at 14.0 | <…> |

Sections meet with hard cuts on the bar line.

## Your section

- Your file is `edit/src/sections/<id>.tsx`. Edit only that file. Every layer must lie inside your bars.
- Your clips and photos, with the moments worth using: <from notes/selects.md, with clip times>.
- Spoken lines in your section: <clip, in-point, the words, from notes/transcripts.md>.
- What is converted: `edit/src/sources.json` lists every file and the range of its clip that it covers. A shot outside those ranges fails the check.

## How to write it

Read `references/components.md` in the skill's folder (the lead gives you the path): layer types `shot`, `photo`, `el`, `sfx`; components `titleCard`, `endCard`, `lowerThird`, `chapterTag`, `caption`, `panelRow`, `polaroid`, `handNote`, `confetti`, `flash`, `wipeOut`, `wipeIn`, `wordPop`, `route`; the theme.

Sound effects: see `references/sound.md` for the names; use them sparingly.

## Editing rules

- Cut on the beat: every shot and photo starts and ends on a half-beat, and layouts change on bar lines where possible. In a section cut to speech, the words decide.
- Full-energy music: shots of 1 to 2 s. Medium: 2 to 3 s. Soft or under speech: 2 to 4 s.
- Each bar should look different from the last. Avoid more than about 3 s of one layout.
- Follow the frame shape (see `references/editing.md`): in a wide film vertical clips go in a `panelRow`; in a tall film landscape clips do. A clip cropped to fill the frame needs `full: true`. Use `faceFocus(clip, t)` to frame on a face.
- Check the focus of every shot: heads not cropped, no gutter through a face.
- A spoken shot uses `audio: 'speech'` at speed 1 and has a `caption`. Pass `lines` to correct a name.
- Text: inside the safe margin, off faces, long enough to read. One accent element per frame.

## Checking your work

Run inside `edit/`:

- `npm run check` must end with `CHECK PASS`.
- `npm run sheet -- <start> <end>` for your section, at most 24 beats (12 s at 120 BPM; 36 in a tall or square film) at a time: that fills one sheet; a longer stretch is split into sheets ending `_p1`, `_p2`. Read every sheet.
- `npm run still -- <seconds>` for a closer look.

For each shot ask: is the subject framed well? Is text readable, spelled right, inside the margins, clear of faces and other text? Is anything backdrop-only that should not be? Does each cut land on a beat?

Rendering is heavy and other editors share the machine: render what you need to look at, and never run `npm run film`.

## Hand-back

Reply in at most 250 words: the shot list as a compact table (time, what), which sheets you read, anything you are unsure about or could not make work, and every piece of factual text you put on screen.
