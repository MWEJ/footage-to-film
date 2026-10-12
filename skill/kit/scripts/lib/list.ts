import type { Section } from '../../src/edit';
import type { Focus, Media, Rect } from '../../src/types';

/** One thing in the edit, as a line of a shot list. a and b are timeline seconds. */
export type Row = { kind: 'shot' | 'photo' | 'caption' | 'text' | 'element' | 'effect'; a: number; b: number; section: string; what: string; detail: string };

/** A time the way a player shows it: minutes, seconds, tenths. */
export function clock(t: number): string {
  const tenths = Math.round(t * 10);
  return `${Math.floor(tenths / 600)}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}

/** A time as a bar (from 1) and a beat (from 1, with fractions). */
export function barBeat(t: number, g: { BAR: number; BEAT: number }): { bar: number; beat: number } {
  const bar = Math.floor(t / g.BAR + 1e-9);
  return { bar: bar + 1, beat: Math.round(((t - bar * g.BAR) / g.BEAT + 1) * 100) / 100 };
}

/** Where a rectangle sits in the frame. */
export function place(rect: Rect, w: number, h: number): string {
  const [x, y, rw, rh] = rect;
  if (x <= 0 && y <= 0 && x + rw >= w && y + rh >= h) return 'full frame';
  const pc = (v: number, of: number): number => Math.round((v / of) * 100);
  return `x ${pc(x, w)}-${pc(x + rw, w)}%, y ${pc(y, h)}-${pc(y + rh, h)}%`;
}

const f2 = (n: number): string => n.toFixed(2);

function focusText(focus: Focus | undefined, zoomTo: number | Focus | undefined): string {
  if (!focus && zoomTo === undefined) return '';
  const f = focus ?? [0.5, 0.5];
  let s = `focus ${f2(f[0])} ${f2(f[1])}`;
  if (f[2] !== undefined) s += ` zoom ${f2(f[2])}`;
  if (typeof zoomTo === 'number') s += ` to ${f2(zoomTo)}`;
  else if (zoomTo) s += ` moving to ${f2(zoomTo[0])} ${f2(zoomTo[1])}${zoomTo[2] !== undefined ? ` zoom ${f2(zoomTo[2])}` : ''}`;
  return s;
}

/** How a picture arrives, leaves and is shaped, when the edit says so: a change to any of it redraws the picture. */
function motionText(l: Media): string {
  const parts: string[] = [];
  if (l.reveal && l.reveal !== 'none') parts.push(`in: ${l.reveal}${l.revealD !== undefined ? ` ${l.revealD} s` : ''}`);
  if (l.exit && l.exit !== 'none') parts.push(`out: ${l.exit}${l.exitD !== undefined ? ` ${l.exitD} s` : ''}`);
  if (l.bump) parts.push(`bump ${l.bump}`);
  if (l.radius) parts.push(`radius ${l.radius}`);
  return parts.join(', ');
}

/** The edit as rows, in the order things happen (ties keep the edit's own order). */
export function rowsOf(edit: Section[], g: { W: number; H: number }): Row[] {
  const rows: Row[] = [];
  for (const s of edit) {
    for (const l of s.layers) {
      const base = { a: l.a, b: l.a + l.d, section: s.id };
      if (l.kind === 'shot') {
        const speed = l.speed ?? 1;
        const parts = [`source ${f2(l.in)}-${f2(l.in + l.d * speed)} s${speed !== 1 ? ` at speed ${speed}` : ''}`, place(l.rect, g.W, g.H), focusText(l.focus, l.zoomTo), motionText(l)];
        if (l.full) parts.push('full-resolution file');
        if ((l.audio ?? 'off') !== 'off') parts.push(`sound: ${l.audio}${l.gain !== undefined && l.gain !== 1 ? ` at ${l.gain}` : ''}${l.clean === false ? ', not cleaned' : ''}`);
        rows.push({ ...base, kind: 'shot', what: `shot ${l.clip}`, detail: parts.filter(Boolean).join(', ') });
      } else if (l.kind === 'photo') {
        rows.push({ ...base, kind: 'photo', what: `photo ${l.name}`, detail: [place(l.rect, g.W, g.H), focusText(l.focus, l.zoomTo), motionText(l)].filter(Boolean).join(', ') });
      } else if (l.kind === 'sfx') {
        rows.push({ ...base, kind: 'effect', what: `effect ${l.name}`, detail: `${l.gain ?? -12} dB` });
      } else if (l.text && l.text.length > 0) {
        rows.push({ ...base, kind: l.tag === 'caption' ? 'caption' : 'text', what: l.text.join(' / '), detail: '' });
      } else {
        rows.push({ ...base, kind: 'element', what: 'a drawn element without words', detail: '' });
      }
    }
  }
  return rows.map((r, i) => ({ r, i })).sort((x, y) => x.r.a - y.r.a || x.i - y.i).map((x) => x.r);
}

/** Everything about a row, as one string: two rows with the same signature are the same thing at the same time. */
export const signature = (r: Row): string => JSON.stringify([r.kind, r.a.toFixed(3), r.b.toFixed(3), r.section, r.what, r.detail]);

/** Ranges in order, with those that overlap or lie within `join` seconds of each other made one. */
export function mergeRanges(ranges: [number, number][], join = 0.05): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + join) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** What differs between two shot lists: the rows only in one of them, and the stretches of the timeline they cover. */
export function diffRows(before: Row[], now: Row[]): { added: Row[]; removed: Row[]; ranges: [number, number][] } {
  const count = (rows: Row[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(signature(r), (m.get(signature(r)) ?? 0) + 1);
    return m;
  };
  const only = (rows: Row[], other: Map<string, number>): Row[] => {
    const left = new Map(other);
    return rows.filter((r) => {
      const n = left.get(signature(r)) ?? 0;
      if (n > 0) left.set(signature(r), n - 1);
      return n === 0;
    });
  };
  const added = only(now, count(before));
  const removed = only(before, count(now));
  return { added, removed, ranges: mergeRanges([...added, ...removed].map((r): [number, number] => [r.a, r.b])) };
}

/** The rows as a markdown table. */
export function table(rows: Row[], g: { BAR: number; BEAT: number }): string[] {
  const esc = (s: string): string => s.replace(/\|/g, '/');
  return [
    '| Time | Bar | Beat | Length | Section | What | Detail |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r) => {
      const { bar, beat } = barBeat(r.a, g);
      return `| ${clock(r.a)} | ${bar} | ${beat} | ${(r.b - r.a).toFixed(2)} s | ${r.section} | ${esc(r.what)} | ${esc(r.detail)} |`;
    }),
  ];
}
