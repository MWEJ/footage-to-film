// A contact sheet: one small time-stamped frame per beat.   npm run sheet -- [start] [end] [--every=2] [--theme=<preset>]
import fs from 'node:fs';
import path from 'node:path';
import { BEAT, FRAMES, SECONDS, W, toFrame } from '../src/grid';
import { dir, out } from './lib/paths';
import { renderStills, themeEnv } from './lib/stills';
import { run, tool } from './lib/tools';

// Frames are rendered at a quarter size in every frame shape (480x270, 270x480 or 270x270, all whole pixels); narrow cells go six to a row.
const SCALE = 0.25;
const COLS = W * SCALE >= 400 ? 4 : 6;
const PER_PAGE = COLS * 6;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const nums = args.filter((a) => !a.startsWith('--')).map(Number);
  const every = Number((args.find((a) => a.startsWith('--every=')) ?? '--every=1').split('=')[1]);
  const start = nums[0] ?? 0;
  const end = Math.min(nums[1] ?? SECONDS, SECONDS);
  if (![start, end, every].every(Number.isFinite) || start < 0 || end <= start || every < 1) {
    console.error('usage: npm run sheet -- [start seconds] [end seconds] [--every=<beats>] [--theme=<preset>]');
    process.exit(2);
  }
  // Sample 60% into each beat: reveals that start on the beat have finished, and the stamp shows the real time.
  const frames: number[] = [];
  for (let k = Math.ceil(start / BEAT - 1e-9); k * BEAT < end - 1e-9; k += every) {
    const f = toFrame((k + 0.6) * BEAT);
    if (f < FRAMES) frames.push(f);
  }
  if (frames.length === 0) throw new Error(`no beats between ${start} and ${end} s`);
  const got = await renderStills(frames, { stamp: true, scale: SCALE, quality: 85, env: themeEnv(args) });

  const work = out('sheet');
  fs.rmSync(work, { recursive: true, force: true });
  const folder = dir('review', 'sheets');
  const name = `sheet_${start.toFixed(1).padStart(6, '0')}-${end.toFixed(1).padStart(6, '0')}`;
  const pages = Math.ceil(frames.length / PER_PAGE);
  const files: string[] = [];
  for (let p = 0; p < pages; p++) {
    const cells = frames.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const cellDir = path.join(work, `p${p + 1}`);
    fs.mkdirSync(cellDir, { recursive: true });
    cells.forEach((f, i) => {
      const jpeg = got.get(f);
      if (!jpeg) throw new Error(`frame ${f} was not rendered`);
      fs.writeFileSync(path.join(cellDir, `c_${String(i).padStart(3, '0')}.jpg`), jpeg);
    });
    const file = path.join(folder, pages > 1 ? `${name}_p${p + 1}.jpg` : `${name}.jpg`);
    const rows = Math.ceil(cells.length / COLS);
    run(tool('ffmpeg'), ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(cellDir, 'c_%03d.jpg'), '-vf', `tile=${COLS}x${rows}:padding=6:margin=6:color=0x1a1a1a`, '-frames:v', '1', '-q:v', '3', file]);
    files.push(file);
  }
  console.log(`SHEET_OK  ${files.join('  ')}  (${frames.length} frames, one every ${every === 1 ? 'beat' : `${every} beats`}, read left to right, top to bottom)`);
}

main().catch((e) => {
  console.error(`SHEET FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
