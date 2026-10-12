import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, safeArea } from './grid';

const G = makeGrid({ fps: 30, bpm: 120, bars: 12, width: 1920, height: 1080 });

test('120 BPM gives 2 s bars and 0.5 s beats', () => {
  assert.equal(G.BAR, 2);
  assert.equal(G.BEAT, 0.5);
});

test('T counts bars and beats from 1', () => {
  assert.equal(G.T(1), 0);
  assert.equal(G.T(8), 14);
  assert.equal(G.T(1, 3), 1);
  assert.equal(G.T(2, 2.5), 2.75);
});

test('toFrame rounds to the nearest frame and onFrame spots times between frames', () => {
  assert.equal(G.toFrame(0.1), 3);
  assert.equal(G.toFrame(11.9), 357);
  assert.equal(G.onFrame(0.1), true);
  assert.equal(G.onFrame(24.75), false);
});

test('the film length comes from the bar count', () => {
  assert.equal(G.SECONDS, 24);
  assert.equal(G.FRAMES, 720);
});

test('U scales sizes from a 1080-pixel short side', () => {
  assert.equal(G.U, 1);
  assert.equal(makeGrid({ fps: 30, bpm: 120, bars: 1, width: 1080, height: 1920 }).U, 1);
  assert.equal(makeGrid({ fps: 30, bpm: 120, bars: 1, width: 3840, height: 2160 }).U, 2);
});

test('onGrid accepts half-beats and rejects times between them', () => {
  assert.equal(G.onGrid(5.25), true);
  assert.equal(G.onGrid(5.2), false);
});

test('at a tempo whose beats fall between frames, a beat rounded to its frame is still on the grid', () => {
  const g = makeGrid({ fps: 30, bpm: 128, bars: 8, width: 1920, height: 1080 });
  const beat3 = g.T(1, 3); // 0.9375 s: between frames 28 and 29
  assert.equal(g.onFrame(beat3), false);
  assert.equal(g.onGrid(beat3), true);
  assert.equal(g.onGrid(g.toFrame(beat3) / 30), true);
  assert.equal(g.onGrid(beat3 + 0.1), false);
});

test('the frame shape is named from its size', () => {
  assert.equal(G.FORMAT, 'wide');
  assert.equal(makeGrid({ fps: 30, bpm: 120, bars: 1, width: 1080, height: 1920 }).FORMAT, 'tall');
  assert.equal(makeGrid({ fps: 30, bpm: 120, bars: 1, width: 1080, height: 1080 }).FORMAT, 'square');
});

test('the safe area is the margin on every side, and deeper at the top and bottom of a tall frame', () => {
  const same = (got: Record<string, number>, want: Record<string, number>) => {
    for (const k of Object.keys(want)) assert.ok(Math.abs(got[k] - want[k]) < 1e-9, `${k}: ${got[k]} is not ${want[k]}`);
  };
  same(safeArea(1920, 1080, 0.06), { l: 64.8, r: 64.8, t: 64.8, b: 64.8 });
  same(safeArea(1080, 1080, 0.06), { l: 64.8, r: 64.8, t: 64.8, b: 64.8 });
  // Apps that show tall video cover the top and the bottom with their own controls.
  same(safeArea(1080, 1920, 0.06), { l: 64.8, r: 64.8, t: 192, b: 307.2 });
});

test('a film can be cut to a song at any tempo: beats land on the nearest frame and never drift', () => {
  const g = makeGrid({ fps: 30, bpm: 97.3, bars: 73, width: 1920, height: 1080 });
  const beat = 60 / 97.3;
  assert.ok(Math.abs(g.BEAT - beat) < 1e-12);
  // The last beat of a three-minute film is still within half a frame of where the song has it.
  const t = g.T(73, 4);
  assert.ok(Math.abs(t - (72 * 4 + 3) * beat) < 1e-9);
  assert.ok(Math.abs(g.toFrame(t) / 30 - t) <= 0.5 / 30 + 1e-9);
  assert.ok(g.onGrid(t) && g.onGrid(g.T(40, 2.5)) && !g.onGrid(g.T(40, 2.5) + 0.1));
  assert.equal(g.FRAMES, Math.round(73 * 4 * beat * 30));
});
