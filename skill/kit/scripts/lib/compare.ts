import { rms } from './audio';
import { mergeRanges } from './list';

/** ffmpeg's `signalstats,metadata=print` output as one entry per frame: the mean and the brightest spot of the picture. */
export function parseStats(text: string): { avg: number; max: number }[] {
  const out: { avg: number; max: number }[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('frame:')) out.push({ avg: 0, max: 0 });
    const last = out[out.length - 1];
    if (!last) continue;
    const avg = line.match(/^lavfi\.signalstats\.YAVG=([\d.]+)/);
    const max = line.match(/^lavfi\.signalstats\.YMAX=([\d.]+)/);
    if (avg) last.avg = Number(avg[1]);
    if (max) last.max = Number(max[1]);
  }
  return out;
}

/** The frames at which two films differ, from the statistics of their difference picture. Two encodes of the same frames stay under both marks. */
export function changedFrames(stats: { avg: number; max: number }[], o: { max?: number; avg?: number } = {}): number[] {
  const out: number[] = [];
  stats.forEach((s, i) => {
    if (s.max > (o.max ?? 10) || s.avg > (o.avg ?? 0.6)) out.push(i);
  });
  return out;
}

/** Runs of changed frames as ranges in seconds. Frames at most `join` apart belong to one range. */
export function frameRanges(frames: number[], fps: number, join = 3): [number, number][] {
  const out: [number, number][] = [];
  for (const f of frames) {
    const last = out[out.length - 1];
    if (last && f - last[1] <= join) last[1] = f;
    else out.push([f, f]);
  }
  return out.map(([a, b]): [number, number] => [a / fps, (b + 1) / fps]);
}

/**
 * Where two mixes differ, in seconds, judged in quarter-second windows: what is left when one is subtracted from the
 * other, against the louder of the two. A mix that is the same but a little louder or softer throughout is not a change.
 */
export function soundRanges(a: Float32Array, b: Float32Array, rate: number): [number, number][] {
  const n = Math.round(rate / 4);
  const count = Math.floor(Math.min(a.length, b.length) / n);
  const found: [number, number][] = [];
  const diff = new Float32Array(n);
  for (let w = 0; w < count; w++) {
    const x = a.subarray(w * n, (w + 1) * n);
    const y = b.subarray(w * n, (w + 1) * n);
    const loud = Math.max(rms(x), rms(y));
    if (loud < 1e-3) continue;
    for (let i = 0; i < n; i++) diff[i] = x[i] - y[i];
    if (rms(diff) / loud > 0.15) found.push([w / 4, (w + 1) / 4]);
  }
  return mergeRanges(found, 0.3);
}

/**
 * When two films differ in length, the stretch that only the longer one has, in seconds: a difference of its own, judged
 * like any other. Null when they are the same length. (Where the length changes inside the film, everything after
 * that point differs as well, and is found frame by frame.)
 */
export function lengthDifference(framesA: number, framesB: number, fps: number): [number, number] | null {
  if (framesA === framesB) return null;
  return [Math.min(framesA, framesB) / fps, Math.max(framesA, framesB) / fps];
}

/**
 * Splits the differences found into those that lie within `slack` seconds of a change the edit's lists show, and the
 * rest. A difference that reaches more than `slack` past every change (a new theme redraws the whole film, and one row
 * moved) is split there: only the part near the change is explained.
 */
export function explain(found: [number, number][], expected: [number, number][], slack = 0.5): { explained: [number, number][]; unexplained: [number, number][] } {
  const wide = mergeRanges(expected.map(([x, y]): [number, number] => [x - slack, y + slack]), 0);
  const explained: [number, number][] = [];
  const unexplained: [number, number][] = [];
  for (const [a, b] of found) {
    if (!wide.some(([x, y]) => a < y && b > x)) {
      unexplained.push([a, b]);
      continue;
    }
    // The parts of this difference outside every change and its slack. Short ones are reveals and exits reaching past it.
    const outside: [number, number][] = [];
    let at = a;
    for (const [x, y] of wide) {
      if (y <= at) continue;
      if (x >= b) break;
      if (x > at) outside.push([at, x]);
      at = Math.max(at, y);
    }
    if (at < b) outside.push([at, b]);
    const far = outside.filter(([p, q]) => q - p > slack);
    if (far.length === 0) {
      explained.push([a, b]);
      continue;
    }
    unexplained.push(...far);
    let from = a;
    for (const [p, q] of far) {
      if (p > from) explained.push([from, p]);
      from = q;
    }
    if (from < b) explained.push([from, b]);
  }
  return { explained, unexplained };
}
