import { E, clamp, lerp } from './ease';
import type { Media, Rect } from './types';

export type Region = { x: number; y: number; w: number; h: number };
/** A focus with its zoom filled in. */
export type Focus3 = [number, number, number];
export type Motion = { reveal: number; fade: number };

/** The part of the source (0..1 on both axes) that a rect shows, for a focus point and zoom. sar = source width / height. */
export function region(rect: Rect, f: Focus3, sar: number): Region {
  const rar = rect[2] / rect[3];
  let w: number;
  let h: number;
  if (rar > sar) { w = 1; h = sar / rar; } else { h = 1; w = rar / sar; }
  w /= f[2];
  h /= f[2];
  const cx = clamp(f[0], w / 2, 1 - w / 2);
  const cy = clamp(f[1], h / 2, 1 - h / 2);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Size and offset of the media element inside a container the size of the rect, so that the region fills the container. */
export function mediaBox(rect: Rect, reg: Region) {
  const width = rect[2] / reg.w;
  const height = rect[3] / reg.h;
  return { width, height, left: -reg.x * width, top: -reg.y * height };
}

/** Split an area into columns by fractions, with gutters. cols([1, 1, 1], 10, [0, 0, 1920, 1080]) is three equal panels. */
export function cols(fr: number[], gut: number, area: Rect): Rect[] {
  const [ax, ay, aw, ah] = area;
  const total = fr.reduce((a, b) => a + b, 0);
  const avail = aw - gut * (fr.length - 1);
  const out: Rect[] = [];
  let x = ax;
  for (const f of fr) {
    const w = (avail * f) / total;
    out.push([Math.round(x), ay, Math.round(x + w) - Math.round(x), ah]);
    x += w + gut;
  }
  return out;
}

/** Split an area into rows by fractions, with gutters: how panels stack in a tall frame. */
export function rows(fr: number[], gut: number, area: Rect): Rect[] {
  const [ax, ay, aw, ah] = area;
  const total = fr.reduce((a, b) => a + b, 0);
  const avail = ah - gut * (fr.length - 1);
  const out: Rect[] = [];
  let y = ay;
  for (const f of fr) {
    const h = (avail * f) / total;
    out.push([ax, Math.round(y), aw, Math.round(y + h) - Math.round(y)]);
    y += h + gut;
  }
  return out;
}

/** Focus at progress p (0..1) between f and g. bump adds a short zoom pulse at the cut; t is local seconds. */
export function focusAt(f: Focus3, g: Focus3, p: number, t: number, bump: number): Focus3 {
  let z = lerp(f[2], g[2], p);
  if (bump) z *= 1 + bump * (1 - E.out3(clamp(t / 0.3)));
  return [lerp(f[0], g[0], p), lerp(f[1], g[1], p), z];
}

/** Where a layer's focus starts and ends, with the defaults filled in. */
export function focusRange(m: Pick<Media, 'focus' | 'zoomTo'>): [Focus3, Focus3] {
  const f: Focus3 = [m.focus?.[0] ?? 0.5, m.focus?.[1] ?? 0.5, m.focus?.[2] ?? 1];
  const z = m.zoomTo;
  const g: Focus3 = z === undefined ? [f[0], f[1], f[2] + 0.04] : typeof z === 'number' ? [f[0], f[1], z] : [z[0], z[1], z[2] ?? f[2]];
  return [f, g];
}

/** Everything a shot or photo needs to draw itself at local time t (seconds since its start). */
export function mediaAt(m: Media, t: number, sar: number, motion: Motion) {
  const p = clamp(t / m.d);
  const [f, g] = focusRange(m);
  const box = mediaBox(m.rect, region(m.rect, focusAt(f, g, p, t, m.bump ?? 0), sar));
  let opacity = 1;
  const hide = { top: 0, right: 0, bottom: 0, left: 0 }; // percent of the layer hidden from each edge
  const reveal = m.reveal ?? 'none';
  const revealD = m.revealD ?? motion.reveal;
  if (reveal !== 'none' && t < revealD) {
    // 0.04 s head start: the first frame is already partly revealed, so no empty frame lands on the cut
    const q = E.out4(clamp((t + 0.04) / revealD));
    if (reveal === 'up') hide.top = (1 - q) * 100;
    else if (reveal === 'down') hide.bottom = (1 - q) * 100;
    else if (reveal === 'left') hide.right = (1 - q) * 100; // arrives from the left: the right part comes last
    else if (reveal === 'right') hide.left = (1 - q) * 100;
    else opacity *= q;
  }
  const exit = m.exit ?? 'none';
  const exitD = m.exitD ?? motion.fade;
  const left = m.d - t;
  if (exit !== 'none' && left < exitD) {
    const q = E.in2(clamp(1 - left / exitD)); // 0 when the exit starts, 1 at the layer's end
    if (exit === 'up') hide.bottom = Math.max(hide.bottom, q * 100);
    else if (exit === 'down') hide.top = Math.max(hide.top, q * 100);
    else if (exit === 'left') hide.right = Math.max(hide.right, q * 100); // leaves to the left: the right part goes first
    else if (exit === 'right') hide.left = Math.max(hide.left, q * 100);
    else opacity *= 1 - q;
  }
  const clipPath = hide.top || hide.right || hide.bottom || hide.left ? `inset(${hide.top}% ${hide.right}% ${hide.bottom}% ${hide.left}%)` : 'none';
  return { box, clipPath, opacity };
}
