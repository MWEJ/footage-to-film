import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Section } from '../../src/edit';
import { el, photo, shot } from '../../src/layers';
import { barBeat, clock, diffRows, mergeRanges, place, rowsOf, signature, table } from './list';

const G = { W: 1920, H: 1080, BAR: 2, BEAT: 0.5 };
const talk = shot({ a: 0, d: 6, clip: 'land', in: 0.5, rect: [0, 0, 1920, 1080], audio: 'speech' });
const edit = (extra: Section['layers'] = []): Section[] => [
  { id: 'open', a: 0, b: 6, grid: 'free', layers: [talk, el({ a: 0, d: 6, tag: 'caption', text: ['The quick brown fox', 'jumps over'], node: null })] },
  { id: 'main', a: 6, b: 12, grid: 'beat', layers: [el({ a: 6, d: 2, tag: 'text', text: ['Smoke Test', 'A test film'], node: null }), photo({ a: 10, d: 1, name: 'photo_b', rect: [960, 0, 960, 1080], focus: [0.5, 0.4] }), ...extra] },
];

test('times read as a player shows them, and as bars and beats', () => {
  assert.equal(clock(0), '0:00.0');
  assert.equal(clock(62.5), '1:02.5');
  assert.equal(clock(59.96), '1:00.0');
  assert.deepEqual(barBeat(0, G), { bar: 1, beat: 1 });
  assert.deepEqual(barBeat(10.75, G), { bar: 6, beat: 2.5 });
});

test('where a picture sits is said in words when it can be', () => {
  assert.equal(place([0, 0, 1920, 1080], 1920, 1080), 'full frame');
  assert.equal(place([960, 0, 960, 1080], 1920, 1080), 'x 50-100%, y 0-100%');
});

test('every layer becomes a row, in the order things happen', () => {
  const rows = rowsOf(edit(), G);
  assert.deepEqual(rows.map((r) => [r.kind, r.a, r.b, r.section]), [['shot', 0, 6, 'open'], ['caption', 0, 6, 'open'], ['text', 6, 8, 'main'], ['photo', 10, 11, 'main']]);
  assert.equal(rows[0].what, 'shot land');
  assert.match(rows[0].detail, /^source 0\.50-6\.50 s, full frame, sound: speech$/);
  assert.equal(rows[1].what, 'The quick brown fox / jumps over');
  assert.equal(rows[2].what, 'Smoke Test / A test film');
  assert.match(rows[3].detail, /^x 50-100%, y 0-100%, focus 0\.50 0\.40$/);
});

test('a shot says its speed, its zoom and its move when it has them', () => {
  const s = shot({ a: 0, d: 2, clip: 'port', in: 3, speed: 0.5, rect: [0, 0, 1920, 1080], focus: [0.5, 0.3, 1.4], zoomTo: 1.2, full: true });
  const [row] = rowsOf([{ id: 's', a: 0, b: 2, grid: 'beat', layers: [s] }], G);
  assert.equal(row.detail, 'source 3.00-4.00 s at speed 0.5, full frame, focus 0.50 0.30 zoom 1.40 to 1.20, full-resolution file');
});

test('how a picture arrives, leaves and is shaped is in its row, so changing it is a change', () => {
  const plain = { a: 0, d: 2, clip: 'port', in: 3, rect: [0, 0, 1920, 1080] as [number, number, number, number] };
  const rows = (s: ReturnType<typeof shot>) => rowsOf([{ id: 's', a: 0, b: 2, grid: 'beat', layers: [s] }], G);
  const [row] = rows(shot({ ...plain, reveal: 'left', revealD: 0.4, exit: 'fade', bump: 0.05, radius: 24 }));
  assert.equal(row.detail, 'source 3.00-5.00 s, full frame, in: left 0.4 s, out: fade, bump 0.05, radius 24');
  // "none" is the same as saying nothing.
  assert.equal(rows(shot({ ...plain, reveal: 'none', exit: 'none' }))[0].detail, 'source 3.00-5.00 s, full frame');
  assert.equal(diffRows(rows(shot(plain)), rows(shot({ ...plain, reveal: 'up' }))).ranges.length, 1);
  const [p] = rowsOf([{ id: 's', a: 0, b: 2, grid: 'beat', layers: [photo({ a: 0, d: 2, name: 'photo_a', rect: [0, 0, 1920, 1080], exit: 'down', exitD: 0.3 })] }], G);
  assert.equal(p.detail, 'full frame, out: down 0.3 s');
});

test('what differs between two lists is where the film should differ', () => {
  const before = rowsOf(edit(), G);
  const swapped = rowsOf(edit().map((s) => ({ ...s, layers: s.layers.map((l) => (l.kind === 'photo' ? { ...l, name: 'photo_a' } : l)) })), G);
  const d = diffRows(before, swapped);
  assert.deepEqual(d.ranges, [[10, 11]]);
  assert.deepEqual([d.removed.map((r) => r.what), d.added.map((r) => r.what)], [['photo photo_b'], ['photo photo_a']]);
  assert.deepEqual(diffRows(before, before), { added: [], removed: [], ranges: [] });
  // The same row twice is two rows: removing one of them is a change.
  const twice = rowsOf(edit([photo({ a: 10, d: 1, name: 'photo_b', rect: [960, 0, 960, 1080], focus: [0.5, 0.4] })]), G);
  assert.equal(diffRows(twice, before).removed.length, 1);
  assert.notEqual(signature(before[0]), signature(before[1]));
});

test('ranges that touch or nearly touch are one range', () => {
  assert.deepEqual(mergeRanges([[10, 11], [0, 2], [11.02, 12], [1, 3]]), [[0, 3], [10, 12]]);
  assert.deepEqual(mergeRanges([[0, 1], [1.5, 2]], 0.05), [[0, 1], [1.5, 2]]);
  assert.deepEqual(mergeRanges([]), []);
});

test('the table has a line for every row', () => {
  const lines = table(rowsOf(edit(), G), G);
  assert.equal(lines.length, 2 + 4);
  assert.match(lines[2], /^\| 0:00\.0 \| 1 \| 1 \| 6\.00 s \| open \| shot land \| source 0\.50-6\.50 s, full frame, sound: speech \|$/);
});
