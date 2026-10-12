---
name: footage-to-film
description: Use when asked to turn a folder of phone videos and photos into a finished short film on this Mac, with music, captions for spoken lines and titles, or to continue, change or re-render a film whose folder has a film-project inside.
---

# Footage to film

Turn a folder of phone footage into a finished short film: a story, cuts on the beat, titles, a caption for every spoken line, music under a mastered mix. The film is edited as text in a Remotion project and rendered on this Mac. All work happens in `film-project/` inside the footage folder.

`SKILL` below means the folder this file is in. Every script takes the footage folder as its first argument. Each prints one verdict line (`…_OK`, or `TOOLS PASS` for the tool check; a line with `FAIL` when it fails) and exits non-zero on failure; believe the verdict, not the absence of errors.

## Ground rules

- You cannot watch video or hear audio. Judge picture from stills and contact sheets that you render and then read. Judge sound by measurement.
- The user watches the rough cut before the final render (step 9). When you deliver, say exactly what the user has not reviewed.
- Only facts from the footage, its metadata or the user go on screen. Get names, titles and place spellings confirmed before the final render.
- Never change or delete the original footage. Write only inside `film-project/`. Delete only your own temporary files.
- Do a taste and privacy pass on every select: nothing the family would not want on screen, no lingering on strangers, no sound that carries other people's names.

## Resume first

If `<footage>/film-project/STATUS.md` exists, read it and continue from its "Next" line. Do not create the project again.

If `film-project/` exists with a `render/` folder and no `STATUS.md`, the film was made with the earlier kit: read `references/earlier-kit.md`, then the project's own `HANDOFF.md` or `README.md`, and work with the project's own tools. The steps below do not apply to it.

Update `STATUS.md` at the end of every step. Its headings are fixed: `Step`, `Decisions`, `Done`, `Next`, `Open questions`.

## Changing a finished film

When the user comes back with notes on a film that was delivered, read `references/changes.md` first. In short: `npm run list -- <from> <to>` finds what is at the times they name; make the change; `npm run changes` says where the edit now differs from the last film; after `npm run film`, `npm run compare` measures that the film differs there and nowhere else. Every film keeps a version of its edit in `film-project/versions/`.

## The ten steps

**1. Ask first, once.** Format (wide 16:9 for a TV or laptop, tall 9:16 for phones, or square), what kind of film it is (a trip, a party, a family occasion), which decides the first looks to try, length, the title and the names to show, music (their own track, a free library track, or generated), and what to leave out. Then start. Later questions go alongside results.

**2. Create the project and check the tools.**

```bash
node SKILL/scripts/new-film.mjs "<footage>" --title "<Film title>"
```

It refuses if the project exists (one that an earlier run left half-made is completed). It ends with the tool check; if that fails, fix what it names (see "Installing") and run `bash SKILL/scripts/check-tools.sh "<footage>"` again. Record the answers from step 1 under `Decisions`.

**3. See what is there.**

```bash
node SKILL/scripts/inventory.mjs "<footage>"
node SKILL/scripts/strips.mjs "<footage>"
node SKILL/scripts/transcribe.mjs "<footage>" --language=en
```

Read `notes/inventory.md` (clips and photos by day and scene), the frame strips in `review/strips/`, the photo sheets `review/photos_NN.jpg`, and `notes/transcripts.md`. A phrase marked doubtful there may be invented: check it against the strip. Leave out `--language` to let whisper detect it.

**4. Choose the selects.** Start one sub-agent per day or scene with the Agent tool, all in one message so they run together. Each reads its scene's strips, photos and transcripts and returns the best moments with clip times, marked for quality, and anything that fails the taste and privacy pass. Combine them into `notes/selects.md` (to read) and `notes/selects.json` (to convert):

```json
{ "handle": 0.5, "clips": [{ "clip": "IMG_5608", "a": 11.0, "b": 31.0, "full": false, "note": "nails, the spoken title" }] }
```

`a` and `b` are seconds in the original clip. Set `"full": true` for a clip that will be cropped to fill the frame: a vertical clip in a wide film, a landscape clip in a tall one.

**5. Story, beat grid, look.** Choose the tempo first: 120 BPM gives 2 s bars and 0.5 s beats, which land on whole frames at 30 fps. When the user brings a song, take its tempo and first bar from `music-grid.py` first (`references/music.md`, "A song the film is cut to"). Lay the sections on bar lines with an energy plan: soft under speech, full at the peaks, a silence or a drop on the key moment. See `references/editing.md`. Set `width` and `height` in `edit/film.config.ts` for the format (1920x1080, 1080x1920 or 1080x1080). For the look, put the film's title into the `titleCard` in `edit/src/sections/example.tsx` and run `npm run looks -- 3` in `edit/`: it writes one sheet with that title in every preset (`references/components.md` says which suit a trip, a party, a family occasion). The presets are starting points: when the user wants other colours or fonts, change one in `film.config.ts` (`theme: { base: 'coast', color: { accent: '#FFD166' } }`, taking colours from the footage where you can) and run it again. **Show the user the outline and the sheet, and wait for their choice.**

