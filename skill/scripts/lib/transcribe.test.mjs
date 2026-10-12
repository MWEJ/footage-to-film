import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOUBT, dtwPreset, phrases, wordsFromWhisper } from './transcribe.mjs';

const entry = (text, from, to) => ({ timestamps: { from: '', to: '' }, offsets: { from, to }, text });
/** An entry as whisper writes it with alignment: tokens carry a time in hundredths of a second and a probability. */
const aligned = (text, from, to, tokens) => ({ ...entry(text, from, to), tokens: tokens.map(([t, t_dtw, p]) => ({ text: t, t_dtw, p })) });

/** A word as whisper writes it with alignment, with one token per time (hundredths of a second). */
const tokened = (text, ...times) => ({ text: ` ${text}`, offsets: { from: 0, to: 0 }, tokens: times.map((t) => ({ text, t_dtw: t, p: 0.9 })) });

test('a word starts 0.45 s before its first token, but never before the word before it ended', () => {
  // Slow speech: each word well after the last. The lead decides.
  const slow = wordsFromWhisper({ transcription: [tokened('Advanced', 166), tokened('practice', 294)] });
  assert.deepEqual(slow.map((w) => [w.s, w.a, w.b]), [['Advanced', 1.21, 1.76], ['practice', 2.49, 3.04]]);
  // Running speech: words follow on. Each starts where the one before ended.
  const fast = wordsFromWhisper({ transcription: [tokened('Thank', 1786), tokened('you', 1802), tokened('my', 1824)] });
  assert.deepEqual(fast.map((w) => w.a), [17.41, 17.86, 18.02]);
});

test('a word of several tokens starts before its first and ends after its last', () => {
  const [of, year] = wordsFromWhisper({ transcription: [tokened('of', 1436), tokened('2026', 1484, 1538)] });
  assert.equal(of.a, 13.91);
  assert.deepEqual([year.a, year.b], [14.39, 15.48]);
});

test('the first word never starts before the clip does', () => {
  assert.equal(wordsFromWhisper({ transcription: [tokened('Okay', 24)] })[0].a, 0);
});

test('alignment times never put a word before the one in front of it, and markers are not tokens', () => {
  // whisper gave "so" an earlier time than "okay": it starts where "okay" ended, and lasts at least 0.1 s.
  const words = wordsFromWhisper({ transcription: [aligned(' okay', 0, 1000, [[' okay', 24, 0.29]]), aligned(' so', 1000, 1100, [[' so', 20, 0.9], ['[_TT_50]', -1, 0.2]])] });
  assert.deepEqual(words.map((w) => [w.a, w.b, w.p]), [[0, 0.34, 0.29], [0.24, 0.34, 0.9]]);
});

test('dtwPreset names the alignment preset for a model file', () => {
  assert.equal(dtwPreset('/models/ggml-large-v3-turbo.bin'), 'large.v3.turbo');
  assert.equal(dtwPreset('ggml-base.en.bin'), 'base.en');
  assert.equal(dtwPreset('ggml-large-v3-turbo-q5_0.bin'), 'large.v3.turbo');
});

test('a phrase carries the lowest probability of its words, so an invented one can be flagged', () => {
  const invented = phrases([{ s: 'Transcription', a: 0, b: 2.8, p: 0.05 }, { s: 'by', a: 2.8, b: 3.3, p: 0.9 }, { s: 'CastingWords', a: 3.3, b: 6, p: 0.8 }]);
  assert.equal(invented.length, 1);
  assert.equal(invented[0].p, 0.05);
  assert.ok(invented[0].p < DOUBT);
  assert.ok(phrases([{ s: 'okay', a: 0, b: 0.5, p: 0.29 }])[0].p >= DOUBT);
});

test('wordsFromWhisper turns one entry per word into words with seconds', () => {
  const words = wordsFromWhisper({ transcription: [entry(' The', 1000, 1180), entry(' quick', 1180, 1500), entry(' fox.', 1500, 2100)] });
  assert.deepEqual(words, [{ s: 'The', a: 1, b: 1.18 }, { s: 'quick', a: 1.18, b: 1.5 }, { s: 'fox.', a: 1.5, b: 2.1 }]);
});

test('markers for silence and music, and empty entries, are not words', () => {
  const words = wordsFromWhisper({ transcription: [entry(' [BLANK_AUDIO]', 0, 3000), entry('', 3000, 3000), entry(' (music)', 3000, 5000), entry(' ♪', 5000, 6000), entry(' Hej', 6000, 6400)] });
  assert.deepEqual(words, [{ s: 'Hej', a: 6, b: 6.4 }]);
});

test('a clip with nothing in it gives no words', () => {
  assert.deepEqual(wordsFromWhisper({ transcription: [] }), []);
  assert.deepEqual(wordsFromWhisper({}), []);
});

test('phrases joins words until a pause', () => {
  const p = phrases([{ s: 'Advanced', a: 12.2, b: 12.8 }, { s: 'practice', a: 13.1, b: 13.6 }, { s: 'nurse', a: 15.4, b: 16 }]);
  assert.deepEqual(p, [{ a: 12.2, b: 13.6, s: 'Advanced practice' }, { a: 15.4, b: 16, s: 'nurse' }]);
  assert.deepEqual(phrases([]), []);
});
