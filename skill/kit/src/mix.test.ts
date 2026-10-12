import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixFor } from './mix';

test('by default everything sounds; music and effects can be switched off', () => {
  assert.deepEqual(mixFor({}), { dialogue: true, natural: true, effects: true, music: true });
  assert.deepEqual(mixFor({ music: false }), { dialogue: true, natural: true, effects: true, music: false });
  assert.deepEqual(mixFor({ music: false, sfx: false }), { dialogue: true, natural: true, effects: false, music: false });
});

test('"only" sounds one group, whatever else is asked', () => {
  assert.deepEqual(mixFor({ only: 'dialogue' }), { dialogue: true, natural: false, effects: false, music: false });
  assert.deepEqual(mixFor({ only: 'music', music: false }), { dialogue: false, natural: false, effects: false, music: true });
});
