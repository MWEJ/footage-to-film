import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { idOf, listMedia, pool, project, run, runAsync } from './common.mjs';

function tempFootage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f2f-common-'));
  const touch = (rel) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), '');
  };
  return { dir, touch };
}

test('project gives the folders of a film project', () => {
  const { dir } = tempFootage();
  const p = project(dir);
  assert.equal(p.root, path.join(p.footage, 'film-project'));
  assert.equal(p.mezz, path.join(p.root, 'sources', 'mezz'));
  assert.equal(p.edit, path.join(p.root, 'edit'));
  fs.rmSync(dir, { recursive: true });
});

test('listMedia finds clips and photos in subfolders, and skips the project, hidden files and other files', () => {
  const { dir, touch } = tempFootage();
  for (const f of ['IMG_2.MOV', 'day one/IMG_1.mp4', 'IMG_3.HEIC', 'b.jpeg', '.DS_Store', 'notes.txt', '._IMG_2.MOV', 'film-project/sources/mezz/x_L_000.0-001.0.mp4', 'film-project/sources/photos/y.jpg']) touch(f);
  const m = listMedia(dir);
  assert.deepEqual(m.videos.map((f) => path.relative(dir, f)), ['IMG_2.MOV', path.join('day one', 'IMG_1.mp4')]);
  assert.deepEqual(m.photos.map((f) => path.relative(dir, f)), ['IMG_3.HEIC', 'b.jpeg']);
  fs.rmSync(dir, { recursive: true });
});

test('a Live Photo is one photo id and one clip id, which do not collide', () => {
  const { dir, touch } = tempFootage();
  touch('IMG_1234.HEIC');
  touch('IMG_1234.MOV');
  const m = listMedia(dir);
  assert.deepEqual(m.videos.map(idOf), ['IMG_1234']);
  assert.deepEqual(m.photos.map(idOf), ['IMG_1234']);
  fs.rmSync(dir, { recursive: true });
});

test('finished films of the project are never footage', () => {
  const { dir: footage, touch } = tempFootage();
  touch('clip.mov');
  touch('Our Summer.mp4'); // the first film: recorded in a version
  touch('Our Summer (render 2).mp4'); // by its name
  touch('Our Summer, short.mp4'); // the last film made
  touch('phone export.mp4'); // the user's own, and footage
  touch('film-project/versions/Our Summer/version.json');
  fs.writeFileSync(path.join(footage, 'film-project', 'versions', 'Our Summer', 'version.json'), JSON.stringify({ film: path.join(footage, 'Our Summer.mp4') }));
  touch('film-project/edit/out/last-film.txt');
  fs.writeFileSync(path.join(footage, 'film-project', 'edit', 'out', 'last-film.txt'), path.join(footage, 'Our Summer, short.mp4'));
  assert.deepEqual(listMedia(footage).videos.map((f) => path.basename(f)), ['clip.mov', 'phone export.mp4']);
  fs.rmSync(footage, { recursive: true });
});

test('a footage folder that was moved still knows its films', () => {
  const { dir: footage, touch } = tempFootage();
  touch('clip.mov');
  touch('Our Summer.mp4');
  touch('Our Summer, short.mp4');
  touch('film-project/versions/Our Summer/version.json');
  // Both records were written while the folder was somewhere else.
  fs.writeFileSync(path.join(footage, 'film-project', 'versions', 'Our Summer', 'version.json'), JSON.stringify({ film: '/Users/someone/Downloads/trip/Our Summer.mp4' }));
  touch('film-project/edit/out/last-film.txt');
  fs.writeFileSync(path.join(footage, 'film-project', 'edit', 'out', 'last-film.txt'), '/Users/someone/Downloads/trip/Our Summer, short.mp4');
  touch('day two/Our Summer.mp4'); // in a subfolder it is the user's own file: films are only ever written to the footage folder itself
  assert.deepEqual(listMedia(footage).videos.map((f) => path.relative(footage, f)), ['clip.mov', path.join('day two', 'Our Summer.mp4')]);
  fs.rmSync(footage, { recursive: true });
});

test('idOf drops the folder and the extension, and keeps underscores and dots', () => {
  assert.equal(idOf('/a/b/IMG_5608.MOV'), 'IMG_5608');
  assert.equal(idOf('trip.final.mp4'), 'trip.final');
});

test('pool keeps the order of results and never runs more than its size at once', async () => {
  let running = 0;
  let most = 0;
  const out = await pool([30, 10, 20, 5, 15], 2, async (ms, i) => {
    running++;
    most = Math.max(most, running);
    await new Promise((r) => setTimeout(r, ms));
    running--;
    return i * 10;
  });
  assert.deepEqual(out, [0, 10, 20, 30, 40]);
  assert.equal(most, 2);
});

test('run returns what a command printed and throws on a non-zero exit, with what it printed', () => {
  assert.equal(run('node', ['-e', 'console.log("hi")']).stdout.trim(), 'hi');
  assert.throws(() => run('node', ['-e', 'console.error("broken"); process.exit(3)']), /node failed with exit 3[\s\S]*broken/);
});

test('runAsync reports the exit code without throwing', async () => {
  const r = await runAsync('node', ['-e', 'console.log("x"); process.exit(2)']);
  assert.equal(r.code, 2);
  assert.equal(r.stdout.trim(), 'x');
});
