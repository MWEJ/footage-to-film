import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Section } from '../../src/edit';
import type { Faces } from '../../src/faces';
import { photo, shot } from '../../src/layers';
import type { Sources } from '../../src/sources';
import type { Layer, Rect } from '../../src/types';
import { faceFindings, shown } from './faces';

const FULL: Rect = [0, 0, 1920, 1080];
const SOURCES: Sources = {
  clips: { land: [{ file: 'land_L_000.0-008.0.mp4', tier: 'L', a: 0, b: 8, fps: 30, w: 1920, h: 1080, audio: true }] },
  photos: { pa: { file: 'pa.jpg', w: 1920, h: 1080 } },
};
const every = (f: number[][]) => Array.from({ length: 17 }, (_, i) => ({ t: i * 0.5, f })) as Faces['clips'][string];
const BIG = [[0.4, 0.3, 0.2, 0.3]];
const faces = (f: number[][]): Faces => ({ clips: { land: every(f) }, photos: { pa: f as Faces['photos'][string] } });
const edit = (layers: Layer[]): Section[] => [{ id: 's', a: 0, b: 12, grid: 'beat', layers }];

test('shown is the share of a face that a region of the picture shows', () => {
  assert.ok(Math.abs(shown([0.4, 0.3, 0.2, 0.3], { x: 0, y: 0, w: 0.5, h: 1 }) - 0.5) < 1e-9);
  assert.equal(shown([0.4, 0.3, 0.2, 0.3], { x: 0, y: 0, w: 1, h: 1 }), 1);
  assert.equal(shown([0.4, 0.3, 0.2, 0.3], { x: 0.7, y: 0, w: 0.3, h: 1 }), 0);
});

test('a crop that shows half of a large face fails, and says how much shows', () => {
  // Zoom 2 on the left quarter: the region runs from 0 to 0.5 across, and the face from 0.4 to 0.6.
  const f = faceFindings(edit([shot({ a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, focus: [0.25, 0.5, 2], zoomTo: 2 })]), SOURCES, faces(BIG));
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'FAIL');
  assert.match(f[0].what, /the crop cuts through a face .*\(50% of it shows\)/);
  assert.match(f[0].where, /shot land at 0\.00 s/);
});

test('a face fully in the picture, or fully out of it, is fine', () => {
  assert.deepEqual(faceFindings(edit([shot({ a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, zoomTo: 1 })]), SOURCES, faces(BIG)), []);
  assert.deepEqual(faceFindings(edit([shot({ a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, focus: [0.9, 0.5, 4], zoomTo: 4 })]), SOURCES, faces(BIG)), []);
});

test('a small face in the background is a note, not a failure', () => {
  const f = faceFindings(edit([shot({ a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, focus: [0.25, 0.5, 2], zoomTo: 2 })]), SOURCES, faces([[0.47, 0.4, 0.06, 0.1]]));
  assert.deepEqual(f.map((x) => x.level), ['NOTE']);
});

test('faceCheck: false switches the check off for a layer, and a clip without faces is silent', () => {
  const cut = { a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, focus: [0.25, 0.5, 2] as [number, number, number], zoomTo: 2 };
  assert.deepEqual(faceFindings(edit([shot({ ...cut, faceCheck: false })]), SOURCES, faces(BIG)), []);
  assert.deepEqual(faceFindings(edit([shot(cut)]), SOURCES, faces([])), []);
  assert.deepEqual(faceFindings(edit([shot(cut)]), SOURCES, { clips: {}, photos: {} }), []);
});

test('a face that the camera cut at the edge of the picture is judged by the part inside the picture', () => {
  // Vision gives such a face a box that runs past the edge (real footage: x 0.765, width 0.293).
  const edge = [[0.77, 0.49, 0.29, 0.17]];
  assert.deepEqual(faceFindings(edit([shot({ a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, zoomTo: 1 })]), SOURCES, faces(edge)), []);
  // A crop that cuts through the part inside the picture still fails: it shows 0.115 x 0.135 of 0.23 x 0.17.
  const f = faceFindings(edit([shot({ a: 0, d: 4, clip: 'land', in: 0.5, rect: FULL, focus: [0.76, 0.5, 4], zoomTo: 4 })]), SOURCES, faces(edge));
  assert.deepEqual(f.map((x) => x.level), ['FAIL']);
  assert.match(f[0].what, /\(40% of it shows\)/);
});

test('photos are checked too', () => {
  const f = faceFindings(edit([photo({ a: 0, d: 2, name: 'pa', rect: FULL, focus: [0.25, 0.5, 2], zoomTo: 2 })]), SOURCES, faces(BIG));
  assert.deepEqual(f.map((x) => x.level), ['FAIL']);
  assert.match(f[0].where, /photo pa at 0\.00 s/);
});
