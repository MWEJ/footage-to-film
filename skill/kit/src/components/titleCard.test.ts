import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitLabel, fitSize, titleCard } from './titleCard';

test('a short title gets the largest size, a long one is sized to fit the width', () => {
  assert.equal(fitSize('Maya', 300, 1536), 300);
  const long = fitSize('A Graduation Weekend in Arlington', 300, 1536);
  assert.ok(long > 100 && long < 102, `${long}`);
  assert.equal(fitSize('', 300, 1536), 300);
});

test('titleCard returns one text element that lists its words, for the spelling stills', () => {
  const layers = titleCard({ a: 4, d: 2, title: 'Maya', kicker: 'A graduation weekend', foot: 'Arlington, Virginia' });
  assert.equal(layers.length, 1);
  const l = layers[0];
  assert.equal(l.kind, 'el');
  assert.equal(l.a, 4);
  assert.equal(l.d, 2);
  if (l.kind === 'el') {
    assert.equal(l.tag, 'text');
    assert.deepEqual(l.text, ['A graduation weekend', 'Maya', 'Arlington, Virginia']);
  }
});

test('a label that fits keeps its size; a long one shrinks, with its letter-spacing, to the width', () => {
  assert.deepEqual(fitLabel('A FILM', 26, 12, 900), { size: 26, ls: 12 });
  // 36 characters: about 788 px wide at this size, so it must shrink to fit 600.
  const long = fitLabel('ARLINGTON, VIRGINIA — SEPTEMBER 2026', 24, 7, 600);
  assert.ok(long.size < 24 && long.size > 12, `${long.size}`);
  assert.ok(Math.abs(long.ls / long.size - 7 / 24) < 1e-9, 'spacing shrinks in proportion');
  // Its estimated width is now the width it was given.
  assert.ok(Math.abs(36 * (0.62 * long.size + long.ls) - 600) < 1e-6);
});
