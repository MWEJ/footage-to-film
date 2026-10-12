import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Row } from './list';
import { keepVersion, listVersions, rowsOfVersion, versionName } from './versions';

function project(): { root: string; editDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-'));
  const editDir = path.join(root, 'edit');
  fs.mkdirSync(path.join(editDir, 'src', 'sections'), { recursive: true });
  fs.mkdirSync(path.join(editDir, 'node_modules', 'x'), { recursive: true });
  fs.writeFileSync(path.join(editDir, 'film.config.ts'), 'export const config = 1;\n');
  fs.writeFileSync(path.join(editDir, 'src', 'sections', 'open.tsx'), 'export const layers = [];\n');
  fs.writeFileSync(path.join(editDir, 'src', 'sources.json'), '{}\n');
  fs.writeFileSync(path.join(editDir, 'src', 'theme.ts'), '// kit code, not kept\n');
  return { root, editDir };
}
const rows: Row[] = [{ kind: 'shot', a: 0, b: 6, section: 'open', what: 'shot land', detail: 'full frame' }];
const info = { title: 'Smoke Test', seconds: 12, frames: 360, width: 1920, height: 1080 };

test('a version is named after its film', () => {
  assert.equal(versionName('/f/Smoke Test (render 2).mp4'), 'Smoke Test (render 2)');
});

test('a version keeps the text of the edit and its shot list, and no media or packages', () => {
  const p = project();
  const v = keepVersion({ ...p, film: '/f/Smoke Test.mp4', rows, listing: ['| a |'], info, now: new Date('2026-10-05T10:00:00Z') });
  assert.equal(v.dir, path.join(p.root, 'versions', 'Smoke Test'));
  for (const f of ['version.json', 'shotlist.json', 'shotlist.md', 'film.config.ts', 'src/sections/open.tsx', 'src/sources.json']) assert.ok(fs.existsSync(path.join(v.dir, f)), f);
  assert.ok(!fs.existsSync(path.join(v.dir, 'src', 'theme.ts')));
  assert.ok(!fs.existsSync(path.join(v.dir, 'node_modules')));
  assert.deepEqual(rowsOfVersion(v), rows);
  assert.deepEqual([v.made, v.frames, v.film], ['2026-10-05T10:00:00.000Z', 360, '/f/Smoke Test.mp4']);
  fs.rmSync(p.root, { recursive: true });
});

test('a listed version finds its film in the folder above the project, wherever that folder was when the film was made', () => {
  const p = project();
  keepVersion({ ...p, film: '/somewhere/else/Smoke Test.mp4', rows, listing: [], info });
  assert.equal(listVersions(p.root)[0].film, path.join(path.dirname(p.root), 'Smoke Test.mp4'));
  fs.rmSync(p.root, { recursive: true });
});

test('versions are listed oldest first, and a film rendered again in place replaces its version', () => {
  const p = project();
  keepVersion({ ...p, film: '/f/Smoke Test (render 2).mp4', rows, listing: [], info, now: new Date('2026-10-06T10:00:00Z') });
  keepVersion({ ...p, film: '/f/Smoke Test.mp4', rows, listing: [], info, now: new Date('2026-10-05T10:00:00Z') });
  assert.deepEqual(listVersions(p.root).map((v) => v.name), ['Smoke Test', 'Smoke Test (render 2)']);
  keepVersion({ ...p, film: '/f/Smoke Test.mp4', rows: [], listing: [], info, now: new Date('2026-10-07T10:00:00Z') });
  const all = listVersions(p.root);
  assert.deepEqual(all.map((v) => v.name), ['Smoke Test (render 2)', 'Smoke Test']);
  assert.deepEqual(rowsOfVersion(all[1]), []);
  assert.deepEqual(listVersions(path.join(p.root, 'nothing-here')), []);
  fs.rmSync(p.root, { recursive: true });
});
