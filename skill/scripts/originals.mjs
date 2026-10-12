#!/usr/bin/env node
// Are the original clips and photos still where the inventory has them? Reads only; changes and deletes nothing.
// Run it before telling anyone that anything can be deleted, and whenever the user says they added or moved footage.
// usage: node originals.mjs <footage folder>
import fs from 'node:fs';
import path from 'node:path';
import { listMedia, needProject, project, readJson } from './lib/common.mjs';
import { compareOriginals } from './lib/inventory.mjs';

const p = project(process.argv[2]);
needProject(p);
const inventory = readJson(path.join(p.notes, 'inventory.json'), `run inventory.mjs "${p.footage}" first`);
const media = listMedia(p.footage);
const present = [...media.videos, ...media.photos].map((f) => path.relative(p.footage, f));
const sizeOf = (rel) => {
  try {
    return fs.statSync(path.join(p.footage, rel)).size;
  } catch {
    return null;
  }
};
const r = compareOriginals(inventory, sizeOf, present);
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const sized = [...inventory.clips, ...inventory.photos].every((x) => typeof x.bytes === 'number');
if (!sized) console.log('NOTE  this inventory was made before sizes were recorded, so files are checked for presence only; inventory.mjs --force records them');
if (r.missing.length > 0 || r.changed.length > 0) {
  const what = [...r.missing.map((f) => `${f} (missing)`), ...r.changed.map((c) => `${c.file} (was ${mb(c.was)}, is ${mb(c.now)})`)];
  console.error(`ORIGINALS FAIL  ${what.length} of ${inventory.clips.length + inventory.photos.length} originals are missing or changed: ${what.join(', ')}. The converted copies in film-project/sources are then the only copies of what the film uses: do not delete them.`);
  process.exit(1);
}
const extra = r.added.length > 0 ? `; ${r.added.length} file${r.added.length === 1 ? ' is' : 's are'} not in the inventory: ${r.added.join(', ')} (inventory.mjs --force takes them in)` : '';
console.log(`ORIGINALS_OK  ${inventory.clips.length} clips and ${inventory.photos.length} photos are where the inventory has them${extra}`);
