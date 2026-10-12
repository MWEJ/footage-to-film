import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, prog } from '../ease';
import { MaskUp } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import type { Layer } from '../types';
import { fitLabel, fitSize } from './titleCard';

export type ChapterTagOptions = { a: number; d: number; text: string; sub?: string; corner?: 'tl' | 'tr' };

const ChapterTag: React.FC<ChapterTagOptions> = ({ d, text, sub, corner = 'tl' }) => {
  const t = useCurrentFrame() / FPS;
  const left = corner === 'tl';
  const x = left ? SAFE.l : W - SAFE.r;
  const y = SAFE.t + 50 * U; // baseline of the label; the accent bar above it starts just inside the safe area
  const anchor = left ? 'start' : 'end';
  const width = (W - SAFE.l - SAFE.r) * 0.7;
  const label = fitLabel(text.toUpperCase(), 30 * U, 8 * U, width, theme.labelEm);
  const rise = theme.motion.rise;
  const show = prog(t, 0, rise, E.out4);
  const hide = 1 - prog(t, d - theme.motion.fade, theme.motion.fade, E.in2);
  const bar = 44 * U * show;
  return (
    <AbsoluteFill style={{ opacity: hide }}>
      {/* A soft band at the top keeps the text readable over any picture. */}
      <AbsoluteFill style={{ opacity: show, background: `linear-gradient(to bottom, ${theme.color.scrim}, transparent ${Math.round(((SAFE.t + 166 * U) / H) * 100)}%)` }} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <rect x={left ? x : x - bar} y={y - 46 * U} width={bar} height={4 * U} fill={theme.color.accent} />
        <MaskUp s={text.toUpperCase()} x={x} y={y} st={{ family: theme.font.label, size: label.size, weight: 600, ls: label.ls, color: theme.color.text, anchor }} p={show} />
        {sub ? <MaskUp s={sub} x={x} y={y + 50 * U} st={{ family: theme.font.display, size: fitSize(sub, 42 * U, width, theme.displayEm), weight: theme.displayWeight, color: theme.color.text, alpha: 0.92, anchor }} p={prog(t, 0.12, rise, E.out4)} /> : null}
      </svg>
    </AbsoluteFill>
  );
};

/** A small heading in a top corner, over the picture: a day, a place, a chapter. */
export function chapterTag(o: ChapterTagOptions): Layer[] {
  return [el({ a: o.a, d: o.d, tag: 'text', text: o.sub ? [o.text, o.sub] : [o.text], node: <ChapterTag {...o} /> })];
}
