import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modeLevel, vocalGate, type Part } from './music';

const parts: Part[] = [
  { a: 0, b: 8, mode: 'full' },
  { a: 8, b: 16, mode: 'bed' },
  { a: 16, b: 24, mode: 'full' },
  { a: 24, b: 32, mode: 'off' },
];

test('a section says how much of the song plays', () => {
  assert.deepEqual((['vocals', 'drums', 'bass', 'other'] as const).map((s) => modeLevel(s, 4, parts)), [1, 1, 1, 1]);
  assert.deepEqual((['vocals', 'drums', 'bass', 'other'] as const).map((s) => modeLevel(s, 12, parts)), [0, 0, 0.7, 1]);
  assert.equal(modeLevel('drums', 28, parts), 0);
  assert.equal(modeLevel('vocals', 4, [{ a: 0, b: 8, mode: 'no-vocals' }]), 0);
  assert.equal(modeLevel('drums', 4, [{ a: 0, b: 8, mode: 'no-vocals' }]), 1);
  assert.equal(modeLevel('all', 28, parts), 0);
  assert.equal(modeLevel('all', 12, parts), 1); // a film without stems cannot thin the song
  assert.equal(modeLevel('drums', 40, parts), 1); // outside every section: the full song
});

test('the music thins before the bar line and comes back on it', () => {
  // Into the bed at 8 s: the drums glide out over the last quarter second of the section before.
  assert.equal(modeLevel('drums', 7.7, parts), 1);
  assert.ok(Math.abs(modeLevel('drums', 7.875, parts) - 0.5) < 1e-9);
  assert.equal(modeLevel('drums', 8, parts), 0);
  // Back to the full song at 16 s: nothing before the bar line, everything on it, so the hit lands whole.
  assert.equal(modeLevel('drums', 15.99, parts), 0);
  assert.equal(modeLevel('drums', 16, parts), 1);
});

test('the singing steps aside for speech', () => {
  const speech: [number, number][] = [[10, 14]];
  assert.equal(vocalGate(5, speech), 1);
  assert.equal(vocalGate(9.6, speech), 1); // the fade starts 0.4 s before the line
  assert.ok(Math.abs(vocalGate(9.75, speech) - 0.5) < 1e-9);
  assert.equal(vocalGate(9.9, speech), 0); // gone a tenth of a second before the first word
  assert.equal(vocalGate(12, speech), 0);
  assert.ok(Math.abs(vocalGate(14.15, speech) - 0.5) < 1e-9);
  assert.equal(vocalGate(14.3, speech), 1);
  assert.equal(vocalGate(3, []), 1);
});
