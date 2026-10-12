import React from 'react';
import { useCurrentFrame } from 'remotion';
import { E, clamp, prog } from '../ease';
import { Txt } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import type { Layer } from '../types';
import { fitSize } from './titleCard';

export type WordPopOptions = { a: number; d: number; text: string; x?: number; y?: number; size?: number; rotate?: number; color?: string };

/** The scale of a popped word t seconds after it starts: from 0.6 up past its size and back, settled from 0.3 s on. */
export function popScale(t: number): number {
  if (t >= 0.3) return 1;
  const p = clamp(t / 0.3);
  const c = 2.2; // how far it overshoots: at most about 6% past its size
  return 0.6 + 0.4 * (1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2);
}

const WordPop: React.FC<Required<Pick<WordPopOptions, 'd' | 'text' | 'x' | 'y' | 'size' | 'rotate' | 'color'>>> = ({ d, text, x, y, size, rotate, color }) => {
  const t = useCurrentFrame() / FPS;
  const alpha = clamp(t / 0.08) * (1 - prog(t, d - 0.2, 0.2, E.in2));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, opacity: alpha }}>
      <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${popScale(t)})`}>
        {/* The outline in the backdrop colour keeps the word readable over any picture */}
        <g stroke={theme.color.bg} strokeWidth={size * 0.09} strokeLinejoin="round" paintOrder="stroke">
          <Txt s={text} x={0} y={size * 0.34} st={{ family: theme.font.display, size, weight: theme.displayWeight, color, anchor: 'middle' }} />
        </g>
      </g>
    </svg>
  );
};

/** A big word that pops in on the beat, over the picture: a toast, a count, a cheer. The words are the user's or the footage's. */
export function wordPop(o: WordPopOptions): Layer[] {
  const width = (0.9 * (W - SAFE.l - SAFE.r)) / 1.1; // room for the overshoot
  const size = o.size ?? fitSize(o.text, 260 * U, width, theme.displayEm);
  return [el({ a: o.a, d: o.d, tag: 'text', text: [o.text], stills: [o.a + Math.min(0.5, o.d / 2)], node: <WordPop d={o.d} text={o.text} x={o.x ?? W / 2} y={o.y ?? H / 2} size={size} rotate={o.rotate ?? -4} color={o.color ?? theme.color.accent} /> })];
}
