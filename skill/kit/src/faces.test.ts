import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facesAt, focusOn, type Faces } from './faces';

const FACES: Faces = {
  clips: { talk: [{ t: 1, f: [] }, { t: 1.5, f: [[0.4, 0.3, 0.2, 0.3], [0.8, 0.1, 0.05, 0.08]] }, { t: 2, f: [[0.42, 0.3, 0.2, 0.3]] }] },
  photos: {},
};

test('facesAt gives the nearest sample, and nothing when none is close', () => {
  assert.deepEqual(facesAt(FACES, 'talk', 1.6), [[0.4, 0.3, 0.2, 0.3], [0.8, 0.1, 0.05, 0.08]]);
  assert.deepEqual(facesAt(FACES, 'talk', 1.1), []);
  assert.equal(facesAt(FACES, 'talk', 3), null);
  assert.equal(facesAt(FACES, 'other', 1), null);
});

test('focusOn centres on the largest face, a little above its middle, and on the frame when there is none', () => {
  const f = focusOn(FACES, 'talk', 1.5, 1.2);
  assert.ok(Math.abs(f[0] - 0.5) < 1e-9 && Math.abs(f[1] - 0.435) < 1e-9, `${f}`);
  assert.equal(f[2], 1.2);
  assert.deepEqual(focusOn(FACES, 'talk', 1), [0.5, 0.5, 1]);
  assert.deepEqual(focusOn(FACES, 'other', 0, 1.5), [0.5, 0.5, 1.5]);
});
