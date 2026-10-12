import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignSaid } from './align';

const heard = [
  { s: 'Okay,', a: 0.5, b: 0.9 },
  { s: 'my', a: 1.0, b: 1.2 },
  { s: 'name', a: 1.2, b: 1.5 },
  { s: 'is', a: 1.5, b: 1.7 },
  { s: 'Maya', a: 1.7, b: 2.3 },
  { s: 'Hanson.', a: 2.3, b: 3.0 },
];

test('typed words take the times of the words that were heard', () => {
  assert.deepEqual(alignSaid('Okay, my name is Maya', heard.slice(0, 5)), heard.slice(0, 5));
  // Capitals and punctuation do not matter for matching; the typed spelling is what is shown.
  assert.deepEqual(alignSaid('okay my NAME', heard).map((w) => [w.s, w.a]), [['okay', 0.5], ['my', 1.0], ['NAME', 1.2]]);
});

test('a name whisper got wrong keeps its place', () => {
  const out = alignSaid('Okay, my name is Maya Hansen.', heard);
  assert.deepEqual(out[5], { s: 'Hansen.', a: 2.3, b: 3.0 }); // nothing after it to match: it takes the rest of what was heard
  assert.deepEqual(out[4], heard[4]);
});

test('a word whisper dropped is placed between its neighbours', () => {
  const out = alignSaid('Okay, my full name is Maya', heard);
  assert.deepEqual(out.map((w) => w.s), ['Okay,', 'my', 'full', 'name', 'is', 'Maya']);
  assert.deepEqual([out[2].a, out[2].b], [1.2, 1.2]); // squeezed between "my" and "name", which touch
  assert.ok(out.every((w, i) => i === 0 || w.a >= out[i - 1].a));
});

test('words that match nothing at all are spread over what was heard', () => {
  const out = alignSaid('Vi ses snart', heard);
  assert.deepEqual(out.map((w) => w.s), ['Vi', 'ses', 'snart']);
  assert.ok(Math.abs(out[0].a - 0.5) < 1e-9 && Math.abs(out[2].b - 3.0) < 1e-9);
  assert.ok(out[1].a > out[0].a && out[2].a > out[1].a);
  assert.deepEqual(alignSaid('anything', []), []);
  assert.deepEqual(alignSaid('  ', heard), []);
});

test('a repeated word matches in order, not the same heard word twice', () => {
  const twice = [{ s: 'I', a: 0, b: 0.2 }, { s: 'love', a: 0.2, b: 0.5 }, { s: 'you', a: 0.5, b: 0.8 }, { s: 'I', a: 1.5, b: 1.6 }, { s: 'love', a: 1.6, b: 1.9 }, { s: 'you', a: 1.9, b: 2.2 }];
  assert.deepEqual(alignSaid('I love you I love you', twice).map((w) => w.a), [0, 0.2, 0.5, 1.5, 1.6, 1.9]);
});
