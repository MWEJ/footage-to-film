import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, heardFromWhisper, heardIn, lineFound, words } from './words';

test('words lowercases and drops punctuation, but keeps letters outside ASCII and apostrophes', () => {
  assert.deepEqual(words('Æblegrød på tirsdag!'), ['æblegrød', 'på', 'tirsdag']);
  assert.deepEqual(words('Don’t stop — it\'s 2026.'), ["don't", 'stop', "it's", '2026']);
  assert.deepEqual(words('  '), []);
});

test('a line is found when most of its words were heard', () => {
  assert.deepEqual(lineFound('The quick brown fox jumps over the lazy dog', ' The quick brown fox jumps over the lazy dog.\n'), { found: true, ratio: 1 });
  assert.equal(lineFound('Æblegrød på tirsdag', 'så blev det æblegrød på tirsdag').found, true);
  assert.equal(lineFound('one two three four five', 'one two three four fife').found, true); // four of five
  assert.deepEqual(lineFound('The quick brown fox', 'a slow red hen'), { found: false, ratio: 0 });
  assert.equal(lineFound('', 'anything').found, true);
});

test("whisper's segments become text with times", () => {
  const json = { transcription: [{ offsets: { from: 500, to: 3200 }, text: ' The quick brown fox' }, { offsets: { from: 3200, to: 5000 }, text: ' jumps over.' }] };
  assert.deepEqual(heardFromWhisper(json), [{ s: 'The quick brown fox', a: 0.5, b: 3.2 }, { s: 'jumps over.', a: 3.2, b: 5 }]);
  assert.deepEqual(heardFromWhisper({}), []);
});

test('a line is looked for around its own caption, not in the whole film', () => {
  const heard = [{ s: 'Welcome everyone', a: 0, b: 2 }, { s: 'the quick brown fox', a: 10, b: 13 }];
  assert.equal(heardIn(heard, 9.5, 14), 'the quick brown fox');
  assert.equal(heardIn(heard, 1.5, 10.2), 'Welcome everyone the quick brown fox');
  assert.equal(heardIn(heard, 20, 25), '');
});

test('why a line was lost: the mix, the cleaning, or the recording', () => {
  assert.match(diagnose({ speech: 0.9, raw: 1 }), /clear without the music/);
  assert.match(diagnose({ speech: 0.2, raw: 0.9 }), /clear in the clip itself but not after cleaning.*clean: false/);
  assert.match(diagnose({ speech: 0.2, raw: 0.3 }), /unclear in the recording itself/);
  assert.match(diagnose({ speech: null, raw: null }), /could not be checked further/);
});
