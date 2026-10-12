import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, prog } from '../ease';
import { MaskUp } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import type { Layer } from '../types';
import { fitLabel, fitSize } from './titleCard';

export type LowerThirdOptions = { a: number; d: number; title: string; sub?: string; side?: 'left' | 'right' };

const LowerThird: React.FC<LowerThirdOptions> = ({ d, title, sub, side = 'left' }) => {
  const t = useCurrentFrame() / FPS;
  const left = side === 'left';
  const edge = left ? SAFE.l : W - SAFE.r; // outer edge of the accent bar
  const tx = left ? edge + 26 * U : edge - 26 * U;
  const anchor = left ? 'start' : 'end';
  const width = W - SAFE.l - SAFE.r - 26 * U; // from the text's edge to the far side of the safe area
  const size = fitSize(title, 72 * U, width, theme.displayEm);
  const s2 = sub ? fitLabel(sub.toUpperCase(), 26 * U, 5 * U, width, theme.labelEm) : null;
  const ySub = H - SAFE.b; // baseline of the lowest line
  const yTitle = sub ? ySub - 52 * U : ySub;
  const barH = (sub ? 122 : 74) * U;
  const rise = theme.motion.rise;
  const show = prog(t, 0, rise, E.out4);
  const hide = 1 - prog(t, d - theme.motion.fade, theme.motion.fade, E.in2);
  return (
    <AbsoluteFill style={{ opacity: hide }}>
      {/* A soft dark band at the bottom keeps the text readable over any picture. */}
      <AbsoluteFill style={{ opacity: show, background: `linear-gradient(to top, ${theme.color.scrim}, transparent 34%)` }} />
      {/* Positioned, so it paints above the band (an absolutely positioned sibling paints over a static one) */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <rect x={left ? edge : edge - 5 * U} y={ySub + 10 * U - barH * show} width={5 * U} height={barH * show} fill={theme.color.accent} />
        <MaskUp s={title} x={tx} y={yTitle} st={{ family: theme.font.display, size, weight: theme.displayWeight, color: theme.color.text, anchor }} p={prog(t, 0.05, rise, E.out4)} />
        {sub && s2 ? <MaskUp s={sub.toUpperCase()} x={tx} y={ySub} st={{ family: theme.font.label, size: s2.size, weight: 600, ls: s2.ls, color: theme.color.accent, anchor }} p={prog(t, 0.18, rise, E.out4)} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

/** A name with an optional second line, low on one side of the frame, over the picture. */
export function lowerThird(o: LowerThirdOptions): Layer[] {
  return [el({ a: o.a, d: o.d, tag: 'text', text: o.sub ? [o.title, o.sub] : [o.title], node: <LowerThird {...o} /> })];
}
