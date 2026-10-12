// The final checks on a finished film.   npm run qc [-- "<film file>"]
// Without a file it checks the film that npm run film made last.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../film.config';
import { FPS, FRAMES, H, SECONDS, W, toFrame } from '../src/grid';
import { fileFor } from '../src/sources';
import type { ElLayer, ShotLayer } from '../src/types';
import { bestLag, decodeMono, rms } from './lib/audio';
import { parseStats } from './lib/compare';
import { glitches } from './lib/glitch';
import { groupMarks, type Mark } from './lib/marks';
import { EDIT_DIR, dir, out } from './lib/paths';
import { run, tool, whisper } from './lib/tools';
import { diagnose, heardFromWhisper, heardIn, lineFound, type Heard } from './lib/words';

type Result = 'PASS' | 'FAIL' | 'NOTE' | 'SKIP';
type Row = { check: string; result: Result; detail: string };

const RATE = 8000; // samples per second for measuring offsets: 0.125 ms steps

async function main(): Promise<void> {
  const { ALL } = await import('../src/edit');
  const given = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const last = path.join(out(), 'last-film.txt');
  const film = given ?? (fs.existsSync(last) ? fs.readFileSync(last, 'utf8').trim() : '');
  if (!film) throw new Error('there is no film to check: run npm run film first, or pass the file');
  if (!fs.existsSync(film)) throw new Error(`${film} does not exist`);

  const ff = tool('ffmpeg');
  const log = path.join(dir('logs'), 'qc.log');
  fs.writeFileSync(log, `${new Date().toISOString()}  final checks of ${film}\n`);
  const rows: Row[] = [];
  const add = (check: string, result: Result, detail: string) => rows.push({ check, result, detail });

  // 1. The file is the length, size and colour the edit says.
  const probe = JSON.parse(
    run(tool('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,r_frame_rate,width,height,color_space,color_transfer,color_primaries', '-of', 'json', film]).stdout,
  ).streams[0] as Record<string, string | number>;
  const shape = Number(probe.nb_frames) === FRAMES && probe.r_frame_rate === `${FPS}/1` && probe.width === W && probe.height === H;
  add('length and size', shape ? 'PASS' : 'FAIL', `${probe.nb_frames} frames (the edit has ${FRAMES}), ${probe.r_frame_rate} fps, ${probe.width}x${probe.height}`);
  const tags = [probe.color_space, probe.color_transfer, probe.color_primaries];
  add('colour tags', tags.every((t) => t === 'bt709') ? 'PASS' : 'FAIL', tags.join(', '));

  // 2. Black and frozen pictures. The backdrop is never black, so any black frame is a fault.
  const seen = run(ff, ['-hide_banner', '-nostats', '-i', film, '-vf', 'blackdetect=d=0.05:pix_th=0.03,freezedetect=n=-60dB:d=1', '-an', '-f', 'null', '-'], { log }).stderr;
  const black = [...seen.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${Number(m[1]).toFixed(2)} to ${Number(m[2]).toFixed(2)} s`);
  add('black frames', black.length === 0 ? 'PASS' : 'FAIL', black.length === 0 ? 'none' : black.join(', '));
  const starts = [...seen.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...seen.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const frozen = starts.map((a, i) => `${a.toFixed(2)} to ${(ends[i] ?? SECONDS).toFixed(2)} s`);
  add('frozen picture', frozen.length === 0 ? 'PASS' : 'NOTE', frozen.length === 0 ? 'none of 1 s or longer' : `${frozen.join(', ')}: look at the film there; a shot may have run past the end of its file`);

  // 2b. Faults of a single frame: a flicker inside a shot, or a jump in brightness where the edit has no cut.
  const lumaText = run(ff, ['-v', 'error', '-i', film, '-vf', 'scale=160:-2:flags=area,signalstats,metadata=print:file=-', '-an', '-f', 'null', '-']).stdout;
  const luma = parseStats(lumaText).map((s) => s.avg);
  const cuts = new Set<number>();
  for (const l of ALL) {
    if (l.kind === 'sfx') continue;
    cuts.add(toFrame(l.a));
    cuts.add(toFrame(l.a + l.d));
  }
  const g = glitches(luma, cuts);
  const at = (frames: number[]): string => frames.slice(0, 8).map((f) => `${(f / FPS).toFixed(2)} s`).join(', ') + (frames.length > 8 ? ` and ${frames.length - 8} more` : '');
  const found = [g.flickers.length > 0 ? `a one-frame flicker at ${at(g.flickers)}` : '', g.jumps.length > 0 ? `a jump in brightness away from any cut at ${at(g.jumps)}` : ''].filter(Boolean);
  add('single-frame glitches', found.length === 0 ? 'PASS' : 'NOTE', found.length === 0 ? 'none' : `${found.join('; ')}: look at stills on both sides of each (npm run still); a camera flash or a light switched on in the footage is not a fault`);

  // 3. Loudness and peak of the sound in the file, after encoding.
  const meter = run(ff, ['-hide_banner', '-nostats', '-i', film, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { log }).stderr;
  const lufs = Number([...meter.matchAll(/^\s*I:\s+(-?[\d.]+) LUFS/gm)].pop()?.[1]);
  const peak = Number([...meter.matchAll(/^\s*Peak:\s+(-?[\d.]+) dBFS/gm)].pop()?.[1]);
  const silent = !(lufs > -60);
  if (silent) {
    add('loudness', 'SKIP', 'the film is silent');
  } else {
    add('loudness', Math.abs(lufs + 14) <= 0.5 ? 'PASS' : 'FAIL', `${lufs.toFixed(1)} LUFS (target -14, within 0.5)`);
    add('true peak', peak <= -1 ? 'PASS' : 'FAIL', `${peak.toFixed(1)} dBTP (at most -1)`);
  }

  // 4. The sound in the file is the mastered mix, and it has not moved against the picture.
  const flac = path.join(dir('audio'), 'final_mix.flac');
  if (silent || !fs.existsSync(flac)) {
    add('sound against the master', 'SKIP', silent ? 'the film is silent' : `${flac} is missing`);
  } else {
    const inFilm = decodeMono(film, RATE);
    const ref = decodeMono(flac, RATE);
    const n = Math.min(ref.length, inFilm.length, 30 * RATE);
    const { lag, match } = bestLag(ref.subarray(0, n), inFilm.subarray(0, n), Math.round(0.05 * RATE));
    const ms = (lag / RATE) * 1000;
    add('sound against the master', Math.abs(ms) <= 1 && match > 0.9 ? 'PASS' : 'FAIL', `${ms.toFixed(1)} ms late, match ${match.toFixed(3)}`);
  }

  // 5. Every shot that plays its own sound is in sync with its source. Measured on a render without music or effects.
  const sounding = ALL.filter((l): l is ShotLayer => l.kind === 'shot' && (l.audio ?? 'off') !== 'off');
  // The film without music and effects, rendered here; check 6 listens to it again when a line is lost.
  const clips = path.join(out(), 'clips.wav');
  let clipsMade = false;
  if (sounding.length === 0) {
    add('clip sound in sync', 'SKIP', 'no shot plays its sound');
  } else {
    const wav = clips;
    run(path.join(EDIT_DIR, 'node_modules', '.bin', 'remotion'), ['render', 'Film', wav, '--codec=wav', '--props={"music":false,"sfx":false}'], { log });
    clipsMade = true;
    const low = decodeMono(wav, RATE);
    const full = decodeMono(wav, 48000);
    const sources = new Map<string, { low: Float32Array; full: Float32Array }>();
    const bad: string[] = [];
    const remarks: string[] = [];
    let measured = 0;
    let worst = 0;
    for (const l of sounding) {
      const name = `shot ${l.clip} at ${l.a.toFixed(2)} s`;
      if ((l.speed ?? 1) !== 1) {
        remarks.push(`${name} plays at speed ${l.speed}: not measured`);
        continue;
      }
      if (sounding.some((o) => o !== l && o.a < l.a + l.d && o.a + o.d > l.a)) {
        remarks.push(`${name} overlaps another sounding shot: not measured`);
        continue;
      }
      const file = fileFor(l);
      let src = sources.get(file.file);
      if (!src) {
        const p = path.join(EDIT_DIR, 'public', 'mezz', file.file);
        src = { low: decodeMono(p, RATE), full: decodeMono(p, 48000) };
        sources.set(file.file, src);
      }
      const head = Math.min(0.3, l.d / 4); // skip the start and the end of the shot, where neighbours bleed in
      const count = Math.round((l.d - head - 0.1) * RATE);
      const x = low.subarray(Math.round((l.a + head) * RATE), Math.round((l.a + head) * RATE) + count);
      const ref = src.low.subarray(Math.round((l.in - file.a + head) * RATE), Math.round((l.in - file.a + head) * RATE) + count);
      if (rms(ref) < 1e-4) {
        remarks.push(`${name}: its source is silent there`);
        continue;
      }
      const { lag, match } = bestLag(ref, x, Math.round(0.2 * RATE));
      const ms = (lag / RATE) * 1000;
      measured++;
      worst = Math.max(worst, Math.abs(ms));
      if (Math.abs(ms) > 1000 / FPS || match < 0.5) bad.push(`${name} is ${ms.toFixed(1)} ms late (match ${match.toFixed(2)})`);
      // Sound missing at the very start: <Video> drops about 12 ms when a shot starts on its file's first sample.
      const at = Math.round(l.a * 48000);
      const from = Math.round((l.in - file.a) * 48000);
      let lead = 0;
      while (lead < 4800 && Math.abs(full[at + lead]) < 1e-5) lead++;
      if (lead >= 240 && rms(src.full.subarray(from, from + lead)) > 1e-3) remarks.push(`${name}: the first ${(lead / 48).toFixed(0)} ms of its sound are missing`);
    }
    const detail = bad.length > 0 ? bad.join('; ') : `${measured} measured, worst offset ${worst.toFixed(1)} ms`;
    add('clip sound in sync', bad.length > 0 ? 'FAIL' : measured > 0 ? 'PASS' : 'SKIP', remarks.length > 0 ? `${detail}; ${remarks.join('; ')}` : detail);
  }

  // 6. The spoken lines can still be heard in the final mix: a transcript of the film against the captions.
  const expected = ALL.filter((l): l is ElLayer => l.kind === 'el' && l.tag === 'caption').flatMap((l) => l.text ?? []);
  const w = whisper();
  if (expected.length === 0) {
    add('spoken lines', 'SKIP', 'the edit has no captions');
  } else if (silent) {
    add('spoken lines', 'FAIL', 'the edit has captions, but the film is silent');
  } else if (!w) {
    add('spoken lines', 'SKIP', 'whisper-cli or its model was not found, so nothing has checked that the lines can be heard');
  } else {
    /** Transcribes a sound file (or a part of one) with times. */
    const transcribe = (src: string, name: string, cut: string[] = []): Heard[] => {
      const wav = path.join(out(), `${name}.wav`);
      run(ff, ['-v', 'error', '-y', ...cut, '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { log });
      const base = path.join(out(), name);
      run(w.bin, ['-m', w.model, '-f', wav, '-l', config.language, '-oj', '-of', base, '-np'], { log });
      return heardFromWhisper(JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')));
    };
    const captions = ALL.filter((l): l is ElLayer => l.kind === 'el' && l.tag === 'caption');
    const inFilm = transcribe(film, 'qc_film');
    // A line is looked for around its own caption: half a second before it to a little after it.
    const around = (heard: Heard[], c: ElLayer): string => heardIn(heard, c.a - 0.5, c.a + c.d + 0.8);
    const lost = captions.flatMap((c) => (c.text ?? []).map((s) => ({ c, s, ...lineFound(s, around(inFilm, c)) }))).filter((r) => !r.found);
    let speechOnly: Heard[] | null = null;
    const reasons = lost.map((r) => {
      // The same line in the speech alone (the render without music and effects that check 5 made), and in the clip itself.
      if (speechOnly === null && clipsMade) speechOnly = transcribe(clips, 'qc_speech');
      const speech = speechOnly ? lineFound(r.s, around(speechOnly, r.c)).ratio : null;
      const shot = sounding.find((l) => l.audio === 'speech' && l.a < r.c.a + r.c.d && l.a + l.d > r.c.a);
      let raw: number | null = null;
      if (shot && (shot.speed ?? 1) === 1) {
        const file = fileFor(shot);
        const heard = transcribe(path.join(EDIT_DIR, 'public', 'mezz', file.file), 'qc_raw', ['-ss', (shot.in - file.a).toFixed(3), '-t', shot.d.toFixed(3)]);
        raw = lineFound(r.s, heard.map((h) => h.s).join(' ')).ratio;
      }
      return `"${r.s}" (${Math.round(r.ratio * 100)}% of its words): ${diagnose({ speech, raw })}`;
    });
    add('spoken lines', lost.length === 0 ? 'PASS' : 'FAIL', lost.length === 0 ? `all ${expected.length} caption lines are in the transcript of the final mix` : `not heard: ${reasons.join('; ')}`);
  }

  // 7. Stills from the finished file: just after every cut, and of every text element. Someone has to read them.
  const marks: Mark[] = [];
  for (const l of ALL) {
    if (l.kind === 'sfx') continue; // neither a cut nor text
    if (l.kind === 'el') {
      const text = l.text ?? [];
      if (text.length === 0) continue;
      if (l.stills) l.stills.forEach((t, i) => marks.push({ t, cut: false, what: `text: ${text[i] ?? text.join(' / ')}` }));
      else marks.push({ t: l.a + 0.6 * l.d, cut: false, what: `text: ${text.join(' / ')}` });
    } else {
      marks.push({ t: l.a + Math.min(0.4, l.d / 2), cut: true, what: l.kind === 'shot' ? `cut to shot ${l.clip}, in-point ${l.in.toFixed(2)} s` : `cut to photo ${l.name}` });
    }
  }
  const byFrame = new Map<number, string[]>();
  for (const m of groupMarks(marks)) {
    const f = Math.max(0, Math.min(FRAMES - 1, toFrame(m.t)));
    byFrame.set(f, [...(byFrame.get(f) ?? []), ...m.what]);
  }
  const frames = [...byFrame.keys()].sort((a, b) => a - b);
  const qcDir = dir('review', 'qc');
  for (const f of fs.readdirSync(qcDir)) fs.rmSync(path.join(qcDir, f), { recursive: true, force: true });
  const cells = path.join(out(), 'qc-cells');
  fs.rmSync(cells, { recursive: true, force: true });
  fs.mkdirSync(cells, { recursive: true });
  const cellW = Math.round((480 * W) / Math.max(W, H));
  // Narrow cells (a tall frame) go six to a row, like the contact sheet.
  const cols = cellW >= 400 ? 4 : 6;
  const perSheet = cols * 6;
  const sheets = Math.ceil(frames.length / perSheet);
  if (frames.length > 0) {
    // One pass over the film writes every wanted frame as a small JPEG, numbered from 1 in time order.
    run(ff, ['-v', 'error', '-y', '-i', film, '-vf', `select='${frames.map((f) => `eq(n,${f})`).join('+')}',scale=${cellW}:-2`, '-fps_mode', 'vfr', '-q:v', '3', path.join(cells, 'c_%04d.jpg')], { log });
    const index = ['# Stills from the finished film', '', 'Cells run left to right, top to bottom.', '', '| Sheet | Cell | Time | What |', '|---|---|---|---|'];
    for (let s = 0; s < sheets; s++) {
      const part = frames.slice(s * perSheet, (s + 1) * perSheet);
      const file = `qc_${String(s + 1).padStart(2, '0')}.jpg`;
      run(ff, ['-v', 'error', '-y', '-framerate', '1', '-start_number', String(s * perSheet + 1), '-i', path.join(cells, 'c_%04d.jpg'), '-vf', `tile=${cols}x${Math.ceil(part.length / cols)}:padding=6:margin=6:color=0x1a1a1a`, '-frames:v', '1', '-q:v', '3', path.join(qcDir, file)], { log });
      part.forEach((f, i) => index.push(`| ${file} | ${i + 1} | ${(f / FPS).toFixed(2)} s | ${(byFrame.get(f) ?? []).join('; ').replace(/\|/g, '/')} |`));
    }
    fs.writeFileSync(path.join(qcDir, 'index.md'), `${index.join('\n')}\n`);
  }
  add('stills', 'NOTE', `${frames.length} stills on ${sheets} sheet${sheets === 1 ? '' : 's'} in ${qcDir}: read them with index.md for spelling, cropped heads and text over faces`);

  // The verdict.
  const fails = rows.filter((r) => r.result === 'FAIL').length;
  const skips = rows.filter((r) => r.result === 'SKIP').length;
  const verdict = fails > 0 ? `QC FAIL (${fails})` : skips > 0 ? `QC PASS (${skips} not checked)` : 'QC PASS';
  const report = ['# Final checks', '', `Film: ${film}`, `Checked: ${new Date().toISOString()}`, '', '| Check | Result | Detail |', '|---|---|---|', ...rows.map((r) => `| ${r.check} | ${r.result} | ${r.detail.replace(/\|/g, '/')} |`), '', verdict, ''];
  fs.writeFileSync(path.join(dir('logs'), 'qc.md'), report.join('\n'));
  for (const r of rows) console.log(`${r.result.padEnd(4)}  ${r.check}: ${r.detail}`);
  console.log(verdict);
  if (fails > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`QC FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
