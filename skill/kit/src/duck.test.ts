import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duckDepth, duckGain, duckKey, duckRanges } from './duck';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);
const R: [number, number][] = [[2, 5]];

test('music is at the low gain during speech', () => {
  near(duckGain(3, R), 0.4);
  near(duckGain(2, R), 0.4);
  near(duckGain(5, R), 0.4);
});

test('music eases down before speech and comes back quickly after', () => {
  near(duckGain(1.8, R), 0.7);     // halfway through the 0.4 s attack
  near(duckGain(5.05, R), 0.7);    // halfway through the 0.1 s release
});

test('music is at full gain away from speech and when there is none', () => {
  near(duckGain(0, R), 1);
  near(duckGain(6, R), 1);
  near(duckGain(3, []), 1);
});

test('how far the music is turned down follows from how loud it is under the line', () => {
  assert.equal(duckDepth(-14, -17, 12), 15); // loud music: 15 dB down puts it 12 under the speech
  assert.equal(duckDepth(-26, -17, 12), 4); // already quiet: still a small dip, so the line is felt to come forward
  assert.equal(duckDepth(-6, -17, 12), 18); // never more than 18
  assert.equal(duckDepth(-14, -17, 16), 18);
});

test('lines close together share one duck, at the deeper of their depths', () => {
  const low = (a: number): number => (a === 0 ? 0.3 : a === 5 ? 0.2 : 0.5);
  assert.deepEqual(duckRanges([[0, 4], [5, 6], [10, 12]], low), [[0, 6, 0.2], [10, 12, 0.5]]);
  assert.deepEqual(duckRanges([[0, 4], [5, 6]], low, 0.5), [[0, 4, 0.3], [5, 6, 0.2]]);
  assert.deepEqual(duckRanges([], low), []);
});

test('each range ducks to its own level, and the old form still works', () => {
  const ranges: [number, number, number][] = [[2, 4, 0.2], [10, 12, 0.6]];
  assert.ok(Math.abs(duckGain(3, ranges) - 0.2) < 1e-9);
  assert.ok(Math.abs(duckGain(11, ranges) - 0.6) < 1e-9);
  assert.equal(duckGain(7, ranges), 1);
  assert.ok(Math.abs(duckGain(1.8, ranges) - (0.2 + 0.8 * 0.5)) < 1e-9); // halfway down, 0.2 s before the line
  assert.ok(Math.abs(duckGain(3, [[2, 4]], 0.4) - 0.4) < 1e-9);
});

test('a range is known by where it sits on the timeline', () => {
  assert.equal(duckKey(0, 6), '0.000-6.000');
  assert.equal(duckKey(12.3456, 15), '12.346-15.000');
});
