/**
 * Faults that last one frame, found in the mean brightness of each frame (0 to 255).
 * A flicker: a frame brighter or darker than both its neighbours by more than `spike`, while the neighbours agree.
 * A jump: brightness that changes by more than `step` from one frame to the next where the edit has no cut, all in that
 * one frame. A step whose neighbours on both sides go the same way and are at least half as large is part of a fade
 * (a flash dying away after its cut), not a jump.
 * Cuts, flashes and wipes change the whole picture at once and are not faults: nothing within a frame of a cut counts.
 */
export function glitches(y: number[], cuts: Set<number>, o: { spike?: number; step?: number } = {}): { flickers: number[]; jumps: number[] } {
  const spike = o.spike ?? 4;
  const step = o.step ?? 14;
  const near = (i: number): boolean => cuts.has(i - 1) || cuts.has(i) || cuts.has(i + 1);
  const flickers: number[] = [];
  const jumps: number[] = [];
  for (let i = 1; i < y.length; i++) {
    if (near(i)) continue;
    const d1 = y[i] - y[i - 1];
    const d2 = i + 1 < y.length ? y[i + 1] - y[i] : 0;
    const isFlicker = Math.abs(d1) > spike && Math.abs(d2) > spike && d1 * d2 < 0 && Math.abs(y[i + 1] - y[i - 1]) < 0.5 * Math.min(Math.abs(d1), Math.abs(d2));
    const d0 = i >= 2 ? y[i - 1] - y[i - 2] : 0;
    const fade = d0 * d1 > 0 && d2 * d1 > 0 && Math.min(Math.abs(d0), Math.abs(d2)) >= 0.5 * Math.abs(d1);
    if (isFlicker) flickers.push(i);
    // The frame after a flicker returns to where it was: that is the same fault, not a jump.
    else if (Math.abs(d1) > step && !fade && !flickers.includes(i - 1)) jumps.push(i);
  }
  return { flickers, jumps };
}
