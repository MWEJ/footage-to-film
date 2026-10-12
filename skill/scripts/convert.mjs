#!/usr/bin/env node
// Exports the ranges in notes/selects.json as standard-range H.264 the edit can use, and lists them (and the photos) in edit/src/sources.json.
// usage: node convert.mjs <footage folder>
import fs from 'node:fs';
import path from 'node:path';
import { ensureCube, needProject, pool, project, readJson, run, runAsync, tools } from './lib/common.mjs';
import { ffmpegArgs, parseFileName, plan } from './lib/convert.mjs';
import { fpsOf } from './lib/inventory.mjs';
import { convertPhotos } from './lib/photos.mjs';

const p = project(process.argv[2]);
needProject(p);
const t = tools(p);
const inventory = readJson(path.join(p.notes, 'inventory.json'), `run inventory.mjs "${p.footage}" first`);
const selects = readJson(path.join(p.notes, 'selects.json'), 'write it first: { "handle": 0.5, "clips": [{ "clip": "<id>", "a": <start s>, "b": <end s>, "full": false }] }');
const log = path.join(p.logs, 'convert.log');
fs.writeFileSync(log, `${new Date().toISOString()}  convert for ${p.footage}\n`);

const { jobs, problems } = plan(selects, inventory, p.footage);
if (problems.length > 0) {
  for (const s of problems) console.log(`FAIL  ${s}`);
  console.log(`CONVERT FAIL (${problems.length} problem${problems.length === 1 ? '' : 's'} in notes/selects.json; nothing was converted)`);
  process.exit(1);
}

const cwd = ensureCube(p);
fs.mkdirSync(p.mezz, { recursive: true });
const commands = path.join(p.conversion, 'commands.txt');
const quote = (s) => (/^[\w./:=+,-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`);

const results = await pool(jobs, 4, async (job) => {
  const out = path.join(p.mezz, job.file);
  if (fs.existsSync(out)) return 'kept';
  const tmp = `${out}.tmp.mp4`;
  const args = ffmpegArgs({ ...job, tmp });
  fs.appendFileSync(commands, `cd ${quote(cwd)} && ${quote(t.ffmpeg)} ${args.map(quote).join(' ')} && mv ${quote(tmp)} ${quote(out)}\n`);
  const r = await runAsync(t.ffmpeg, args, { cwd, log });
  if (r.code !== 0 || !fs.existsSync(tmp)) {
    fs.rmSync(tmp, { force: true });
    return `failed: ${job.file}: ${r.stderr.trim().split('\n').pop()}`;
  }
  // Browsers honour colour tags, so a file that is not tagged BT.709 would be shown wrong. Check before accepting it.
  const tags = run(t.ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_space,color_transfer,color_primaries', '-of', 'default=nw=1:nk=1', tmp], { log }).stdout.trim().split('\n').join(',');
  if (tags !== 'bt709,bt709,bt709') {
    fs.rmSync(tmp, { force: true });
    return `failed: ${job.file}: it came out tagged ${tags}, not BT.709`;
  }
  fs.renameSync(tmp, out);
  return 'made';
});
const failed = results.filter((r) => r.startsWith('failed'));
for (const f of failed) console.log(`FAIL  ${f}`);

// Photos are normally converted by strips.mjs already; this catches any that were added since.
let photoProblem = null;
if (inventory.photos.some((x) => !fs.existsSync(path.join(p.photos, `${x.id}.json`)))) {
  try {
    convertPhotos(p, t, log);
  } catch (e) {
    photoProblem = e.message.split('\n')[0];
    console.log(`FAIL  photos: ${photoProblem}`);
  }
}

// What the edit can use: every converted file on disk, and every converted photo.
const clips = {};
for (const name of fs.readdirSync(p.mezz).sort()) {
  const f = parseFileName(name);
  if (!f) continue;
  const info = JSON.parse(run(t.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate', '-of', 'json', path.join(p.mezz, name)], { log }).stdout);
  const v = info.streams.find((s) => s.codec_type === 'video');
  (clips[f.id] ??= []).push({ file: name, tier: f.tier, a: f.a, b: f.b, fps: Math.round(fpsOf(v.r_frame_rate)), w: v.width, h: v.height, audio: info.streams.some((s) => s.codec_type === 'audio') });
}
const photos = {};
for (const x of inventory.photos) {
  const meta = path.join(p.photos, `${x.id}.json`);
  if (fs.existsSync(meta)) photos[x.id] = { file: `${x.id}.jpg`, ...JSON.parse(fs.readFileSync(meta, 'utf8')) };
}
const sourcesFile = path.join(p.edit, 'src', 'sources.json');
fs.writeFileSync(sourcesFile, `${JSON.stringify({ clips, photos }, null, 1)}\n`);

if (failed.length > 0 || photoProblem) {
  console.log(`CONVERT FAIL (${failed.length} of ${jobs.length} files${photoProblem ? ', and the photos' : ''}; log: ${log})`);
  process.exit(1);
}
const made = results.filter((r) => r === 'made').length;
console.log(`CONVERT_OK  ${made} files made, ${jobs.length - made} already there; ${Object.keys(clips).length} clips and ${Object.keys(photos).length} photos listed in ${sourcesFile}`);