**6. Write the brief.** Copy `SKILL/references/brief-template.md` to `notes/BRIEF.md` and fill it in. Every section editor works only from the brief.

**7. In parallel: convert, and settle the music.** Run the conversion as a background command; it logs to `logs/convert.log`.

```bash
node SKILL/scripts/convert.mjs "<footage>"
```

It writes the converted clips to `sources/mezz/` and lists them in `edit/src/sources.json`. When it has finished, find the faces: `swift SKILL/scripts/faces.swift "<footage>"` writes `edit/src/faces.json`, which the check uses to catch crops that cut through a face. Run it again after any later conversion; a clip it has not seen is not checked. Meanwhile get the music: collect or generate candidates, screen them with `music-screen.py`, and send the user the level-matched MP3s (see `references/music.md`). Put the chosen track in `film-project/audio/` and name it in `edit/film.config.ts` (`music: { file: 'music.wav' }`). For the user's own song: its grid, its stems, and a cut to the film's length, each confirmed by ear. **The user chooses the music by ear.**

**8. Edit.** In `edit/`: set title, `bpm`, `bars` and the section list in `film.config.ts`; create one file per section in `src/sections/` and list them in `src/sections/index.ts`. Then give each section to its own sub-agent (Agent tool, one message), each with the brief and `SKILL/references/components.md`, each editing only its own section file and checking its own contact sheets. Review the joins yourself: `npm run check`, then a sheet across every section boundary. When the spoken shots are settled, run `npm run speech` to clean and level them; run it again after changing one.

**9. Rough cut, with the user.** `npm run draft` writes a half-size film with sound to `review/draft.mp4`; `npm run studio` serves a live preview (tell the user the address it prints, or open it in the app's browser pane). **The user watches and gives notes by timestamp.** Fix, check, show again, until they approve. Studio is for timing and sound; judge framing and colour from stills.

**10. Final render and checks.** Run as a background command; it takes one to two seconds per second of film and logs to `logs/film.log`.

```bash
npm --prefix "<footage>/film-project/edit" run film
npm --prefix "<footage>/film-project/edit" run qc
```

Read `logs/qc.md` and every sheet in `review/qc/` beside its `index.md`. See `references/checks.md` for what each line means and what to do about it. For a film that replaces an earlier one, run `npm run compare` too. Finish with one short message: what the film is, where it is, and the honest caveats.

## The edit's commands

Run inside `film-project/edit/`. `edit/README.md` has the same list.

| Command | Use |
|---|---|
| `npm run check` | validate the edit without rendering, faces included |
| `npm run still -- 15.5` | one full-size frame, to check type and framing |
| `npm run sheet -- 22 38` | a contact sheet, one stamped frame per beat |
| `npm run looks -- 3` | one sheet: that frame in every look |
| `npm run draft` | half-size film for watching |
| `npm run studio` | live preview with sound |
| `npm run film` | the film, mastered; never overwrites an earlier render |
| `npm run qc` | the final checks |
| `npm run speech` | clean and level the spoken shots, and measure how far the music ducks under them |
| `npm run stems` | the mix as four stems: dialogue, natural sound, effects, music |
| `npm run list -- 38 46` | what is on screen and heard between two times |
| `npm run changes` | where the edit differs from the last film |
| `npm run compare` | where the last two films differ, picture and sound |
| `npm run preview` | a copy of the film of at most 24 MB, to send |

## Long jobs

Conversion and the final render can take minutes. Start them as background commands and read their log when they finish. Do not poll in a loop.

## Installing

If the tool check names something missing:

- Preview with `brew install --dry-run <name>` first.
- Install with `HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1 HOMEBREW_NO_INSTALL_CLEANUP=1` set, so nothing else is upgraded or removed.
- Before any model or other large download, ask, stating the file name, the source and the size.
- Never edit the user's shell profile.

## References

Read the one a step needs.

- `references/tools.md`: what each tool is for, and its quirks.
- `references/colour.md`: HDR to standard range, colour tags, photos.
- `references/editing.md`: the beat grid, editing rules, frame shapes, framing on faces.
- `references/components.md`: layer types and components, with their options.
- `references/music.md`: where the music comes from, screening candidates, a song the film is cut to, generating takes.
- `references/sound.md`: effects, cleaned speech, ducking, the master, stems.
- `references/checks.md`: what to verify before delivering.
- `references/changes.md`: changing a finished film, and showing that only that changed.
- `references/mistakes.md`: mistakes already made once.
- `references/brief-template.md`: the brief for section editors.
- `references/earlier-kit.md`: continuing a film whose project has a `render/` folder.
