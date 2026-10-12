import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Section } from '../../src/edit';
import { makeGrid } from '../../src/grid';
import { el, photo, sfx, shot } from '../../src/layers';
import type { Sources } from '../../src/sources';
import type { Layer, Rect } from '../../src/types';
import { checkEdit } from './checks';

const G = makeGrid({ fps: 30, bpm: 120, bars: 6, width: 1920, height: 1080 });
const FULL: Rect = [0, 0, 1920, 1080];
const SOURCES: Sources = {
  clips: {
    land: [{ file: 'land_L_000.0-008.0.mp4', tier: 'L', a: 0, b: 8, fps: 30, w: 1920, h: 1080, audio: true }],
    mute: [{ file: 'mute_L_000.0-008.0.mp4', tier: 'L', a: 0, b: 8, fps: 30, w: 1920, h: 1080, audio: false }],
    late: [{ file: 'late_L_010.0-020.0.mp4', tier: 'L', a: 10, b: 20, fps: 30, w: 1920, h: 1080, audio: true }],
  },
  photos: { pa: { file: 'pa.jpg', w: 2160, h: 2880 } },
};
const section = (layers: Layer[], grid: 'beat' | 'free' = 'beat', a = 0, b = 12): Section => ({ id: 's', a, b, grid, layers });
const check = (edit: Section[], music = true, g = G) => checkEdit(edit, SOURCES, g, music);
const fails = (edit: Section[], music = true, g = G) => check(edit, music, g).filter((f) => f.level === 'FAIL').map((f) => f.what);
const notes = (edit: Section[], music = true, g = G) => check(edit, music, g).filter((f) => f.level === 'NOTE').map((f) => f.what);
const cap = (a: number, d: number) => el({ a, d, node: null, tag: 'caption', text: ['words'] });

test('a clean edit has no findings', () => {
  const talk = shot({ a: 0, d: 6, clip: 'land', in: 0.5, rect: FULL, audio: 'speech' });
  assert.deepEqual(check([section([talk, cap(0, 6), photo({ a: 6, d: 6, name: 'pa', rect: FULL })])]), []);
});

test('a shot that runs past its converted file fails, naming what exists', () => {
  const f = fails([section([shot({ a: 0, d: 6, clip: 'land', in: 7.5, rect: FULL })])]);
  assert.equal(f.length, 1);
  assert.match(f[0], /no converted file covers clip land from 7\.50 to 13\.50 s \(have: L 0-8\)/);
});

test('a layer outside its section fails', () => {
  const f = fails([section([photo({ a: 5, d: 2, name: 'pa', rect: FULL })], 'beat', 0, 6), section([], 'beat', 6, 12)]);
  assert.match(f[0], /runs from 5\.00 to 7\.00 s, outside its section \(0\.00 to 6\.00 s\)/);
});

test('in a section cut on the beat, an off-beat cut fails unless the layer or the section is free', () => {
  const off = photo({ a: 5.2, d: 0.8, name: 'pa', rect: FULL });
  assert.match(fails([section([off])])[0], /starts off the beat \(the nearest half-beat is 5\.25 s\)/);
  assert.deepEqual(fails([section([{ ...off, free: true }])]), []);
  assert.deepEqual(fails([section([off], 'free')]), []);
});

test('at a tempo whose beats fall between frames, cuts on the beat pass', () => {
  const g = makeGrid({ fps: 30, bpm: 128, bars: 8, width: 1920, height: 1080 });
  const onBeat = photo({ a: g.T(1, 3), d: 2 * g.BEAT, name: 'pa', rect: FULL });
  assert.deepEqual(fails([section([onBeat], 'beat', 0, g.SECONDS)], true, g), []);
});

test('a spoken shot needs a caption over it', () => {
  const talk = shot({ a: 0, d: 6, clip: 'land', in: 0.5, rect: FULL, audio: 'speech' });
  assert.match(fails([section([talk])])[0], /is a spoken shot with no caption over it/);
  assert.match(fails([section([talk, cap(6, 2)])])[0], /no caption/);
  assert.deepEqual(fails([section([talk, cap(2, 2)])]), []);
});

test('a shot set to play sound from a file without sound fails', () => {
  const f = fails([section([shot({ a: 0, d: 6, clip: 'mute', in: 0.5, rect: FULL, audio: 'nat' })])]);
  assert.match(f[0], /is set to play its sound \(nat\), but mute_L_000\.0-008\.0\.mp4 has no sound/);
});

test('an unknown photo fails and lists the photos', () => {
  assert.match(fails([section([photo({ a: 0, d: 2, name: 'nope', rect: FULL })])])[0], /unknown photo nope \(have: pa\)/);
});

test('gaps, silence and a sound that starts on a file\'s first sample are notes, not failures', () => {
  const edit = [section([shot({ a: 2, d: 2, clip: 'late', in: 10, rect: FULL, audio: 'nat' })], 'beat', 2, 6)];
  assert.deepEqual(fails(edit, false), []);
  const n = notes(edit, false);
  assert.ok(n.some((s) => /nothing but the backdrop from 0\.00 to 2\.00 s/.test(s)));
  assert.ok(n.some((s) => /nothing but the backdrop from 6\.00 s to the end \(12\.00 s\)/.test(s)));
  assert.ok(n.some((s) => /starts on the first sample of late_L_010\.0-020\.0\.mp4/.test(s)));
  assert.ok(notes([section([photo({ a: 0, d: 12, name: 'pa', rect: FULL })])], false).some((s) => /the film is silent/.test(s)));
});

test('sections may not overlap or pass the end of the film', () => {
  const f = fails([section([], 'beat', 0, 8), section([], 'beat', 6, 14)]);
  assert.ok(f.some((s) => /starts at 6\.00 s, before the section before it ends \(8\.00 s\)/.test(s)));
  assert.ok(f.some((s) => /ends at 14\.00 s, after the film's end \(12\.00 s\)/.test(s)));
});

test('an effect is checked for its place, not for the beat, and counts as sound', () => {
  assert.deepEqual(fails([section([sfx({ t: 5.2, name: 'pop' })])]), []);
  // As npm run check prints it: where, then what.
  const late = check([section([sfx({ t: 13, name: 'pop' })])]).filter((f) => f.level === 'FAIL').map((f) => `${f.where}: ${f.what}`);
  assert.match(late[0], /sound effect pop at 13\.00 s: runs from 13\.00 to 13\.10 s, outside its section/);
  assert.ok(!notes([section([sfx({ t: 1, name: 'pop' })])], false).some((s) => /the film is silent/.test(s)));
});
