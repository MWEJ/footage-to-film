# Music

Offer the routes early; the user chooses by ear.

1. **A track the user supplies**, or picks from a free library (Uppbeat's free tier lists tempo).
2. **A song they own**, if the film stays private: the film is cut to it ("A song the film is cut to", below).
3. **Generated takes** with ACE-Step, if it is installed at `~/code/ACE-Step-1.5` (the tool check says).

Composing music from code was tried once: it took 2.5 hours and nobody could hear the result. Do not.

## Any track: screen it before anyone listens

Put the candidates (WAV, FLAC, MP3 or M4A) in `film-project/audio/candidates/` and run:

```bash
uv run --python 3.12 --with librosa --with soundfile python SKILL/scripts/music-screen.py "<footage>" --bpm 120
```

`--bpm` is the tempo the film will be cut to. It writes `audio/candidates/report.md` with, for each candidate: whether it holds a steady grid near that tempo (one its own beats confirm, at that tempo or at half or double it), its exact tempo and how far its beats stray; its key; its loudness; its energy over time; silence at its ends; and how loud a voice is in it (Demucs's vocal stem against the mix; `--no-vocals` skips this slow step). It also writes `matched/<name>.mp3`, each turned down to −17 LUFS, so the user compares music and not loudness. Levels are matched downwards only. `report.json` has the same and more, such as the time of the first beat (`grid.first_beat_s`).

If Demucs's model is not on this Mac, the screen does not start Demucs (it would download the model): it prints a note with the model's source and size, and the voice column says "not measured". Ask the user; when they agree, run the screen again with `--fetch`.

Read the report, drop the candidates that fail it, and send the user the matched MP3s. **The user chooses by ear.**

- On the grid: use it as it is.
- A few percent off: stretch it with Rubber Band (`ffmpeg -i in.wav -af rubberband=tempo=<target/measured> out.wav`) and screen it again.
- No steady grid near the film's tempo: measure the track's own tempo and first bar with `music-grid.py` (below), set `bpm` to it and cut to that, or leave the track.
- If the first bar is not at 0, set `music.at` to the second where it starts (`first_bar_s` from `music-grid.py`); the film's bar 1 starts at 0 s.

Put the chosen track in `film-project/audio/` and name it in `edit/film.config.ts`: `music: { file: 'music.wav' }`. It ducks under speech by measurement (`sound.md`); `gain` (linear, 1 when left out) turns it up or down throughout.

## A song the film is cut to

When the user brings a song, the film takes the song's tempo, not the other way round. Put the song in `film-project/audio/` and work through these four steps. The first is always needed; the others when the film calls for them.

**1. Its tempo and first bar.**

```bash
uv run --python 3.12 --with librosa --with soundfile python SKILL/scripts/music-grid.py "<footage>" song.wav
```

It writes `audio/song.grid.json` (the tempo to three decimals of a BPM, the length of a beat and a bar, where the first beat and bar 1 start, how far the beats stray from one steady grid, how many bars the song has) and `audio/song_click.mp3`: the song with a tick on every beat and a higher tick on the "one". (Not in `candidates/`, where the screen would take it for a candidate.) **Send the user the click track**: they confirm by ear that the ticks sit on the beat and that the high tick starts the bar. If the high tick is on the wrong beat, run again with `--bar-shift 1` (or 2, 3); if the tempo is half or double what they tap, run again with `--near <bpm>`. A song marked `NOT steady` (its beats stray more than 15 ms) was played without a click, or changes tempo: cut to it loosely (`grid: 'free'` sections), or choose another.

Then set, in `edit/film.config.ts`: `bpm` to the measured tempo with all its decimals, and `music: { file: 'song.wav', at: <first_bar_s> }`. A cut lands on the frame nearest its beat.

**2. Its stems**, so that the singing steps aside for speech and sections can thin the music:

```bash
node SKILL/scripts/music-stems.mjs "<footage>" song.wav
```

It writes `audio/song.stems/` (vocals, drums, bass, other) with Demucs; `other` is made as the song minus the other three, so the four sum to the song, and the script measures that they do. If Demucs's model is not on this Mac, the script stops before starting Demucs and says what Demucs would fetch (about 84 MB, from Hugging Face): ask the user, then run it again with `--fetch`. Set `music: { …, stems: 'song.stems' }`. From then on the singing fades out before every spoken shot and returns after it, and each section in `film.config.ts` can say how much of the song it plays: `music: 'full'` (the default), `'no-vocals'`, `'bed'` (no drums, no singing, the bass at 0.7: under a long spoken passage) or `'off'`. Music thins over the last quarter second of the section before and comes back on the bar line, so a return to `'full'` lands as a hit: put the film's big moments there. `npm run check` refuses `'no-vocals'` and `'bed'` without stems.

**3. Cut to the film's length and shape.** A film is rarely as long as its song. Write `audio/arrange.json`:

```json
{ "file": "song.wav", "grid": "song.grid.json", "out": "song_cut.wav", "stems": "song.stems",
  "parts": [ { "bar": 1, "bars": 8, "from": 1 }, { "bar": 9, "bars": 16, "from": 33 }, { "bar": 25, "bars": 6, "from": 85 } ] }
```

`bar` is the film's bar, `from` the song's bar (1 is the bar at `first_bar_s`), `bars` how many; the film's bars follow on from 1 without a gap. Choose the parts from the song's shape: the report of `music-screen.py` gives its energy over time; an intro, a verse for the spoken part, a chorus for the peak, the song's own ending for the end. Jump only between places that sound alike (the start of one chorus to the start of another), in whole bars, ideally in multiples of four.

```bash
uv run --python 3.12 --with soundfile --with numpy python SKILL/scripts/music-arrange.py "<footage>"
```

It writes `audio/song_cut.wav`, which starts at the film's bar 1 and ends with a 0.6 s fade, and `audio/song_cut.stems/`, cut the same way. Where the song jumps, the join sits 15 ms before the downbeat with a 20 ms crossfade, so the downbeat lands whole; parts that follow on in the song are not cut. Set `music: { file: 'song_cut.wav', stems: 'song_cut.stems' }` and remove `at`. **Send the user the cut song** before building on it: nobody has heard the joins.

**4. Check.** `npm run check`, then `npm run sheet` across a few bars late in the film with the song playing in Studio, or a draft: cuts that land on the beat at bar 3 and drift by bar 60 mean the tempo is off.

A song the user owns is fine for a film that stays private. Say so when the film might be published.

## Generating takes with ACE-Step

If the tool check found ACE-Step, write the takes you want as `film-project/audio/candidates/takes.json`:

```json
[{ "name": "A_indie_pop", "caption": "Upbeat indie pop instrumental, joyful and celebratory. Bright strummed acoustic guitar, warm piano chords, hand claps, punchy live drums.", "bpm": 120, "duration": 176, "seed": 1101, "keyscale": "D Major" }]
```

and run, as a background command (a 3-minute take needs about 2.5 minutes):

```bash
cd ~/code/ACE-Step-1.5 && .venv/bin/python SKILL/scripts/music-takes.py "<footage>"
```

Add `--dry-run` first to check the list, and that ACE-Step's two models are in its `checkpoints/` folder. Each take is written to `audio/candidates/<name>.flac`; then screen them as above.

- Give tempo, key and length as `bpm`, `keyscale` and `duration`, not in the caption.
- Leave `lyrics` out (it defaults to `[Instrumental]`): those takes locked to the requested tempo on the first film (120.00 BPM, beats within 5 ms of the grid). A written section plan in `lyrics` gave more light and shade but loose timing (118 to 122.7 BPM).
- The requested key is not followed reliably. The screen measures it.
- Vary `seed` and the caption between takes; offer the user three or four.

Ask before any model download, stating file name, source and size.
