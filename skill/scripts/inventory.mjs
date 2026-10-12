#!/usr/bin/env node
// What is in the footage folder: every clip and photo with its length, size, frame rate, colour, time and place, grouped into days and scenes.
// Made again with --force (after the user added or moved footage), it says what is new since the last inventory and what is gone.
// usage: node inventory.mjs <footage folder> [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fail, idOf, listMedia, needProject, pool, project, run, runAsync, tools } from './lib/common.mjs';
import { assignScenes, displaySize, fpsOf, parseExifDate } from './lib/inventory.mjs';

const args = process.argv.slice(2);
const p = project(args[0]);
needProject(p);
const t = tools(p);
const jsonFile = path.join(p.notes, 'inventory.json');
const mdFile = path.join(p.notes, 'inventory.md');
// The inventory as it was, to say what is new and what is gone when it is made again.
const before = fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : null;
if (before && !args.includes('--force')) {
  console.log(`INVENTORY_OK  already made: ${mdFile} (pass --force to make it again)`);
  process.exit(0);
}
const log = path.join(p.logs, 'inventory.log');
fs.writeFileSync(log, `${new Date().toISOString()}  inventory of ${p.footage}\n`);

const media = listMedia(p.footage);
if (media.videos.length + media.photos.length === 0) fail(`no clips or photos found in ${p.footage}`);
for (const [kind, files] of [['clips', media.videos], ['photos', media.photos]]) {
  const seen = new Map();
  for (const f of files) {
    if (seen.has(idOf(f))) fail(`two ${kind} have the same name, ${idOf(f)}: ${seen.get(idOf(f))} and ${f}. Rename one of them.`);
    seen.set(idOf(f), f);
  }
}

