import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedFrames, explain, frameRanges, lengthDifference, parseStats, soundRanges } from './compare';

test("ffmpeg's per-frame lines become one entry per frame", () => {
  const text = ['frame:0    pts:0       pts_time:0', 'lavfi.signalstats.YMIN=0', 'lavfi.signalstats.YAVG=0.0125', 'lavfi.signalstats.YMAX=3', 'frame:1    pts:1       pts_time:0.0333', 'lavfi.signalstats.YAVG=14.5', 'lavfi.signalstats.YMAX=200'].join('\n');
  assert.deepEqual(parseStats(text), [{ avg: 0.0125, max: 3 }, { avg: 14.5, max: 200 }]);
  assert.deepEqual(parseStats(''), []);
});

test('a frame has changed when a spot of it or the whole of it differs more than encoding noise', () => {
  const quiet = { avg: 0.05, max: 4 };
  assert.deepEqual(changedFrames([quiet, { avg: 0.1, max: 40 }, quiet, { avg: 0.9, max: 6 }, quiet]), [1, 3]);
  assert.deepEqual(changedFrames([quiet, quiet]), []);
});

test('changed frames become ranges in seconds; a gap of a few frames does not split one', () => {
  assert.deepEqual(frameRanges([30, 31, 32, 35, 90, 91], 30), [[1, 1.2], [3, 92 / 30]]);
  assert.deepEqual(frameRanges([], 30), []);
});

test('the sound differs where one mix cannot be subtracted from the other', () => {
  const rate = 8000;
  const tone = (f: number) => Float32Array.from({ length: rate * 4 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / rate));
  const a = tone(220);
  const b = tone(220);
  for (let i = rate * 2; i < rate * 3; i++) b[i] = 0.3 * Math.sin((2 * Math.PI * 330 * i) / rate); // one second of another note
  assert.deepEqual(soundRanges(a, b, rate), [[2, 3]]);
  assert.deepEqual(soundRanges(a, a, rate), []);
  // The same mix a little louder everywhere (a master that moved by half a decibel) is not a change.
  assert.deepEqual(soundRanges(a, a.map((v) => v * 1.06), rate), []);
  assert.deepEqual(soundRanges(new Float32Array(rate), new Float32Array(rate), rate), []);
});

test('what only the longer of two films has is a difference of its own, whichever film is longer', () => {
  assert.deepEqual(lengthDifference(360, 420, 30), [12, 14]);
  assert.deepEqual(lengthDifference(420, 360, 30), [12, 14]);
  assert.equal(lengthDifference(360, 360, 30), null);
});

test('a difference is explained when the edit changed there', () => {
  const r = explain([[10, 11], [40.2, 41], [70, 71]], [[10, 11.5], [39, 40]]);
  assert.deepEqual(r.explained, [[10, 11], [40.2, 41]]); // within half a second of a change counts: reveals and exits reach a little past it
  assert.deepEqual(r.unexplained, [[70, 71]]);
  assert.deepEqual(explain([], [[1, 2]]), { explained: [], unexplained: [] });
});

test('a long difference that only touches a change is explained only where the change is', () => {
  // A new theme redraws the whole film; the lists show one panel moved, from 8 to 10 s.
  assert.deepEqual(explain([[4, 12]], [[8, 10]]), { explained: [[7.5, 10.5]], unexplained: [[4, 7.5], [10.5, 12]] });
  // Two changes inside one stretch of difference: what lies between them, beyond the slack, is not explained either.
  assert.deepEqual(explain([[1, 9]], [[1, 2], [7, 9]]), { explained: [[1, 2.5], [6.5, 9]], unexplained: [[2.5, 6.5]] });
});
