import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterTag } from './chapterTag';
import { confetti, rnd } from './confetti';
import { flash } from './flash';
import { handNote } from './handNote';
import { polaroid } from './polaroid';
import { routePoints, route } from './route';
import { wipeCover, wipeIn, wipeOut } from './wipe';
import { popScale, wordPop } from './wordPop';

test('rnd is repeatable, stays between 0 and 1, and varies', () => {
  const values = Array.from({ length: 200 }, (_, i) => rnd(i, 3));
  for (const [i, v] of values.entries()) {
    assert.ok(v >= 0 && v < 1, `${v}`);
    assert.equal(rnd(i, 3), v);
  }
  assert.ok(new Set(values.map((v) => v.toFixed(3))).size > 150);
  assert.notEqual(rnd(5, 1), rnd(5, 2));
});

test('each component returns one element with its place on the timeline, and its words when it has any', () => {
  const tag = chapterTag({ a: 2, d: 3, text: 'Friday', sub: 'Arlington' })[0];
  assert.deepEqual([tag.kind, tag.a, tag.d], ['el', 2, 3]);
  assert.deepEqual(tag.kind === 'el' ? [tag.tag, tag.text] : null, ['text', ['Friday', 'Arlington']]);

  const note = handNote({ a: 1, d: 2, text: 'so proud', x: 500, y: 400 })[0];
  assert.deepEqual(note.kind === 'el' ? [note.a, note.d, note.tag, note.text] : null, [1, 2, 'text', ['so proud']]);

  const light = flash({ t: 14 })[0];
  assert.deepEqual(light.kind === 'el' ? [light.a, light.d, light.text] : null, [14, 0.35, undefined]);

  const paper = confetti({ a: 70, d: 4 })[0];
  assert.deepEqual([paper.kind, paper.a, paper.d], ['el', 70, 4]);
});

test('polaroid refuses a photo that is not in the sources, naming it', () => {
  assert.throws(() => polaroid({ a: 0, d: 2, name: 'nope', x: 500, y: 500, w: 400 }), /unknown photo nope/);
});

test('a wipe is closed exactly where two sections meet', () => {
  assert.equal(wipeCover(0), 0);
  assert.equal(wipeCover(1), 0.5);
  assert.ok(wipeCover(0.5) > 0.1 && wipeCover(0.5) < 0.5);
  const [close] = wipeOut({ at: 8 });
  const [open] = wipeIn({ at: 8 });
  assert.ok(Math.abs(close.a + close.d - 8) < 1e-9 && close.d === 0.45);
  assert.deepEqual([open.a, open.d], [8, 0.45]);
  assert.ok(Math.abs(wipeOut({ at: 8, d: 0.6 })[0].a - 7.4) < 1e-9);
});

test('a popped word overshoots a little and settles at its size', () => {
  assert.ok(Math.abs(popScale(0) - 0.6) < 1e-9);
  assert.ok(popScale(0.15) > 1 && popScale(0.15) < 1.15);
  assert.equal(popScale(0.3), 1);
  assert.equal(popScale(2), 1);
  const [l] = wordPop({ a: 4, d: 1.5, text: 'Skål!' });
  assert.deepEqual([l.kind, l.a, l.d], ['el', 4, 1.5]);
  assert.deepEqual(l.kind === 'el' ? [l.tag, l.text] : [], ['text', ['Skål!']]);
});

test('the stops of a route stay inside the safe area, in order, in every frame shape', () => {
  for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
    const safe = { l: 65, r: 65, t: h > w ? 192 : 65, b: h > w ? 307 : 65 };
    for (let n = 2; n <= 6; n++) {
      const pts = routePoints(n, w, h, safe);
      assert.equal(pts.length, n);
      for (const [x, y] of pts) assert.ok(x >= safe.l && x <= w - safe.r && y >= safe.t && y <= h - safe.b, `${w}x${h}, ${n} stops: ${x}, ${y}`);
      // A wide or square frame runs left to right; a tall one top to bottom.
      for (let i = 1; i < n; i++) assert.ok(h > w ? pts[i][1] > pts[i - 1][1] : pts[i][0] > pts[i - 1][0]);
    }
  }
});

test('a route shows its stops as text to be read, and needs at least two', () => {
  const [l] = route({ a: 0, d: 4, stops: ['København', 'Tokyo', 'Kyoto'], title: 'Japan 2026' });
  assert.deepEqual(l.kind === 'el' ? l.text : [], ['Japan 2026', 'København', 'Tokyo', 'Kyoto']);
  assert.throws(() => route({ a: 0, d: 4, stops: ['Tokyo'] }), /route: give 2 to 6 stops/);
  assert.throws(() => route({ a: 0, d: 4, stops: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }), /route: give 2 to 6 stops/);
});

test('confetti takes a shape', () => {
  assert.equal(confetti({ a: 0, d: 2, shape: 'heart', rise: true }).length, 1);
});
