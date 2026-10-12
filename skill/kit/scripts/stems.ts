// The mix as four stems, before mastering: dialogue, natural sound, effects, music.   npm run stems
// Each is the film rendered with only that group sounding. They are checked against a render of everything.
import fs from 'node:fs';
import path from 'node:path';
import { decodeMono, residualDb } from './lib/audio';
import { EDIT_DIR, dir, out } from './lib/paths';
import { run } from './lib/tools';

const GROUPS = ['dialogue', 'natural', 'effects', 'music'] as const;
const LIMIT = -50; // decibels under the mix

function main(): void {
  const remotion = path.join(EDIT_DIR, 'node_modules', '.bin', 'remotion');
  const log = path.join(dir('logs'), 'stems.log');
  fs.writeFileSync(log, `${new Date().toISOString()}  stems\n`);
  const folder = dir('audio', 'stems');
  const files = GROUPS.map((g) => {
    const file = path.join(folder, `${g}.wav`);
    run(remotion, ['render', 'Film', file, '--codec=wav', `--props={"only":"${g}"}`], { log });
    return file;
  });
  const mixFile = path.join(out(), 'stems-mix.wav');
  run(remotion, ['render', 'Film', mixFile, '--codec=wav'], { log });
  const left = residualDb(decodeMono(mixFile, 48000), files.map((f) => decodeMono(f, 48000)));
  if (left > LIMIT) {
    console.error(`STEMS FAIL  the stems do not sum to the mix: what is left over is ${left.toFixed(1)} dB under it (limit ${LIMIT})`);
    process.exit(1);
  }
  console.log(`STEMS_OK  ${folder}  (the stems sum to the mix within ${left.toFixed(1)} dB)`);
}

try {
  main();
} catch (e) {
  console.error(`STEMS FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
