// Renders the film: check, picture, sound, master.   npm run film [-- --replace]
// A draft for watching: half size, sound not mastered.   npm run draft
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../film.config';
import { BAR, BEAT, FPS, FRAMES, H, SECONDS, W } from '../src/grid';
import { rowsOf, table } from './lib/list';
import { master } from './lib/master';
import { nextFilmPath } from './lib/names';
import { EDIT_DIR, FOOTAGE, PROJECT, dir, out } from './lib/paths';
import { run } from './lib/tools';
import { keepVersion } from './lib/versions';

const BIN = path.join(EDIT_DIR, 'node_modules', '.bin');
const REMOTION = path.join(BIN, 'remotion');

function timed<T>(label: string, fn: () => T): T {
  const t0 = Date.now();
  const result = fn();
  console.log(`  ${label}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return result;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const draft = args.includes('--draft');
  const t0 = Date.now();
  const log = path.join(dir('logs'), draft ? 'draft.log' : 'film.log');
  fs.writeFileSync(log, `${new Date().toISOString()}  ${draft ? 'draft' : 'film'}: ${config.title}, ${SECONDS} s, ${FRAMES} frames at ${FPS} fps\n`);

  timed('check', () => run(path.join(BIN, 'tsx'), ['scripts/check.ts'], { log }));

  if (draft) {
    const file = path.join(dir('review'), 'draft.mp4');
    timed('picture and sound at half size', () => run(REMOTION, ['render', 'Film', file, '--scale=0.5', '--crf=26', '--color-space=bt709'], { log }));
    console.log(`DRAFT_OK  ${file}  (half size; the sound is not mastered)`);
    return;
  }

  const picture = path.join(out(), 'picture.mp4');
  const mix = path.join(out(), 'mix.wav');
  // Frames go from the browser to the encoder as JPEG. Quality 95 keeps that step from softening the picture.
  timed('picture', () => run(REMOTION, ['render', 'Film', picture, '--muted', '--crf=17', '--color-space=bt709', '--jpeg-quality=95'], { log }));
  timed('sound', () => run(REMOTION, ['render', 'Film', mix, '--codec=wav'], { log }));
  const film = nextFilmPath(FOOTAGE, config.title, fs.existsSync, args.includes('--replace'));
  const remark = timed('master', () => master(picture, mix, film, path.join(dir('audio'), 'final_mix.flac'), log));
  fs.writeFileSync(path.join(out(), 'last-film.txt'), film);
  // The edit as it was for this film, kept beside its name: text only, never media.
  const { EDIT } = await import('../src/edit');
  const rows = rowsOf(EDIT, { W, H });
  const kept = PROJECT ? keepVersion({ root: PROJECT, editDir: EDIT_DIR, film, rows, listing: table(rows, { BAR, BEAT }), info: { title: config.title, seconds: SECONDS, frames: FRAMES, width: W, height: H } }) : null;
  const seconds = (Date.now() - t0) / 1000;
  console.log(`FILM_OK  ${film}  (${seconds.toFixed(0)} s, ${(seconds / SECONDS).toFixed(2)} s per film second${remark ? `; ${remark}` : ''}${kept ? `; version kept in versions/${kept.name}` : ''})`);
}

main().catch((e) => {
  console.error(`FILM FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
