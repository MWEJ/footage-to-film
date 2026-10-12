import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sfx, shot, speechRanges } from './layers';
import type { Layer, Rect } from './types';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);

test('speechRanges merges touching speech shots and ignores silent ones', () => {
  const rect: Rect = [0, 0, 100, 100];
  const layers: Layer[] = [
    shot({ a: 0.1, d: 1.9, clip: 'x', in: 0, rect, audio: 'speech' }),
    shot({ a: 2, d: 3.2, clip: 'x', in: 0, rect, audio: 'speech' }),
    shot({ a: 2, d: 3.2, clip: 'x', in: 0, rect }),
    shot({ a: 8, d: 1, clip: 'x', in: 0, rect, audio: 'speech' }),
    shot({ a: 9.5, d: 1, clip: 'x', in: 0, rect, audio: 'nat' }),
  ];
  const r = speechRanges(layers);
  assert.equal(r.length, 2);
  near(r[0][0], 0.1); near(r[0][1], 5.2); near(r[1][0], 8); near(r[1][1], 9);
});

test('speechRanges of an edit without speech is empty', () => {
  assert.deepEqual(speechRanges([]), []);
});

test('sfx is a layer at a moment, at -12 dB unless told otherwise', () => {
  assert.deepEqual(sfx({ t: 14, name: 'shimmer' }), { kind: 'sfx', a: 14, d: 0.1, name: 'shimmer', gain: undefined });
  assert.equal(sfx({ t: 20, name: 'shutter', gain: -16 }).gain, -16);
});
