import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, prog } from '../ease';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { theme } from '../theme';
import type { Layer } from '../types';

export type ConfettiShape = 'paper' | 'petal' | 'snow' | 'heart' | 'star';
export type ConfettiOptions = { a: number; d: number; count?: number; seed?: number; shape?: ConfettiShape; rise?: boolean; colors?: string[] };

/** A repeatable number from 0 to 1 for an index: the same in every render, unlike Math.random. */
export const rnd = (i: number, seed = 1): number => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** One piece, centred on 0,0 and about `w` wide. */
const piece = (shape: ConfettiShape, w: number, fill: string): React.ReactNode => {
  if (shape === 'petal') return <ellipse rx={w * 0.5} ry={w * 0.28} fill={fill} />;
  if (shape === 'snow') return <circle r={w * 0.3} fill={fill} />;
  if (shape === 'heart') {
    const s = w / 20;
    return <path transform={`scale(${s}) translate(-10 -9)`} d="M10 17 C2 11 0 7 0 4.5 C0 2 2 0 4.5 0 C6.5 0 8.5 1 10 3 C11.5 1 13.5 0 15.5 0 C18 0 20 2 20 4.5 C20 7 18 11 10 17 Z" fill={fill} />;
  }
  if (shape === 'star') {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const r = (k % 2 === 0 ? 0.5 : 0.21) * w;
      const ang = (Math.PI / 5) * k - Math.PI / 2;
      return `${(r * Math.cos(ang)).toFixed(2)},${(r * Math.sin(ang)).toFixed(2)}`;
    });
    return <polygon points={pts.join(' ')} fill={fill} />;
  }
  return <rect x={-w / 2} y={-w * 0.22} width={w} height={w * 0.44} fill={fill} />;
};

const Confetti: React.FC<{ d: number; count: number; seed: number; shape: ConfettiShape; rise: boolean; colors: string[] }> = ({ d, count, seed, shape, rise, colors }) => {
  const t = useCurrentFrame() / FPS;
  const fade = 1 - prog(t, d - 0.5, 0.5, E.in2);
  // Petals and snow drift down slower than paper and turn less; snow does not turn at all. Hearts sway and stay upright, so they read as hearts.
  const soft = shape === 'petal' || shape === 'snow';
  const pace = soft ? 0.55 : 1;
  const spin = shape === 'snow' ? 0 : soft ? 1 / 3 : 1;
  const sway = shape === 'heart';
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {Array.from({ length: count }, (_, i) => {
          const tt = Math.max(0, t - rnd(i, seed) * 0.6); // pieces start moving over the first 0.6 s
          const w = (10 + rnd(i + 0.4, seed) * 12) * U;
          const x = rnd(i + 0.3, seed) * W + Math.sin(tt * (2 + rnd(i + 0.7, seed) * 3)) * 40 * U;
          const speed = (0.35 + rnd(i + 0.1, seed) * 0.4) * pace; // frame heights per second
          const y = rise ? H + 30 * U - tt * speed * H : -30 * U + tt * speed * H;
          const turn = sway
            ? 25 * Math.sin(tt * (1.5 + rnd(i + 0.9, seed) * 1.5) + rnd(i + 0.2, seed) * 2 * Math.PI)
            : tt * (180 + rnd(i + 0.9, seed) * 360) * (rnd(i + 0.2, seed) > 0.5 ? 1 : -1) * spin;
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${turn})`}>
              {piece(shape, w, colors[i % colors.length])}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Pieces falling over the frame for a celebration, the same way in every render: paper, petals, snow, hearts or stars.
 * rise: true sends them up from below. colors defaults to the theme's party colours (snow: white, in every theme).
 */
export function confetti(o: ConfettiOptions): Layer[] {
  const shape = o.shape ?? 'paper';
  const colors = o.colors ?? (shape === 'snow' ? ['#FFFFFF'] : theme.color.party);
  return [el({ a: o.a, d: o.d, node: <Confetti d={o.d} count={o.count ?? 90} seed={o.seed ?? 1} shape={shape} rise={o.rise ?? false} colors={colors} /> })];
}
