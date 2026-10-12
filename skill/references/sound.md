# Sound

## What plays

- **Music**: the file named in `film.config.ts`, from `music.at` seconds into it (0 when left out), or its four stems (`music.md`).
- **Speech**: a shot with `audio: 'speech'` plays its clip's own sound, cut at the same in-point as its picture. After `npm run speech` it plays a cleaned and levelled copy of that sound.
- **Natural sound**: a shot with `audio: 'nat'` plays its clip's sound at `gain` (1 is unchanged; 0.3 is a quiet bed).
- **Effects**: `sfx({ t, name, gain? })` plays `audio/sfx/<name>.wav`. `gain` is in decibels, −12 if left out.
- Shots without `audio` are silent.

## Effects

`whoosh_short`, `whoosh_long`, `whoosh_rev`, `pop`, `tick`, `shutter`, `impact_soft`, `shimmer`, `riser_2s`, `ding`. Use them sparingly: roughly one every two seconds at most, fewer in soft passages. A whoosh on a big layout change, a pop on a callout, a shutter on a photo burst, a shimmer or a soft impact on a title or a musical drop, a riser into a drop. Keep `gain` between −20 and −10. A film can add its own WAV files to `film-project/audio/sfx/`.

## Cleaned speech

Run `npm run speech` in `edit/` once the spoken shots are settled, and again after changing any of them. For each spoken shot it first measures the recording: how far the speech stands over the noise between the words (the loudest third of its 50 ms frames against the quietest fifth), and that noise's shape in the denoiser's 15 bands. Then it writes `sources/speech/<clip>_<in>_<length>.wav`:

- rumble filtered out below 90 Hz;
- steady noise turned down only as far as that recording needs: 30 dB less the measured distance, none when that comes to under 2 dB, at most 12 dB. The denoiser (ffmpeg's `afftdn`) is told the noise's own shape and a floor 6 dB over it; told the plain level instead, it took out a fraction of what it was asked. Measured on the smoke test's clip (speech 27 dB over pink noise), 3 dB asked took the noise between the words down 3.5 dB against the speech; on a copy with the noise 15 dB under the voice, 12 dB asked took it down 12.3 dB;
- only the loud words held back, by a 3:1 compressor whose threshold sits 3 dB over the recording's own speech level (a fixed threshold squeezed a loud recording all the way through and brought its noise up by 5.7 dB);
- a little presence (2.5 dB at 3.2 kHz) so consonants carry over music, and the hiss above 14 kHz off;
- levelled to −17 LUFS, with a fade of 12 ms in and 30 ms out so the shot does not click.

Its output says, for each shot, how far the speech stood over its noise and how much noise was taken out. The file is cut from the shot's converted clip at the shot's own in-point (the denoiser's 25 ms delay is taken off when it is used), so it stays in sync.

A shot that is moved or trimmed afterwards no longer matches its file and plays its clip's own sound until `npm run speech` is run again. `clean: false` on a shot keeps its own sound for good. Spoken shots at a speed other than 1, or from a file without sound, are not cleaned. `npm run speech -- --again` makes every file anew. The noise is judged from the quietest moments of the shot itself: a shot with no pause between its words is judged noisier than it is, so if its line comes out dull, set `clean: false`. The cleaning is gentle: on a noisy clip, prefer a cleaner take.

## Ducking

`npm run speech` also measures how loud the music is under each spoken range (the music rendered alone, without ducking) and writes `src/duck.json`: the music is turned down so that it sits 12 dB below the speech's −17 LUFS, by at least 4 dB and at most 18. `music: { under: 16 }` in `film.config.ts` asks for more room; `music: { duck: 0.3 }` sets one fixed gain and switches the measurement off. The music eases down over 0.4 s before a line and comes back over 0.1 s after it, so a musical drop right after a line is not swallowed; lines a second apart or closer share one duck, at the deeper of their depths. A spoken range that moves on the timeline falls back to a gain of 0.4 (8 dB down) until `npm run speech` is run again; so does one shorter than half a second, which is too short to meter. Natural sound and effects do not duck the music.

With the song's stems (`music.md`), the singing leaves entirely under speech: it fades out over 0.3 s, is gone 0.1 s before the first word, and comes back over 0.3 s after the last.

## The master

`npm run film` renders the picture and the mix separately, then masters the mix in two passes to −14 LUFS integrated with a true peak at or below −1 dBTP at 48 kHz, and puts it on the picture without re-encoding the picture. The mastered mix is kept as `audio/final_mix.flac`.

## Stems

`npm run stems` writes `audio/stems/dialogue.wav`, `natural.wav`, `effects.wav` and `music.wav`: the mix before mastering, one group at a time, and checks that they sum to the whole. Use them to hand the sound to someone else, or to find which group is causing a problem.

## When the final checks complain

- **`spoken lines` FAIL**: a line is being lost, and the row says why. *Clear without the music*: the mix covers it; give speech more room (`music: { under: 16 }`, or a lower `duck` if the film sets one), make the section a bed (`music: 'bed'`, with the song's stems), or move an effect. *Clear in the clip but not after cleaning*: set `clean: false` on the shot and run `npm run speech`. *Unclear in the recording itself*: the caption carries it; choose another take if the line matters. *Could not be checked further*: no spoken shot at normal speed plays under the caption, so its clip could not be heard alone; listen there yourself. Then render and check again.
- **`clip sound in sync` FAIL**: a spoken shot is not where its picture is. Look for a `speed` other than 1 on a speech shot.
- **A note that the first milliseconds of a shot's sound are missing**: the shot starts on the first sample of its converted file. Move its in-point a little later, or start its select earlier and run `convert.mjs` again.
- **`loudness` or `true peak` FAIL**: read `logs/film.log` for the two loudness passes.
