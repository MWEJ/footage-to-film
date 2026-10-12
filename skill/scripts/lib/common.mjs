// Shared by the skill's scripts: where things are, how commands are run, what counts as footage.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** The skill's own folder (the one that holds SKILL.md), wherever it is installed or linked from. */
export const SKILL = path.resolve(import.meta.dirname, '..', '..');

export function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

/** The folders of a film project. The footage folder holds the user's clips and photos; the project sits inside it. */
export function project(footageArg) {
  if (!footageArg || footageArg.startsWith('--')) fail('give the footage folder as the first argument');
  const footage = path.resolve(footageArg);
  if (!fs.existsSync(footage) || !fs.statSync(footage).isDirectory()) fail(`${footage} is not a folder`);
  const root = path.join(footage, 'film-project');
  const sub = (...parts) => path.join(root, ...parts);
  return { footage, root, edit: sub('edit'), logs: sub('logs'), notes: sub('notes'), review: sub('review'), mezz: sub('sources', 'mezz'), photos: sub('sources', 'photos'), conversion: sub('conversion'), audio: sub('audio') };
}

export function needProject(p) {
  if (!fs.existsSync(path.join(p.root, 'STATUS.md'))) fail(`${p.root} is not a film project yet; run new-film.mjs "${p.footage}" first`);
}

/** What the tool check found on this Mac. */
export function tools(p) {
  const file = path.join(p.logs, 'tools.json');
  if (!fs.existsSync(file)) fail(`${file} is missing; run check-tools.sh "${p.footage}" first`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const tail = (text) => text.trim().split('\n').slice(-12).join('\n');

/** Runs a command with no standard input and waits. Appends its output to `log` when given. Throws on a non-zero exit, with the end of what it printed. */
export function run(cmd, args, o = {}) {
  const r = spawnSync(cmd, args, { cwd: o.cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (o.log) fs.appendFileSync(o.log, `\n$ ${cmd} ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed with exit ${r.status}${o.log ? ` (log: ${o.log})` : ''}\n${tail(`${r.stdout ?? ''}${r.stderr ?? ''}`)}`);
  return { stdout: r.stdout, stderr: r.stderr };
}

/** Like run, without blocking, and without throwing: resolves to the exit code and what was printed. */
export function runAsync(cmd, args, o = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: o.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const done = (code) => {
      if (o.log) fs.appendFileSync(o.log, `\n$ ${cmd} ${args.join(' ')}\n${stdout}${stderr}`);
      resolve({ code, stdout, stderr });
    };
    child.on('error', (e) => {
      stderr += String(e);
      done(-1);
    });
    child.on('close', done);
  });
}

/** Runs fn over the items, `size` at a time. Resolves to the results in the items' order. */
export async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

const VIDEO = new Set(['.mov', '.mp4', '.m4v']);
const PHOTO = new Set(['.heic', '.heif', '.jpg', '.jpeg', '.png']);

/**
 * Every clip and photo under the footage folder, sorted by path. The project folder, hidden files and finished films of
 * this project are skipped: the films its versions name, the last film made, and any "… (render N).mp4".
 * A film is known by its file name in the footage folder itself, so a folder that was moved still knows its films.
 */
export function listMedia(footage) {
  const videos = [];
  const photos = [];
  const films = new Set();
  const here = (recorded) => path.join(footage, path.basename(String(recorded)));
  const lastFilm = path.join(footage, 'film-project', 'edit', 'out', 'last-film.txt');
  if (fs.existsSync(lastFilm)) films.add(here(fs.readFileSync(lastFilm, 'utf8').trim()));
  const versions = path.join(footage, 'film-project', 'versions');
  if (fs.existsSync(versions)) {
    for (const name of fs.readdirSync(versions)) {
      try {
        films.add(here(JSON.parse(fs.readFileSync(path.join(versions, name, 'version.json'), 'utf8')).film));
      } catch {
        // a folder without a readable version.json records no film
      }
    }
  }
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'film-project') walk(full);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO.has(ext) && !films.has(full) && !/ \(render \d+\)\.mp4$/.test(entry.name)) videos.push(full);
      else if (PHOTO.has(ext)) photos.push(full);
    }
  };
  walk(footage);
  // Plain string order of the full paths, so the result does not depend on the file system or the locale.
  return { videos: videos.sort(), photos: photos.sort() };
}

/** A clip's or photo's id: its file name without the extension. */
export const idOf = (file) => path.basename(file, path.extname(file));

/**
 * The colour table, copied into the project's conversion/ folder. ffmpeg is then run in that folder and names the table
 * without a path, which avoids escaping a path inside a filter. Returns the folder.
 */
export function ensureCube(p) {
  fs.mkdirSync(p.conversion, { recursive: true });
  const to = path.join(p.conversion, 'hlg2sdr_f.cube');
  if (!fs.existsSync(to)) fs.copyFileSync(path.join(SKILL, 'assets', 'hlg2sdr_f.cube'), to);
  return p.conversion;
}

/** Reads a JSON file of the project, or fails with what to run first. */
export function readJson(file, hint) {
  if (!fs.existsSync(file)) fail(`${file} is missing; ${hint}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
