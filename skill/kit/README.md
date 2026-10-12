# The edit of this film

A Remotion project, made from the footage-to-film kit. The film is described as data: `film.config.ts` (title, size, tempo, length, music, sections) and one file per section in `src/sections/`. `skill/references/components.md` in the kit's repository describes the layer types and components.

The music setting is `music: { file, gain?, duck?, under?, at?, stems? }`: `under` is how many dB below the speech the music sits while someone speaks (12 when left out; `duck`, a fixed gain, switches that measurement off), `at` the second of the file that plays at the film's 0 s (the song's first bar), `stems` a folder in `audio/` with the song's four stems. A section's entry can add `music: 'full' | 'no-vocals' | 'bed' | 'off'`; all but `'full'` and `'off'` need the stems. `skill/references/music.md` and `sound.md` explain them.

Run these inside this folder.

| Command | What it does |
|---|---|
| `npm run studio` | live preview with sound, in the browser |
| `npm run check` | checks the edit without rendering: sources, sections, beats, captions, faces |
| `npm run still -- 15.5` | one full-size frame, into `../review/stills/` (add `--stamp` for the time, `--theme=fiesta` for another preset) |
| `npm run sheet -- 22 38` | a contact sheet, one stamped frame per beat, into `../review/sheets/` (`--theme=fiesta` for another preset) |
| `npm run looks -- 3` | that frame of the film in its own look and in every preset, on one sheet in `../review/looks/` |
| `npm run fonts` | measures a font family added to `src/fonts.ts` and `src/fonts.json` (`-- --all` measures them all again) |
| `npm run draft` | a half-size film with unmastered sound, `../review/draft.mp4` |
| `npm run film` | the film: picture, sound, master. Written next to `film-project/`; a later render gets "(render 2)" in its name. `-- --replace` overwrites the first |
| `npm run qc` | the final checks on the film just made, written to `../logs/qc.md`, with stills in `../review/qc/` |
| `npm run speech` | clean and level the spoken shots, into `../sources/speech/`, and measure how far the music ducks under each (`src/duck.json`); run it again after changing one. `-- --again` makes every file anew |
| `npm run stems` | the mix as four stems: dialogue, natural sound, effects, music, into `../audio/stems/` |
| `npm run list -- 38 46` | the edit as a shot list: what is on screen and heard between two times (all of it without times), also written to `../notes/shotlist.md` |
| `npm run changes` | where the edit's shot list differs from the last film's (`-- "<version name>"` for an earlier one) |
| `npm run compare` | where the last two films differ, picture and sound, set against what the edit changed; pairs of stills and a report in `../review/compare/`. `-- "<earlier film>" "<later film>"` compares two others |
| `npm run preview` | a copy of the last film of at most 24 MB, `../review/preview.mp4`, to send (`-- "<film>"` for another) |
| `npm run link` | makes `public/` point at `../sources` and `../audio` (needed once) |
| `npm test`, `npm run lint` | the kit's own unit tests and type check |

Every film that `npm run film` makes keeps a version of this edit in `../versions/<film name>/`: `film.config.ts`, the sections, the data files of `src/` and the shot list. Text only; never media.

Media is not copied into this folder: `public/mezz`, `public/photos`, `public/audio` and `public/speech` are links to the film project's folders.

Safe to delete: `out/` (working files) and `node_modules/` (restore with `npm ci`). Everything else here is the edit.

Remotion is free for individuals and for companies of up to three people; larger companies need a licence (remotion.dev/license).
