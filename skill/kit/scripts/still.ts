// One or more full-size frames of the film.   npm run still -- 15.5 [22 ...] [--stamp] [--theme=<preset>]
import fs from 'node:fs';
import path from 'node:path';
import { FRAMES, toFrame } from '../src/grid';
import { dir } from './lib/paths';
import { renderStills, themeEnv } from './lib/stills';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const times = args.filter((a) => !a.startsWith('--')).map(Number);
  if (times.length === 0 || times.some((t) => !Number.isFinite(t) || t < 0)) {
    console.error('usage: npm run still -- <seconds> [<seconds> ...] [--stamp] [--theme=<preset>]');
    process.exit(2);
  }
  const frames = times.map((t) => Math.min(FRAMES - 1, toFrame(t)));
  const got = await renderStills(frames, { stamp: args.includes('--stamp'), env: themeEnv(args) });
  const folder = dir('review', 'stills');
  const files = times.map((t, i) => {
    const file = path.join(folder, `still_${t.toFixed(2).padStart(7, '0')}.jpg`);
    const jpeg = got.get(frames[i]);
    if (!jpeg) throw new Error(`frame ${frames[i]} was not rendered`);
    fs.writeFileSync(file, jpeg);
    return file;
  });
  console.log(`STILL_OK  ${files.join('  ')}`);
}

main().catch((e) => {
  console.error(`STILL FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
