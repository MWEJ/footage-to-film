// The film in every look, to choose from by eye.   npm run looks [-- <seconds> ...]
// One sheet per time: the film's own theme first when it has one, then every preset, each cell labelled.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../film.config';
import { FRAMES, H, W, toFrame } from '../src/grid';
import { PRESETS } from '../src/theme';
import { EDIT_DIR, dir, out } from './lib/paths';
import { makeBundle, renderStillsFrom } from './lib/stills';
import { run, tool } from './lib/tools';

const FONT = '/System/Library/Fonts/Menlo.ttc';

async function main(): Promise<void> {
  const given = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
  const times = given.length > 0 ? given : [3];
  if (times.some((t) => !Number.isFinite(t) || t < 0)) {
    console.error('usage: npm run looks [-- <seconds> ...]');
    process.exit(2);
  }
  const frames = times.map((t) => Math.min(FRAMES - 1, toFrame(t)));
  // The film's own look comes first, unless it is a preset as it stands.
  const own = typeof config.theme === 'string' ? [] : [{ label: `this film (${config.theme.name ?? `${config.theme.base ?? 'house'}, changed`})`, env: {} as Record<string, string> }];
  const looks = [...own, ...Object.keys(PRESETS).map((name) => ({ label: name, env: { REMOTION_THEME: name } }))];

  const serveUrl = await makeBundle();
  const cellW = Math.round((640 * W) / Math.max(W, H) / 2) * 2;
  const scale = cellW / W;
  const work = out('looks');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const ff = tool('ffmpeg');
  const cols = cellW >= 500 ? 3 : 4;
  const files: string[] = [];
  for (const [i, look] of looks.entries()) {
    const got = await renderStillsFrom(serveUrl, frames, { scale, quality: 90, env: look.env });
    for (const f of frames) {
      const jpeg = got.get(f);
      if (!jpeg) throw new Error(`frame ${f} was not rendered in ${look.label}`);
      const raw = path.join(work, `raw_${f}_${i}.jpg`);
      const cell = path.join(work, `f${f}_${String(i).padStart(2, '0')}.jpg`);
      fs.writeFileSync(raw, jpeg);
      // The label is written to a file, so a name needs no escaping inside the filter (and expansion=none prints a % as it is).
      // The file is named relative to the edit folder (where run() works), because a footage folder's own name may hold commas or apostrophes.
      const label = path.join(work, `label_${i}.txt`);
      fs.writeFileSync(label, look.label);
      run(ff, ['-v', 'error', '-y', '-i', raw, '-vf', `drawtext=fontfile=${FONT}:textfile=${path.relative(EDIT_DIR, label)}:expansion=none:x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6`, '-q:v', '3', cell]);
    }
  }
  const folder = dir('review', 'looks');
  for (const [k, f] of frames.entries()) {
    const file = path.join(folder, `looks_${times[k].toFixed(2).padStart(7, '0')}.jpg`);
    const rows = Math.ceil(looks.length / cols);
    run(ff, ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(work, `f${f}_%02d.jpg`), '-vf', `tile=${cols}x${rows}:padding=8:margin=8:color=0x1a1a1a`, '-frames:v', '1', '-q:v', '3', file]);
    files.push(file);
  }
  console.log(`LOOKS_OK  ${files.join('  ')}  (${looks.length} looks: ${looks.map((l) => l.label).join(', ')}; read left to right, top to bottom)`);
}

main().catch((e) => {
  console.error(`LOOKS FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
