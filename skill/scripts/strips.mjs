#!/usr/bin/env node
// Things to look at before choosing: a strip of small time-stamped frames for every clip, and contact sheets of the photos.
// It also converts the photos to JPEG, since the sheets need that.
// usage: node strips.mjs <footage folder>
import fs from 'node:fs';
import path from 'node:path';
import { ensureCube, needProject, pool, project, readJson, runAsync, tools } from './lib/common.mjs';
import { convertPhotos } from './lib/photos.mjs';

const p = project(process.argv[2]);
needProject(p);
const t = tools(p);
const inventory = readJson(path.join(p.notes, 'inventory.json'), `run inventory.mjs "${p.footage}" first`);
const log = path.join(p.logs, 'strips.log');
fs.writeFileSync(log, `${new Date().toISOString()}  strips for ${p.footage}\n`);
const out = path.join(p.review, 'strips');
fs.mkdirSync(out, { recursive: true });
const cwd = ensureCube(p);
const even = (n) => 2 * Math.round(n / 2);

const results = await pool(inventory.clips, 4, async (clip) => {
  const file = path.join(out, `${clip.id}.jpg`);
  if (fs.existsSync(file)) return 'kept';
  const cellH = clip.portrait ? 320 : 180;
  const cellW = even((cellH * clip.w) / clip.h);
  const cols = clip.portrait ? 8 : 5;
  const step = clip.duration <= 24 ? 1 : clip.duration <= 60 ? 2 : clip.duration <= 180 ? 5 : 10;
  const rows = Math.ceil((Math.ceil(clip.duration / step) + 1) / cols);
  // HLG clips go through the colour table, so the strip shows roughly what the film will. Other HDR is shown as it is.
  const colour = clip.transfer === 'arib-std-b67'
    ? `scale=${cellW}:${cellH}:in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp10le,lut3d=file=hlg2sdr_f.cube:interp=tetrahedral,format=yuv420p`
    : `scale=${cellW}:${cellH},format=yuv420p`;
  // The time is drawn before frames are picked, so each label is the true time of the frame it sits on.
  const stamp = `drawtext=fontfile=/System/Library/Fonts/Menlo.ttc:text='%{pts\\:hms}':x=4:y=4:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.6`;
  const vf = `${colour},${stamp},fps=1/${step},tile=${cols}x${rows}:padding=4:color=0x1a1a1a`;
  const r = await runAsync(t.ffmpeg, ['-v', 'error', '-y', '-hwaccel', 'videotoolbox', '-i', path.join(p.footage, clip.file), '-an', '-vf', vf, '-frames:v', '1', '-q:v', '4', file], { cwd, log });
  return r.code === 0 && fs.existsSync(file) ? 'made' : `failed: ${clip.id}: ${r.stderr.trim().split('\n').pop()}`;
});

const failed = results.filter((r) => r.startsWith('failed'));
for (const f of failed) console.log(`FAIL  ${f}`);
let photoLine = 'no photos';
if (inventory.photos.length > 0) {
  try {
    photoLine = convertPhotos(p, t, log);
  } catch (e) {
    console.log(`FAIL  photos: ${e.message}`);
    failed.push('photos');
  }
}
if (failed.length > 0) {
  console.log(`STRIPS FAIL (${failed.length}; log: ${log})`);
  process.exit(1);
}
const made = results.filter((r) => r === 'made').length;
console.log(`STRIPS_OK  ${made} strips made, ${results.length - made} already there, in ${out}; photos: ${photoLine.replace(/^PHOTOS_OK\s+/, '')}; sheets in ${p.review}`);
