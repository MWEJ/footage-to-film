import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupMarks, type Mark } from './marks';

const cut = (t: number, what: string): Mark => ({ t, what, cut: true });
const text = (t: number, what: string): Mark => ({ t, what, cut: false });

test('a row of panels that arrive one after another gets one still, after the last has arrived', () => {
  const g = groupMarks([cut(8.4, 'left'), cut(8.48, 'middle'), cut(8.56, 'right'), cut(10.4, 'photo')]);
  assert.deepEqual(g, [
    { t: 8.56, what: ['left', 'middle', 'right'] },
    { t: 10.4, what: ['photo'] },
  ]);
});

test('cuts a half-beat apart are separate stills, however many follow each other', () => {
  const g = groupMarks([cut(6.4, 'a'), cut(6.65, 'b'), cut(6.9, 'c'), cut(7.15, 'd')]);
  assert.deepEqual(g.map((x) => x.t), [6.4, 6.65, 6.9, 7.15]);
});

test('a group is measured from its first cut, so a long run of close cuts is not swallowed whole', () => {
  const g = groupMarks([cut(1, 'a'), cut(1.15, 'b'), cut(1.3, 'c'), cut(1.45, 'd')]);
  assert.deepEqual(g.map((x) => x.what), [['a', 'b'], ['c', 'd']]);
});

test('text marks are never merged, and everything comes back in time order', () => {
  const g = groupMarks([text(8.5, 'caption one'), cut(8.56, 'right'), cut(8.4, 'left'), text(8.5, 'caption two')]);
  assert.deepEqual(g, [
    { t: 8.5, what: ['caption one'] },
    { t: 8.5, what: ['caption two'] },
    { t: 8.56, what: ['left', 'right'] },
  ]);
});
