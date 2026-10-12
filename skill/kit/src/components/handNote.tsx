import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, prog } from '../ease';
import { Txt } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { theme } from '../theme';
import type { Layer } from '../types';

export type HandNoteOptions = { a: number; d: number; text: string; x: number; y: number; size?: number; rotate?: number; underline?: boolean; color?: string };

const HandNote: React.FC<HandNoteOptions> = ({ d, text, x, y, size = 64 * U, rotate = -6, underline = true, color = theme.color.accent }) => {
  const t = useCurrentFrame() / FPS;
  const written = prog(t, 0, 0.45, E.out2); // the text appears from left to right, as if written
  const stroke = prog(t, 0.35, 0.3, E.out3);
  const hide = 1 - prog(t, d - theme.motion.fade, theme.motion.fade, E.in2);
  const width = text.length * size * theme.handEm; // an estimate of the text's width, for the reveal and the underline
  const shown = (width + size) * written;
  return (
    <AbsoluteFill style={{ opacity: hide }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
          {shown > 0 ? (
            <svg x={-size * 0.2} y={-size * 1.2} width={shown} height={size * 1.9} viewBox={`${-size * 0.2} ${-size * 1.2} ${shown} ${size * 1.9}`} overflow="hidden">
              <Txt s={text} x={0} y={0} st={{ family: theme.font.hand, size, weight: theme.handWeight, color }} />
            </svg>
          ) : null}
          {underline && stroke > 0 ? (
            <path d={`M 0 ${size * 0.3} Q ${width * 0.5} ${size * 0.46} ${width} ${size * 0.22}`} fill="none" stroke={color} strokeWidth={size * 0.06} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - stroke} />
          ) : null}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** A handwritten aside that writes itself in, with a stroke under it. x and y are where its baseline starts. Use sparingly. */
export function handNote(o: HandNoteOptions): Layer[] {
  return [el({ a: o.a, d: o.d, tag: 'text', text: [o.text], node: <HandNote {...o} /> })];
}
