import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glitches } from './glitch';

const flat = (n: number, v = 100): number[] => Array.from({ length: n }, () => v);

test('a frame that differs from both its neighbours is a flicker', () => {
  const y = flat(100);
  y[50] = 120;
  assert.deepEqual(glitches(y, new Set()), { flickers: [50], jumps: [] });
  y[50] = 103; // too small to matter
  assert.deepEqual(glitches(y, new Set()), { flickers: [], jumps: [] });
});

test('a jump in brightness that stays is a jump, not a flicker', () => {
  const y = [...flat(50), ...flat(50, 130)];
  assert.deepEqual(glitches(y, new Set()), { flickers: [], jumps: [50] });
});

test('nothing on a cut, or on the frame beside one, is a glitch', () => {
  const y = [...flat(50), ...flat(50, 130)];
  assert.deepEqual(glitches(y, new Set([50])), { flickers: [], jumps: [] });
  assert.deepEqual(glitches(y, new Set([51])), { flickers: [], jumps: [] });
  const flash = flat(100);
  flash[30] = 200; // a flash that starts on a cut and is gone a frame later
  assert.deepEqual(glitches(flash, new Set([30])), { flickers: [], jumps: [] });
});

test('a flash dying away over several frames is a fade, not a jump; a sudden step inside a fade is still a jump', () => {
  // Measured on the smoke film: the last frames of a shot, then a flash on the cut (index 4) that fades over ten frames.
  const flashFade = [119.4, 120.8, 122.5, 124.3, 179.8, 156.5, 135.9, 117.5, 101.5, 88.5, 77.3, 68.6, 62.0, 58.2, 56.2, 56.6, 56.8, 56.9, 56.9];
  assert.deepEqual(glitches(flashFade, new Set([4])), { flickers: [], jumps: [] });
  const slow = [100, 95, 90, 85, 55, 50, 45, 40];
  assert.deepEqual(glitches(slow, new Set()), { flickers: [], jumps: [4] });
});

test('a slow change is neither', () => {
  const y = Array.from({ length: 100 }, (_, i) => 60 + i);
  assert.deepEqual(glitches(y, new Set()), { flickers: [], jumps: [] });
});
