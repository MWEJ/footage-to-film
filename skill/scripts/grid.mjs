#!/usr/bin/env node
// A clip's frames, or a photo, under a ten-by-ten grid, for reading where to centre a crop: focus: [x, y].
// Faces are found by faces.swift; this is for everything else: the cake, the dog, the view.
// usage: node grid.mjs <footage folder> <clip or photo id> [<seconds> ...]
import fs from 'node:fs';
import path from 'node:path';
import { ensureCube, fail, needProject, project, readJson, run, tools } from './lib/common.mjs';
import { gridFilter } from './lib/grid.mjs';

const args = process.argv.slice(2);
const p = project(args[0]);
needProject(p);
const t = tools(p);
const id = args[1];
if (!id) fail('give a clip or photo id as the second argument');
const inventory = readJson(path.join(p.notes, 'inventory.json'), `run inventory.mjs "${p.footage}" first`);
const clip = inventory.clips.find((c) => c.id === id);
const photo = inventory.photos.find((x) => x.id === id);
if (!clip && !photo) fail(`the inventory has no clip or photo ${id}`);
const outDir = path.join(p.review, 'grid');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${id}.jpg`);
const log = path.join(p.logs, 'grid.log');
fs.writeFileSync(log, `${new Date().toISOString()}  grid for ${id}\n`);
const cwd = ensureCube(p);
// -update 1: each output is one picture, and its name is never read as a numbered pattern (a folder may hold a %).
if (photo) {
  const jpeg = path.join(p.photos, `${id}.jpg`);
  if (!fs.existsSync(jpeg)) fail(`${jpeg} is missing; run strips.mjs "${p.footage}" first`);
  run(t.ffmpeg, ['-v', 'error', '-y', '-i', jpeg, '-vf', `scale=1280:1280:force_original_aspect_ratio=decrease,${gridFilter(id)}`, '-frames:v', '1', '-q:v', '3', '-update', '1', file], { cwd, log });
} else {
  let times = args.slice(2).map(Number);
  if (times.some((x) => !Number.isFinite(x) || x < 0 || x > clip.duration)) fail(`times must be seconds between 0 and ${clip.duration.toFixed(1)}`);
  if (times.length === 0) times = [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => Math.round(k * clip.duration * 10) / 10);
  const work = path.join(p.logs, 'tmp', 'grid');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const size = clip.portrait ? 'scale=-2:960' : 'scale=960:-2';
  // HLG clips go through the colour table, as in the strips, so the frame looks roughly as the film will.
  const colour = clip.transfer === 'arib-std-b67' ? `${size}:in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp10le,lut3d=file=hlg2sdr_f.cube:interp=tetrahedral,format=yuv420p` : `${size},format=yuv420p`;
  times.forEach((sec, i) => {
    run(t.ffmpeg, ['-v', 'error', '-y', '-ss', sec.toFixed(3), '-i', path.join(p.footage, clip.file), '-an', '-vf', `${colour},${gridFilter(`${id} ${sec.toFixed(2)} s`)}`, '-frames:v', '1', '-q:v', '3', '-update', '1', path.join(work, `g_${String(i).padStart(2, '0')}.jpg`)], { cwd, log });
  });
  const cols = clip.portrait ? Math.min(times.length, 3) : Math.min(times.length, 2);
  // The frames are read as a numbered sequence by a name relative to their own folder, so the path around it cannot break the pattern.
  run(t.ffmpeg, ['-v', 'error', '-y', '-framerate', '1', '-i', 'g_%02d.jpg', '-vf', `tile=${cols}x${Math.ceil(times.length / cols)}:padding=6:margin=6:color=0x1a1a1a`, '-frames:v', '1', '-q:v', '3', '-update', '1', file], { cwd: work, log });
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(`GRID_OK  ${file}  (lines are tenths of the picture: read a point as focus: [x, y])`);
