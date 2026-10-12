import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shot } from '../layers';
import { caption, captionLines, type Word } from './caption';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);
const WORDS: Word[] = [
  { s: 'Advanced', a: 12.2, b: 12.8 },
  { s: 'practice', a: 13.1, b: 13.6 },
  { s: 'registered', a: 14.5, b: 15.0 },
  { s: 'nurse', a: 15.4, b: 16.0 },
];

test('words are grouped into lines at pauses and placed on the timeline', () => {
  const lines = captionLines(WORDS, { a: 2, d: 5, in: 12 });
  assert.deepEqual(lines.map((l) => l.s), ['Advanced practice', 'registered nurse']);
  near(lines[0].a, 2.2);
  near(lines[0].b, 4.5); // stays up until the next line, which starts within a second
  near(lines[1].a, 4.5);
  near(lines[1].b, 6.4); // 0.4 s after its last word
});

test('a slowed shot stretches the word times, and words outside the shot are dropped', () => {
  const lines = captionLines(WORDS, { a: 0, d: 4, in: 12, speed: 0.5 });
  assert.deepEqual(lines.map((l) => l.s), ['Advanced practice']);
  near(lines[0].a, 0.4);
  near(lines[0].b, 3.6);
});

test('a long sentence is split when a line would pass the character limit', () => {
  const sentence = 'The quick brown fox jumps over the lazy dog'.split(' ').map((s, i) => ({ s, a: i * 0.3, b: i * 0.3 + 0.3 }));
  const lines = captionLines(sentence, { a: 0, d: 3, in: 0 }, 20);
  assert.deepEqual(lines.map((l) => l.s), ['The quick brown fox', 'jumps over the lazy', 'dog']);
});

test('caption makes one element tagged as a caption, with its lines and a still time for each', () => {
  const s = shot({ a: 2, d: 5, clip: 'x', in: 12, rect: [0, 0, 100, 100], audio: 'speech' });
  const [l] = caption({ shot: s, words: WORDS });
  assert.equal(l.kind, 'el');
  if (l.kind !== 'el') return;
  assert.equal(l.tag, 'caption');
  assert.equal(l.a, 2);
  assert.equal(l.d, 5);
  assert.deepEqual(l.text, ['Advanced practice', 'registered nurse']);
  near(l.stills![0], 3.35);
  near(l.stills![1], 5.45);
});

test('caption without words or lines says which clip and range it needed', () => {
  const s = shot({ a: 2, d: 5, clip: 'x', in: 12, rect: [0, 0, 100, 100], audio: 'speech' });
  assert.throws(() => caption({ shot: s }), /caption: no words for clip x between 12\.00 and 17\.00 s/);
});

test('caption takes hand-written lines as they are', () => {
  const s = shot({ a: 2, d: 5, clip: 'x', in: 12, rect: [0, 0, 100, 100], audio: 'speech' });
  const [l] = caption({ shot: s, lines: [{ s: 'Ærø, here we come', a: 2.5, b: 4 }] });
  assert.deepEqual(l.kind === 'el' ? l.text : null, ['Ærø, here we come']);
});

test('a caption can be given the words as they should read, and keeps the heard times', () => {
  const s = shot({ a: 10, d: 4, clip: 'c', in: 0, rect: [0, 0, 1920, 1080], audio: 'speech' });
  const heard = [{ s: 'Okay,', a: 0.5, b: 0.9 }, { s: 'my', a: 1.0, b: 1.2 }, { s: 'name', a: 1.2, b: 1.5 }, { s: 'is', a: 1.5, b: 1.7 }, { s: 'Hanson.', a: 1.7, b: 2.6 }];
  const [l] = caption({ shot: s, words: heard, say: 'Okay, my name is Hansen.' });
  assert.deepEqual(l.kind === 'el' ? l.text : [], ['Okay, my name is Hansen.']);
  assert.throws(() => caption({ shot: s, words: [], say: 'Hello' }), /caption: no words were heard/);
});
