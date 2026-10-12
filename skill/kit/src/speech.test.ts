import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechFileIn, speechKey } from './speech';

const talk = { clip: 'IMG_5608', in: 12.4, d: 2.8 };

test('a spoken shot is known by its clip, in-point and length', () => {
  assert.equal(speechKey(talk), 'IMG_5608@12.400+2.800');
  assert.equal(speechKey({ ...talk, speed: 1 }), 'IMG_5608@12.400+2.800');
});

test('a shot finds its cleaned file; a shot that was changed since does not find the old one', () => {
  const map = { 'IMG_5608@12.400+2.800': 'IMG_5608_0012400_002800.wav' };
  assert.equal(speechFileIn(map, talk), 'IMG_5608_0012400_002800.wav');
  assert.equal(speechFileIn(map, { ...talk, in: 12.5 }), null);
  assert.equal(speechFileIn(map, { ...talk, d: 3 }), null);
  assert.equal(speechFileIn(map, { ...talk, speed: 0.5 }), null);
  assert.equal(speechFileIn({}, talk), null);
});

test('a shot with clean: false plays its own sound even while an old cleaned file is listed', () => {
  const map = { 'IMG_5608@12.400+2.800': 'IMG_5608_0012400_002800.wav' };
  assert.equal(speechFileIn(map, { ...talk, clean: false }), null);
  assert.equal(speechFileIn(map, { ...talk, clean: true }), 'IMG_5608_0012400_002800.wav');
});
