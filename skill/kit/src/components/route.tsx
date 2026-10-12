import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../Backdrop';
import { E, clamp, prog } from '../ease';
import { MaskUp, Txt } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import type { Layer } from '../types';
import { fitLabel, fitSize, textWidth } from './titleCard';

export type RouteOptions = { a: number; d: number; stops: string[]; title?: string };
type Safe = { l: number; r: number; t: number; b: number };

/** Where n stops sit: on a gentle wave across a wide or square frame, down a tall one. Always inside the safe area, with room for the names. */
export function routePoints(n: number, w: number, h: number, safe: Safe): [number, number][] {
  const tall = h > w;
  // The end stops sit a tenth of the frame inside the safe area: their names are centred on them, and in a square frame
  // a nine-letter name needs that room to stay at 22 px or more, the smallest a label may be.
  const x0 = safe.l + 0.1 * w;
  const x1 = w - safe.r - 0.1 * w;
  const y0 = safe.t + (tall ? 0.16 : 0.3) * (h - safe.t - safe.b);
  const y1 = h - safe.b - (tall ? 0.08 : 0.22) * (h - safe.t - safe.b);
  return Array.from({ length: n }, (_, i): [number, number] => {
    const k = n === 1 ? 0.5 : i / (n - 1);
    const wave = (i % 2 === 0 ? -1 : 1) * 0.5;
    return tall ? [w / 2 + wave * 0.18 * (x1 - x0), y0 + k * (y1 - y0)] : [x0 + k * (x1 - x0), (y0 + y1) / 2 + wave * 0.5 * (y1 - y0) * 0.5];
  });
}

/**
 * The width the name of stop i may take. Tall: from where the name starts, right of its dot, to the safe edge.
 * Wide or square: the name is centred on its dot, so it may reach neither safe edge, nor the name two stops on (names alternate above and below the line).
 */
function nameRoom(i: number, pts: [number, number][], tall: boolean, gap: number): number {
  const [x] = pts[i];
  if (tall) return W - SAFE.r - (x + 34 * U);
  const edges = 2 * Math.min(x - SAFE.l, W - SAFE.r - x);
  // The stops are evenly spaced, so the name on the same side is two spacings away; with each name at most this wide, two never touch.
  const sameSide = pts.length > 2 ? 2 * (pts[1][0] - pts[0][0]) - gap : Infinity;
  return Math.min(edges, sameSide);
}

const Route: React.FC<{ d: number; stops: string[]; title?: string }> = ({ d, stops, title }) => {
  const t = useCurrentFrame() / FPS;
  const pts = routePoints(stops.length, W, H, SAFE);
  const travel = clamp((t - 0.4) / Math.max(0.5, d * 0.6 - 0.4)); // the line is drawn over the first 60% of the card
  const reached = travel * (stops.length - 1); // how many legs are done, with a fraction for the one under way
  const tall = H > W;
  const head = Math.min(stops.length - 1, Math.floor(reached));
  const frac = reached - head;
  const hx = head >= stops.length - 1 ? pts[head][0] : pts[head][0] + (pts[head + 1][0] - pts[head][0]) * frac;
  const hy = head >= stops.length - 1 ? pts[head][1] : pts[head][1] + (pts[head + 1][1] - pts[head][1]) * frac;
  // A stop's name is one word in capitals, which runs wider than the measured average of the label face (that counts a sentence's
  // narrow spaces): about 1.15 times in Jost, so 1.2 for room. Every name is drawn at the size of the one that has least room.
  const names = stops.map((s) => s.toUpperCase());
  const fits = names.map((s, i) => fitLabel(s, 30 * U, 5 * U, nameRoom(i, pts, tall, 24 * U), theme.labelEm * 1.2));
  const label = fits.reduce((a, b) => (b.size < a.size ? b : a));
  return (
    <AbsoluteFill>
      <Backdrop />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {title ? <MaskUp s={title} x={W / 2} y={SAFE.t + 110 * U} st={{ family: theme.font.display, size: fitSize(title, 96 * U, textWidth(), theme.displayEm), weight: theme.displayWeight, color: theme.color.text, anchor: 'middle' }} p={prog(t, 0.05, theme.motion.rise, E.out4)} /> : null}
        {pts.slice(0, -1).map((p, i) => {
          const done = clamp(reached - i);
          if (done <= 0) return null;
          const q = pts[i + 1];
          return <line key={i} x1={p[0]} y1={p[1]} x2={p[0] + (q[0] - p[0]) * done} y2={p[1] + (q[1] - p[1]) * done} stroke={theme.color.text} strokeOpacity={0.55} strokeWidth={4 * U} strokeDasharray={`${14 * U} ${12 * U}`} strokeLinecap="round" />;
        })}
        {pts.map((p, i) => {
          // A stop is fully up when the line reaches it, so the last one is too; the first, where the line starts, comes up with the card.
          const show = i === 0 ? prog(t, 0.1, 0.3, E.out3) : prog(reached, i - 0.25, 0.25, E.out3);
          if (show <= 0) return null;
          const below = tall || i % 2 === 1;
          return (
            <g key={i} opacity={show}>
              <circle cx={p[0]} cy={p[1]} r={(9 + 5 * show) * U} fill={theme.color.accent} />
              <Txt s={names[i]} x={tall ? p[0] + 34 * U : p[0]} y={tall ? p[1] + 11 * U : p[1] + (below ? 62 : -34) * U} st={{ family: theme.font.label, size: label.size, weight: 600, ls: label.ls, color: theme.color.text, anchor: tall ? 'start' : 'middle' }} />
            </g>
          );
        })}
        {travel > 0 && travel < 1 ? <circle cx={hx} cy={hy} r={7 * U} fill={theme.color.text} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

/** The stops of a trip on a line that draws itself, as a full-frame card. The names are the user's; nothing here knows geography. */
export function route(o: RouteOptions): Layer[] {
  if (o.stops.length < 2 || o.stops.length > 6) throw new Error(`route: give 2 to 6 stops (got ${o.stops.length})`);
  const text = [...(o.title ? [o.title] : []), ...o.stops];
  return [el({ a: o.a, d: o.d, tag: 'text', text, stills: [o.a + 0.85 * o.d], node: <Route d={o.d} stops={o.stops} title={o.title} /> })];
}
