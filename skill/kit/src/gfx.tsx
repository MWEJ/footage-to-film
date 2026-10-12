// SVG text helpers. SVG is used because <text y> is the alphabetic baseline, as in canvas fillText,
// so coordinates from the canvas engine carry over unchanged. Use these inside an <svg> in frame pixels.
import React from 'react';
import { E, clamp } from './ease';
import { W } from './grid';

export type TextStyle = {
  family: string;
  size: number;
  weight?: number;
  italic?: boolean;
  ls?: number; // letter-spacing, px
  color: string;
  alpha?: number;
  anchor?: 'start' | 'middle' | 'end';
};

/** One line of text on a baseline. Letter-spacing adds space after the last glyph, so anchored text is shifted to stay optically aligned. */
export const Txt: React.FC<{ s: string; x: number; y: number; st: TextStyle; children?: React.ReactNode }> = ({ s, x, y, st, children }) => {
  const ls = st.ls ?? 0;
  const anchor = st.anchor ?? 'start';
  const xx = anchor === 'middle' ? x + ls / 2 : anchor === 'end' ? x + ls : x;
  return (
    <text
      x={xx}
      y={y}
      textAnchor={anchor}
      fontFamily={st.family}
      fontSize={st.size}
      fontWeight={st.weight ?? 400}
      fontStyle={st.italic ? 'italic' : 'normal'}
      letterSpacing={ls}
      fill={st.color}
      fillOpacity={st.alpha ?? 1}
      style={{ whiteSpace: 'pre' }}
    >
      {children ?? s}
    </text>
  );
};

/** Clips its children to a horizontal band across the frame. */
export const Band: React.FC<{ y: number; h: number; children: React.ReactNode }> = ({ y, h, children }) => (
  <svg x={-50} y={y} width={W + 100} height={h} viewBox={`-50 ${y} ${W + 100} ${h}`} overflow="hidden">
    {children}
  </svg>
);

/**
 * A line that rises from behind a mask. p is 0..1 and already eased.
 * The mask ends `below` font sizes under the baseline (0.37 by default); a face with deep descenders, such as a handwriting face, needs more.
 */
export const MaskUp: React.FC<{ s: string; x: number; y: number; st: TextStyle; p: number; below?: number }> = ({ s, x, y, st, p, below = 0.37 }) =>
  p <= 0 ? null : (
    <Band y={y - st.size * 1.05} h={st.size * (1.05 + below)}>
      <Txt s={s} x={x} y={y + (1 - p) * st.size * (0.88 + below)} st={st} />
    </Band>
  );

/** Segments on one baseline, each lowered by its own offset (px) and with its own opacity. tspan dy accumulates, so differences are emitted. */
export const Rise: React.FC<{ x: number; y: number; st: TextStyle; parts: { s: string; off: number; alpha: number }[] }> = ({ x, y, st, parts }) => {
  let prev = 0;
  return (
    <Txt s="" x={x} y={y} st={st}>
      {parts.map((pt, i) => {
        const dy = pt.off - prev;
        prev = pt.off;
        return (
          <tspan key={i} dy={dy} fillOpacity={pt.alpha}>
            {pt.s}
          </tspan>
        );
      })}
    </Txt>
  );
};

/** Characters that rise and fade in one after another. t is local seconds. */
export const CharsUp: React.FC<{ s: string; x: number; y: number; st: TextStyle; t: number; stag?: number; each?: number; dist?: number }> = ({ s, x, y, st, t, stag = 0.035, each = 0.5, dist = 0.6 }) => (
  <Rise
    x={x}
    y={y}
    st={st}
    parts={s.split('').map((ch, i) => {
      const p = E.out4(clamp((t - i * stag) / each));
      return { s: ch, off: (1 - p) * st.size * dist, alpha: (st.alpha ?? 1) * clamp(p * 1.6) };
    })}
  />
);
