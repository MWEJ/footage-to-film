# Changing a finished film

The user has watched a film and wants something different: another shot, a name spelled right, a line cut, new clips worked in. The edit is text, so a change is small; what takes care is changing only that, and showing it.

## Before touching anything

1. Read `STATUS.md` and the newest folder in `film-project/versions/`: it holds the edit as it was when that film was made (`film.config.ts`, the sections, the shot list).
2. `npm run changes` in `edit/`: if it does not say "nothing has changed", the edit has moved since the last film. Find out why before adding to it.
3. Find what the user means. They speak in times read off a player: `npm run list -- 38 46` shows what is on screen and heard between those seconds, with the clip, the source range, the section and the bar. It also writes the whole list to `notes/shotlist.md`.
4. If they added or moved footage: `node SKILL/scripts/originals.mjs "<footage>"` names files that are not in the inventory. Take them in with `node SKILL/scripts/inventory.mjs "<footage>" --force` (clip ids do not change; scenes are numbered anew; it says what is new and what is gone), then `strips.mjs` and `transcribe.mjs`, which only do what is new. Add selects to `notes/selects.json`, run `convert.mjs` and `faces.swift`.

## Making the change

- **Another shot, a trim, a different crop**: edit the section file. To centre a crop on something that is not a face, `node SKILL/scripts/grid.mjs "<footage>" <clip or photo id> [seconds ...]` writes `review/grid/<id>.jpg`: the picture under a ten-by-ten grid, lines numbered in tenths, so a point reads as `focus: [x, y]`. Without seconds it shows five frames spread over the clip.
- **A caption that reads wrong** (a name, a misheard word): `caption({ shot, say: 'Okay, my name is Maya Hansen.' })`. The words take their times from the transcript; a word whisper never heard is placed between its neighbours.
- **A film that should be shorter or longer**: this moves everything after the change. Change `bars` and the sections in `film.config.ts`; if the film is cut to a song, cut the song again (`music.md`).
- After any change to a spoken shot: `npm run speech`.

Then `npm run check`, and `npm run sheet` across the stretch that changed, a bar to each side.

## Showing what changed

1. `npm run changes`: the stretches of the timeline where the edit now differs from the last film. This is what you intend.
2. `npm run draft` if the user should see it before a full render; otherwise `npm run film`. Every film keeps a version of the edit under `versions/<film name>/` and never replaces an earlier film.
3. `npm run compare`: measures where the new film differs from the one before, picture and sound, and writes `review/compare/compare.md` with the middle frame of each stretch, before and after, side by side (`pairs_NN.jpg`).
   - `COMPARE_OK … all of it where the edit changed`: the change did what was meant and nothing else. Read the pairs.
   - `COMPARE LOOK`: something differs that the shot lists do not explain; the report's last column says **no** for those stretches. A change in `film.config.ts` (theme, music, tempo) or inside a drawn element is not in the lists and is expected to show here; anything else is a fault to find before delivering. A difference that reaches more than half a second past a change is split there, and only the part at the change counts as explained.
   - Films of different lengths differ from the first change on; the comparison says so.
   - Two films of different sizes cannot be compared. To compare other films than the last two, pass both files, the earlier first.
4. `npm run qc`. The stills to read again are those in the stretches that changed; all of them when the comparison found something unexplained.
5. `npm run preview` writes `review/preview.mp4` (at most 24 MB) to send when the user is not at the Mac.

Tell the user what changed, at which times, and that the rest of the film is measured to be the same. Add the delivery to `STATUS.md`.

## Going back

A version folder is the edit at that time. To return to it, copy its `film.config.ts` and `src/sections/` over the edit's, run `npm run speech`, then `npm run check` and `npm run changes -- "<version name>"`, which should say that nothing has changed. The version's `src/*.json` files (sources, transcripts, faces, cleaned speech, ducking) record the data that film was made from; copy one back only when that data has changed since and the old film must be matched exactly. The films themselves are never deleted; the user decides which to keep.

Do not rename a finished film, or move it into a subfolder: its version is found by the film's name in the footage folder itself, and a film the versions do not name is footage to the inventory. Moving the whole footage folder is fine.

## Before anything is deleted

`node SKILL/scripts/originals.mjs "<footage>"` must say `ORIGINALS_OK` before you tell the user that `film-project/sources/` can go: if an original is missing or has changed, the converted copy is the only one.
