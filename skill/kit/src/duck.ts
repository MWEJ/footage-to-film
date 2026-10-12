import { clamp } from './ease';

/** A stretch of speech on the timeline (seconds) and the music's gain under it (0 to 1). */
export type DuckRange = [a: number, b: number, low: number];

/** How a spoken range is known in duck.json: where it sits on the timeline. A range that moves loses its measurement. */
export const duckKey = (a: number, b: number): string => `${a.toFixed(3)}-${b.toFixed(3)}`;

/**
 * How far to turn the music down under a line, in decibels, so that music at `music` LUFS sits `under` dB below speech
 * at `speech` LUFS. Never less than 4 (a line should be felt to come forward) and never more than 18.
 */
export const duckDepth = (music: number, speech: number, under: number): number => Math.min(18, Math.max(4, music - (speech - under)));

/** Spoken ranges with the music's gain for each. Lines `bridge` seconds apart or closer share one duck, so the music does not pump up between them. */
export function duckRanges(speech: [number, number][], lowFor: (a: number, b: number) => number, bridge = 1): DuckRange[] {
  const out: DuckRange[] = [];
  for (const [a, b] of speech) {
    const low = lowFor(a, b);
    const last = out[out.length - 1];
    if (last && a - last[1] <= bridge + 1e-9) {
      last[1] = Math.max(last[1], b);
      last[2] = Math.min(last[2], low);
    } else out.push([a, b, low]);
  }
  return out;
}

/**
 * Music gain at time t (seconds): each range's own `low` during it (or `low` for a range without one), 1 elsewhere.
 * It eases down over `attack` seconds before speech and comes back over `release` seconds after,
 * so a musical drop right after a spoken line is not swallowed.
 */
export function duckGain(t: number, ranges: ([number, number] | DuckRange)[], low = 0.4, attack = 0.4, release = 0.1): number {
  let gain = 1;
  for (const r of ranges) {
    const [a, b] = r;
    const floor = r[2] ?? low;
    let open: number; // 0 = fully ducked, 1 = fully open
    if (t >= a && t <= b) open = 0;
    else if (t < a) open = clamp((a - t) / attack);
    else open = clamp((t - b) / release);
    gain = Math.min(gain, floor + (1 - floor) * open);
  }
  return gain;
}
