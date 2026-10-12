// Cleans and levels the sound of every spoken shot, then measures the music under each spoken range.   npm run speech [-- --again]
// Each file is cut from the shot's converted file at the shot's own in-point, so it stays in sync with the picture.
// How far each recording is cleaned is judged from the recording itself. --again makes every file anew.
// How far the music ducks under each range is written to src/duck.json.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../film.config';
import { duckDepth, duckKey } from '../src/duck';
import { speechRanges } from '../src/layers';
import { fileFor } from '../src/sources';
import { speechKey } from '../src/speech';
import type { ShotLayer } from '../src/types';
import { decodeMono, noiseBands, speechLevels } from './lib/audio';
import { isSilent, parseLoudnorm } from './lib/master';
import { EDIT_DIR, PROJECT, dir, out } from './lib/paths';
import { chainFor, cleanArgs, measureArgs, noiseCut, speechName } from './lib/speech';
import { run, tool } from './lib/tools';

const RATE = 16000; // for judging how far the speech stands over the noise
const FULL = 48000; // for the noise's shape, up to afftdn's top band
const SPEECH_LUFS = -17; // the level cleaned speech is brought to

async function main(): Promise<void> {
  if (!PROJECT) throw new Error('there is no film project above this folder');
  const { ALL } = await import('../src/edit');
  const again = process.argv.includes('--again');
  const ff = tool('ffmpeg');
  const log = path.join(dir('logs'), 'speech.log');
  fs.writeFileSync(log, `${new Date().toISOString()}  speech${again ? ' --again' : ''}\n`);
  const folder = path.join(PROJECT, 'sources', 'speech');
  fs.mkdirSync(folder, { recursive: true });

  const map: Record<string, string> = {};
  const decoded = new Map<string, { low: Float32Array; full: Float32Array }>();
  let cleaned = 0;
  let kept = 0;
  let skipped = 0;
  for (const l of ALL.filter((x): x is ShotLayer => x.kind === 'shot' && x.audio === 'speech')) {
    const where = `shot ${l.clip} at ${l.a.toFixed(2)} s`;
    if (l.clean === false) {
      console.log(`NOTE  ${where}: clean is false, so it keeps its own sound`);
      skipped++;
      continue;
    }
    const file = fileFor(l);
    if ((l.speed ?? 1) !== 1 || !file.audio) {
      console.log(`NOTE  ${where}: ${file.audio ? `plays at speed ${l.speed}` : 'its file has no sound'}, so it is not cleaned`);
      skipped++;
      continue;
    }
    const name = speechName(l);
    const outFile = path.join(folder, name);
    map[speechKey(l)] = name;
    if (fs.existsSync(outFile) && !again) {
      kept++;
      continue;
    }
    const src = path.join(EDIT_DIR, 'public', 'mezz', file.file);
    // How far does the speech stand over the noise between the words? That decides how much noise is taken out.
    const all = decoded.get(src) ?? { low: decodeMono(src, RATE), full: decodeMono(src, FULL) };
    decoded.set(src, all);
    const part = (x: Float32Array, rate: number) => x.subarray(Math.round((l.in - file.a) * rate), Math.round((l.in - file.a + l.d) * rate));
    const levels = speechLevels(part(all.low, RATE), RATE);
    const chain = chainFor({ ...levels, bands: noiseBands(part(all.full, FULL), FULL) });
    const cut = noiseCut(levels.snr);
    console.log(`  ${where}: speech ${levels.snr.toFixed(0)} dB over its noise, ${cut > 0 ? `${cut} dB of noise taken out` : 'no noise reduction'}`);
    const measured = parseLoudnorm(run(ff, measureArgs(src, l.in - file.a, l.d, chain), { log }).stderr);
    if (isSilent(measured)) {
      console.log(`NOTE  ${where}: there is no sound to clean`);
      delete map[speechKey(l)];
      skipped++;
      continue;
    }
    run(ff, cleanArgs(src, l.in - file.a, l.d, chain, measured, outFile), { log });
    cleaned++;
  }
  fs.writeFileSync(path.join(EDIT_DIR, 'src', 'speech.json'), `${JSON.stringify(map, null, 1)}\n`);

  // How loud is the music under each spoken range? Rendered alone and without ducking, then metered range by range.
  const depths: Record<string, number> = {};
  let ducked = '';
  const ranges = speechRanges(ALL);
  if (config.music && config.music.duck === undefined && ranges.length > 0) {
    const flat = path.join(out(), 'music-flat.wav');
    run(path.join(EDIT_DIR, 'node_modules', '.bin', 'remotion'), ['render', 'Film', flat, '--codec=wav', '--props={"only":"music","flat":true}'], { log });
    for (const [a, b] of ranges) {
      if (b - a < 0.5) continue; // too short for the meter
      const meter = run(ff, ['-hide_banner', '-nostats', '-ss', a.toFixed(3), '-t', (b - a).toFixed(3), '-i', flat, '-af', 'ebur128', '-f', 'null', '-'], { log }).stderr;
      const lufs = Number([...meter.matchAll(/^\s*I:\s+(-?[\d.]+) LUFS/gm)].pop()?.[1]);
      if (!(lufs > -60)) continue; // no music there
      depths[duckKey(a, b)] = Math.round(duckDepth(lufs, SPEECH_LUFS, config.music.under ?? 12) * 10) / 10;
    }
    const values = Object.values(depths);
    if (values.length > 0) ducked = `; the music ducks ${Math.min(...values)} to ${Math.max(...values)} dB under ${values.length} spoken range${values.length === 1 ? '' : 's'}`;
  }
  fs.writeFileSync(path.join(EDIT_DIR, 'src', 'duck.json'), `${JSON.stringify(depths, null, 1)}\n`);
  console.log(`SPEECH_OK  ${cleaned} cleaned, ${kept} kept, ${skipped} skipped${ducked}: ${folder}`);
}

main().catch((e) => {
  console.error(`SPEECH FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
