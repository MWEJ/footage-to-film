# Before delivering

## While editing

- `npm run check` passes. It covers sources, sections, beats, captions and faces. Read its notes too: a note about a small cut face, backdrop-only stretches or a silent film may be a mistake.
- Every section's contact sheets have been read, and a sheet across every section boundary.
- Names, titles and places on screen are spelled as the user confirmed.
- `npm run speech` has been run since the spoken shots last changed (its output says how many it cleaned and kept, and how far the music ducks under them).
- When the film is cut to the user's own song: the user has heard the click track and the cut song (`music.md`).

## The user's review

The user has watched the rough cut (`npm run draft`, or Studio) and their notes are done. If they have not watched the final version of a passage, say so when you deliver.

## After the final render: `npm run qc`

It writes `logs/qc.md`. Every line must be dealt with.

| Line | Passes when | If not |
|---|---|---|
| length and size | frame count, frame rate and size match the edit | render again; read `logs/film.log` |
| colour tags | the file is tagged BT.709 | render again with `npm run film` |
| black frames | none | find the time on a still; something is drawing black |
| frozen picture | no stretch of 1 s or more (a NOTE, not a failure) | look at the film there: a shot may have run past the end of its file, or a card holds still |
| single-frame glitches | no frame differs in brightness from both its neighbours, and no jump in brightness away from a cut (a NOTE, not a failure) | the row names the times: look at stills on both sides of each (`npm run still`). A camera flash or a light switched on in the footage is not a fault; a frame of the wrong shot, or a blank one, is |
| loudness | −14 LUFS within 0.5 | see `sound.md` |
| true peak | at or below −1 dBTP | see `sound.md` |
| sound against the master | the sound in the file is the mastered mix, within 1 ms | render again |
| clip sound in sync | every sounding shot within one frame of its source | see `sound.md` |
| spoken lines | every caption line is found in a transcript of the final mix, around its own caption (from 0.5 s before it to 0.8 s after it) | the row says why each lost line is lost: clear without the music (the mix covers it), clear in the clip but not after cleaning, or unclear in the recording itself. See `sound.md`. SKIP means whisper was not available: say that nothing checked the lines |
| stills | always a NOTE | read every sheet in `review/qc/` beside `index.md`: spelling, cropped heads, text over faces |

`QC PASS (n not checked)` is not a clean pass. Say what was not checked.

## A film that replaces an earlier one: `npm run compare`

It measures where the last two films differ, picture and sound, and sets that against what the two edits' shot lists say changed (`changes.md`).

- `COMPARE_OK … all of it where the edit changed`, or `… picture and sound are the same throughout`: nothing else moved. Read the pairs in `review/compare/` all the same.
- `COMPARE LOOK`: something differs that the shot lists do not explain. Read `review/compare/compare.md`; the stretches marked **no** are the ones to account for. A change in `film.config.ts` or inside a drawn element is expected to show here; anything else is a fault.

## Delivering

- The film is in the footage folder. A later render is named "(render 2)"; nothing is overwritten.
- Before telling the user what is safe to delete, check that the originals still exist: `node SKILL/scripts/originals.mjs "<footage>"` must say `ORIGINALS_OK`.
- One short message: what the film is, where it is, and the honest caveats (what the user has not watched, what was not checked, what you are unsure of).
- If the user reports no sound, measure the file before changing anything (`ffprobe`, `afinfo`): the app's file preview can play video silently.