// One exiftool call for dates, places and photo sizes. -n gives plain numbers.
const all = [...media.videos, ...media.photos];
const exif = new Map();
for (let i = 0; i < all.length; i += 200) {
  const out = run(t.exiftool, ['-json', '-n', '-Duration', '-Rotation', '-Orientation', '-ImageWidth', '-ImageHeight', '-CreationDate', '-CreateDate', '-DateTimeOriginal', '-OffsetTimeOriginal', '-GPSLatitude', '-GPSLongitude', ...all.slice(i, i + 200)], { log }).stdout;
  for (const e of JSON.parse(out)) exif.set(path.resolve(e.SourceFile), e);
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const timeOf = (e) => parseExifDate(e.DateTimeOriginal, e.OffsetTimeOriginal ?? null) ?? parseExifDate(e.CreationDate) ?? parseExifDate(e.CreateDate);

// ffprobe for what exiftool is vague about: frame rate, colour transfer, whether there is sound.
const problems = [];
const clips = (
  await pool(media.videos, 8, async (file) => {
    const r = await runAsync(t.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,avg_frame_rate,color_transfer:stream_side_data=rotation:format=duration', '-of', 'json', file], { log });
    if (r.code !== 0) {
      problems.push(`${path.relative(p.footage, file)} could not be read as a video`);
      return null;
    }
    const info = JSON.parse(r.stdout);
    const v = info.streams.find((s) => s.codec_type === 'video');
    if (!v) {
      problems.push(`${path.relative(p.footage, file)} has no picture`);
      return null;
    }
    const e = exif.get(path.resolve(file)) ?? {};
    const rotation = Number(v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? e.Rotation ?? 0);
    const [w, h] = displaySize(v.width, v.height, rotation);
    const transfer = v.color_transfer ?? 'unknown';
    return {
      id: idOf(file), file: path.relative(p.footage, file), bytes: fs.statSync(file).size, duration: Number(info.format.duration), fps: Math.round(fpsOf(v.avg_frame_rate) * 1000) / 1000,
      w, h, portrait: h > w, codec: v.codec_name, transfer, hdr: transfer === 'arib-std-b67' || transfer === 'smpte2084',
      audio: info.streams.some((s) => s.codec_type === 'audio'), time: timeOf(e), lat: num(e.GPSLatitude), lon: num(e.GPSLongitude),
    };
  })
).filter(Boolean);

const photos = media.photos.map((file) => {
  const e = exif.get(path.resolve(file)) ?? {};
  const [w, h] = displaySize(e.ImageWidth ?? 0, e.ImageHeight ?? 0, (e.Orientation ?? 1) >= 5 ? 90 : 0);
  return { id: idOf(file), file: path.relative(p.footage, file), bytes: fs.statSync(file).size, w, h, time: timeOf(e), lat: num(e.GPSLatitude), lon: num(e.GPSLongitude) };
});

// Days and scenes are numbered across clips and photos together.
const ordered = assignScenes([...clips.map((c) => ({ ...c, kind: 'clip' })), ...photos.map((x) => ({ ...x, kind: 'photo' }))]);
const strip = ({ kind, ...rest }) => rest;
const inventory = { made: new Date().toISOString(), footage: p.footage, clips: ordered.filter((x) => x.kind === 'clip').map(strip), photos: ordered.filter((x) => x.kind === 'photo').map(strip) };
fs.writeFileSync(jsonFile, `${JSON.stringify(inventory, null, 1)}\n`);

// The same, to read.
const clock = (x) => (x.time ? x.time.local.slice(11, 16) : '--:--');
const place = (x) => (x.lat !== null && x.lon !== null ? `${x.lat.toFixed(4)}, ${x.lon.toFixed(4)}` : '');
const total = clips.reduce((s, c) => s + c.duration, 0);
const md = [`# Inventory`, '', `${clips.length} clips (${Math.floor(total / 60)} min ${Math.round(total % 60)} s in all) and ${photos.length} photos in \`${p.footage}\`.`, '', 'Sizes are as displayed, after rotation. A new scene starts after a gap of more than 20 minutes.'];
let scene = null;
for (const x of ordered) {
  if (x.scene !== scene) {
    scene = x.scene;
    md.push('', `## Scene ${scene}: ${x.day ?? 'no date'}${x.time ? `, from ${clock(x)}` : ''}`, '', '| Time | Id | Kind | Length | Frames/s | Size | Colour | Sound | Place |', '|---|---|---|---|---|---|---|---|---|');
  }
  if (x.kind === 'clip') md.push(`| ${clock(x)} | ${x.id} | clip, ${x.portrait ? 'portrait' : 'landscape'} | ${x.duration.toFixed(1)} s | ${x.fps} | ${x.w}x${x.h} | ${x.hdr ? `HDR (${x.transfer})` : 'standard'} | ${x.audio ? 'yes' : 'no'} | ${place(x)} |`);
  else md.push(`| ${clock(x)} | ${x.id} | photo | | | ${x.w}x${x.h} | | | ${place(x)} |`);
}
if (problems.length > 0) md.push('', '## Not readable', '', ...problems.map((s) => `- ${s}`));

// What changed since the inventory before this one. A clip and a photo may share an id (a Live Photo), so each is known by its kind too.
const keys = (inv) => new Map([...inv.clips.map((x) => [`clip ${x.id}`, x.id]), ...inv.photos.map((x) => [`photo ${x.id}`, x.id])]);
const was = before ? keys(before) : new Map();
const is = keys({ clips, photos });
const added = before ? [...is].filter(([k]) => !was.has(k)).map(([, id]) => id) : [];
const gone = before ? [...was].filter(([k]) => !is.has(k)).map(([, id]) => id) : [];
if (added.length > 0 || gone.length > 0) {
  md.push('', `## New since the inventory of ${String(before.made).slice(0, 10)}`, '', 'Scenes are numbered anew; ids do not change.', '');
  md.push(added.length > 0 ? `New: ${added.join(', ')}.` : 'Nothing is new.');
  if (gone.length > 0) md.push('', `No longer in the folder: ${gone.join(', ')}.`);
}
fs.writeFileSync(mdFile, `${md.join('\n')}\n`);

for (const s of problems) console.log(`NOTE  ${s}`);
if (added.length > 0) console.log(`NOTE  new since the last inventory: ${added.join(', ')}`);
if (gone.length > 0) console.log(`NOTE  no longer there: ${gone.join(', ')}`);
const days = new Set(ordered.map((x) => x.day).filter(Boolean)).size;
const scenes = new Set(ordered.map((x) => x.scene)).size;
console.log(`INVENTORY_OK  ${clips.length} clips (${Math.floor(total / 60)} min ${Math.round(total % 60)} s), ${photos.length} photos, ${days} day${days === 1 ? '' : 's'}, ${scenes} scene${scenes === 1 ? '' : 's'}: ${mdFile}`);
