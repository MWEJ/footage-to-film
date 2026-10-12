import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignScenes, compareOriginals, displaySize, fpsOf, parseExifDate } from './inventory.mjs';

test('parseExifDate reads a date with its own time zone', () => {
  const d = parseExifDate('2026:09:19 10:21:33-04:00');
  assert.equal(d.local, '2026-09-19T10:21:33');
  assert.equal(d.offset, '-04:00');
  assert.equal(d.epoch, Date.parse('2026-09-19T14:21:33Z') / 1000);
});

test('parseExifDate takes a separate offset, a compact offset and Z', () => {
  assert.equal(parseExifDate('2026:09:19 10:21:33', '-04:00').epoch, Date.parse('2026-09-19T14:21:33Z') / 1000);
  assert.equal(parseExifDate('2026:09:19 10:21:33.250-0400').offset, '-04:00');
  assert.equal(parseExifDate('2026:09:19 14:21:33Z').offset, '+00:00');
});

test('a date without a zone is kept as written and treated as UTC for ordering', () => {
  const d = parseExifDate('2026:09:19 14:00:00');
  assert.equal(d.local, '2026-09-19T14:00:00');
  assert.equal(d.offset, null);
  assert.equal(d.epoch, Date.parse('2026-09-19T14:00:00Z') / 1000);
});

test('empty, zero and missing dates give null', () => {
  assert.equal(parseExifDate('0000:00:00 00:00:00'), null);
  assert.equal(parseExifDate(''), null);
  assert.equal(parseExifDate(undefined), null);
});

test('fpsOf reads a frame rate written as a fraction', () => {
  assert.ok(Math.abs(fpsOf('30000/1001') - 29.97) < 0.001);
  assert.equal(fpsOf('60/1'), 60);
  assert.equal(fpsOf('0/0'), 0);
});

test('displaySize swaps width and height for a clip stored sideways', () => {
  assert.deepEqual(displaySize(1920, 1080, 90), [1080, 1920]);
  assert.deepEqual(displaySize(1920, 1080, -90), [1080, 1920]);
  assert.deepEqual(displaySize(1920, 1080, 270), [1080, 1920]);
  assert.deepEqual(displaySize(1920, 1080, 180), [1920, 1080]);
  assert.deepEqual(displaySize(1920, 1080, 0), [1920, 1080]);
});

test('assignScenes sorts by time, starts a scene after a gap of more than 20 minutes, and a new one each day', () => {
  const at = (id, iso, duration = 0) => ({ id, duration, time: parseExifDate(iso.replace(/-/g, ':').replace('T', ' ')) });
  const items = [at('c', '2026-09-19T10:45:00'), at('a', '2026-09-19T10:00:00', 600), at('b', '2026-09-19T10:25:00'), at('d', '2026-09-20T00:00:30'), { id: 'x', time: null }];
  const out = assignScenes(items);
  assert.deepEqual(out.map((x) => x.id), ['a', 'b', 'c', 'd', 'x']);
  // a ends at 10:10; b starts 15 minutes later: same scene. c starts 20 minutes after b: same scene. d is the next day.
  assert.deepEqual(out.map((x) => x.scene), [1, 1, 1, 2, 3]);
  assert.deepEqual(out.map((x) => x.day), ['2026-09-19', '2026-09-19', '2026-09-19', '2026-09-20', null]);
});

test('assignScenes splits at a gap longer than the limit', () => {
  const at = (id, iso) => ({ id, time: parseExifDate(iso) });
  const out = assignScenes([at('a', '2026:09:19 10:00:00'), at('b', '2026:09:19 10:21:00')]);
  assert.deepEqual(out.map((x) => x.scene), [1, 2]);
});

test('the originals are compared with the inventory by presence and size', () => {
  const inventory = { clips: [{ id: 'a', file: 'a.mov', bytes: 100 }, { id: 'b', file: 'day2/b.mov', bytes: 200 }], photos: [{ id: 'p', file: 'p.heic', bytes: 30 }, { id: 'old', file: 'old.jpg' }] };
  const sizes = { 'a.mov': 100, 'day2/b.mov': 150, 'old.jpg': 5, 'new.mov': 7 };
  const r = compareOriginals(inventory, (f) => sizes[f] ?? null, ['a.mov', 'day2/b.mov', 'old.jpg', 'new.mov']);
  assert.deepEqual(r.missing, ['p.heic']);
  assert.deepEqual(r.changed, [{ file: 'day2/b.mov', was: 200, now: 150 }]);
  assert.deepEqual(r.added, ['new.mov']);
  // An inventory made before sizes were recorded can only be checked for presence.
  assert.deepEqual(compareOriginals({ clips: [], photos: [{ id: 'old', file: 'old.jpg' }] }, () => 5, ['old.jpg']), { missing: [], changed: [], added: [] });
});
