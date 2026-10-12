import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cols, focusAt, focusRange, mediaAt, mediaBox, region, rows } from './crop';
import type { Focus, Rect } from './types';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const PORTRAIT = 1080 / 1920;
const FRAME: Rect = [0, 0, 1920, 1080];
const MOTION = { reveal: 0.3, fade: 0.3 };

test('a 9:16 clip filling a 16:9 frame shows 31.64% of its height', () => {
  const r = region(FRAME, [0.5, 0.5, 1], PORTRAIT);
  near(r.w, 1); near(r.h, 0.31640625); near(r.x, 0); near(r.y, 0.341796875);
});

test('zoom 2 halves the visible region around the focus', () => {
  const r = region(FRAME, [0.5, 0.5, 2], PORTRAIT);
  near(r.w, 0.5); near(r.h, 0.158203125); near(r.x, 0.25); near(r.y, 0.4208984375);
});

test('focus is clamped so the region never leaves the source', () => {
  const top = region(FRAME, [0, 0, 1], PORTRAIT);
  near(top.x, 0); near(top.y, 0);
  const bottom = region(FRAME, [1, 1, 1], PORTRAIT);
  near(bottom.x, 0); near(bottom.y, 1 - 0.31640625);
});

test('a rect narrower than the source crops the sides', () => {
  const r = region([0, 0, 540, 1080], [0.5, 0.5, 1], 16 / 9);
  near(r.h, 1); near(r.w, 0.28125); near(r.x, 0.359375);
});

test('mediaBox scales and offsets the media so the region fills the rect', () => {
  const b = mediaBox([100, 50, 960, 1080], { x: 0.25, y: 0, w: 0.5, h: 1 });
  near(b.width, 1920); near(b.height, 1080); near(b.left, -480); near(b.top, 0);
});

test('cols splits an area into whole-pixel columns with gutters', () => {
  assert.deepEqual(cols([1, 1, 1], 10, FRAME), [[0, 0, 633, 1080], [643, 0, 634, 1080], [1287, 0, 633, 1080]]);
  assert.deepEqual(cols([1, 1], 10, [100, 50, 810, 400]), [[100, 50, 400, 400], [510, 50, 400, 400]]);
});

test('rows splits an area into whole-pixel rows with gutters', () => {
  assert.deepEqual(rows([1, 1], 10, [0, 0, 1080, 1920]), [[0, 0, 1080, 955], [0, 965, 1080, 955]]);
  assert.deepEqual(rows([2, 1], 10, [100, 50, 400, 310]), [[100, 50, 400, 200], [100, 260, 400, 100]]);
});

test('focusAt interpolates focus and zoom, and adds the bump only near the cut', () => {
  const mid = focusAt([0.5, 0.5, 1], [0.6, 0.5, 1.2], 0.5, 1, 0);
  near(mid[0], 0.55); near(mid[1], 0.5); near(mid[2], 1.1);
  near(focusAt([0.5, 0.5, 1], [0.6, 0.5, 1.2], 0, 0, 0.05)[2], 1.05);
  near(focusAt([0.5, 0.5, 1], [0.5, 0.5, 1], 0.5, 0.3, 0.05)[2], 1);
});

test('focusRange fills in the centre, zoom 1 and a slow push', () => {
  assert.deepEqual(focusRange({})[0], [0.5, 0.5, 1]);
  near(focusRange({})[1][2], 1.04);
  assert.deepEqual(focusRange({ focus: [0.3, 0.7] })[0], [0.3, 0.7, 1]);
  assert.deepEqual(focusRange({ focus: [0.3, 0.7, 1.2], zoomTo: 1.2 })[1], [0.3, 0.7, 1.2]);
  assert.deepEqual(focusRange({ focus: [0.3, 0.7, 1.2], zoomTo: [0.6, 0.4] })[1], [0.6, 0.4, 1.2]);
  assert.deepEqual(focusRange({ focus: [0.3, 0.7, 1.2], zoomTo: [0.6, 0.4, 1.5] })[1], [0.6, 0.4, 1.5]);
});

test('mediaAt: an upward reveal starts partly open, then clears', () => {
  const base = { a: 0, d: 2, rect: [0, 0, 420, 1080] as Rect, focus: [0.5, 0.5, 1] as Focus };
  const start = mediaAt({ ...base, reveal: 'up', revealD: 0.45 }, 0, PORTRAIT, MOTION);
  near(parseFloat(start.clipPath.match(/inset\(([0-9.]+)%/)![1]), 68.91, 0.01);
  assert.equal(mediaAt({ ...base, reveal: 'up', revealD: 0.45 }, 0.45, PORTRAIT, MOTION).clipPath, 'none');
  near(mediaAt(base, 1, PORTRAIT, MOTION).opacity, 1);
});

test('mediaAt: a fade reveal uses the theme duration, and never starts fully transparent', () => {
  const base = { a: 0, d: 2, rect: [0, 0, 420, 1080] as Rect };
  near(mediaAt({ ...base, reveal: 'fade' }, 0, PORTRAIT, MOTION).opacity, 0.4358, 0.001);
  near(mediaAt({ ...base, reveal: 'fade' }, 0.3, PORTRAIT, MOTION).opacity, 1);
});

test('mediaAt: exits run over the last part of the layer', () => {
  const base = { a: 0, d: 2, rect: [0, 0, 420, 1080] as Rect };
  near(mediaAt({ ...base, exit: 'fade' }, 1.6, PORTRAIT, MOTION).opacity, 1);
  near(mediaAt({ ...base, exit: 'fade' }, 1.85, PORTRAIT, MOTION).opacity, 0.75);
  assert.equal(mediaAt({ ...base, exit: 'up' }, 2, PORTRAIT, MOTION).clipPath, 'inset(0% 0% 100% 0%)');
  assert.equal(mediaAt({ ...base, exit: 'down' }, 2, PORTRAIT, MOTION).clipPath, 'inset(100% 0% 0% 0%)');
});

test('a picture can arrive from the left or the right, and leave the same ways', () => {
  const m = { a: 0, d: 4, rect: [0, 0, 1920, 1080] as [number, number, number, number] };
  const motion = { reveal: 0.3, fade: 0.3 };
  // Arriving from the left: the right part is still hidden at the start, nothing is hidden once it has arrived.
  assert.match(mediaAt({ ...m, reveal: 'left' }, 0, 16 / 9, motion).clipPath, /^inset\(0% [1-9][\d.]*% 0% 0%\)$/);
  assert.equal(mediaAt({ ...m, reveal: 'left' }, 1, 16 / 9, motion).clipPath, 'none');
  assert.match(mediaAt({ ...m, reveal: 'right' }, 0, 16 / 9, motion).clipPath, /^inset\(0% 0% 0% [1-9][\d.]*%\)$/);
  // Leaving to the left: the right part goes first.
  assert.match(mediaAt({ ...m, exit: 'left' }, 3.9, 16 / 9, motion).clipPath, /^inset\(0% [1-9][\d.]*% 0% 0%\)$/);
  assert.match(mediaAt({ ...m, exit: 'right' }, 3.9, 16 / 9, motion).clipPath, /^inset\(0% 0% 0% [1-9][\d.]*%\)$/);
  // Up and down are unchanged in meaning.
  assert.match(mediaAt({ ...m, reveal: 'up' }, 0, 16 / 9, motion).clipPath, /^inset\([1-9][\d.]*% 0% 0% 0%\)$/);
});
