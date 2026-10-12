import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../Backdrop';
import { E, clamp, prog } from '../ease';
import { CharsUp, MaskUp } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import type { Layer } from '../types';

export type TitleCardOptions = { a: number; d: number; title: string; kicker?: string; sub?: string; foot?: string };

/** The largest size, up to max, at which a line fits the width, for a face whose average glyph is `em` wide. An estimate: check the still. */
export const fitSize = (text: string, max: number, width: number, em = 0.46): number => Math.min(max, width / (Math.max(1, text.length) * em));

/**
 * A line of spaced capitals in the label face, shrunk with its letter-spacing until it fits the width.
 * `em` is the average width of the face's capitals (theme.labelEm). An estimate: check the still.
 */
export function fitLabel(text: string, size: number, ls: number, width: number, em = 0.62): { size: number; ls: number } {
  const natural = Math.max(1, text.length) * (em * size + ls);
  const k = Math.min(1, width / natural);
  return { size: size * k, ls: ls * k };
}

/** The width a line of text may take: the safe width, and no more than 80% of the frame's width (the measure of a wide film's titles). */
export const textWidth = (): number => Math.min(0.8 * W, W - SAFE.l - SAFE.r);

const TitleCard: React.FC<TitleCardOptions> = ({ d, title, kicker, sub, foot }) => {
  const t = useCurrentFrame() / FPS;
  const cx = W / 2;
  const grow = 0.03; // a slow push for as long as the card is up, so it is never a frozen frame
  const width = (W - SAFE.l - SAFE.r) / (1 + grow); // labels fit the safe width even at the end of the push
  const size = fitSize(title, 300 * U, textWidth(), theme.displayEm);
  const k = kicker ? fitLabel(kicker.toUpperCase(), 26 * U, 12 * U, width, theme.labelEm) : null;
  const s2 = sub ? fitLabel(sub.toUpperCase(), 38 * U, 14 * U, width, theme.labelEm) : null;
  const f = foot ? fitLabel(foot.toUpperCase(), 24 * U, 7 * U, width, theme.labelEm) : null;
  const base = H * 0.57; // baseline of the title
  const push = 1 + grow * clamp(t / d);
  const rise = theme.motion.rise;
  const rule = 72 * U * prog(t, 0.35, rise, E.out4);
  return (
    <AbsoluteFill>
      <Backdrop />
      {/* Positioned, so it paints above the Backdrop (an absolutely positioned sibling paints over a static one) */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g transform={`translate(${cx} ${H / 2}) scale(${push}) translate(${-cx} ${-H / 2})`}>
          {kicker && k ? (
            <MaskUp s={kicker.toUpperCase()} x={cx} y={base - size * 0.93} st={{ family: theme.font.label, size: k.size, weight: 600, ls: k.ls, color: theme.color.accent, anchor: 'middle' }} p={prog(t, 0.05, rise, E.out4)} />
          ) : null}
          <CharsUp s={title} x={cx} y={base} st={{ family: theme.font.display, size, weight: theme.displayWeight, color: theme.color.text, anchor: 'middle' }} t={t} stag={0.035} each={0.45} dist={0.4} />
          {sub && s2 ? (
            <MaskUp s={sub.toUpperCase()} x={cx} y={base + 88 * U} st={{ family: theme.font.label, size: s2.size, weight: 500, ls: s2.ls, color: theme.color.text, anchor: 'middle' }} p={prog(t, 0.2, rise, E.out4)} />
          ) : null}
          <rect x={cx - rule} y={base + (sub ? 124 : 60) * U} width={rule * 2} height={2 * U} fill={theme.color.text} fillOpacity={0.45} />
          {foot && f ? (
            <MaskUp s={foot.toUpperCase()} x={cx} y={base + (sub ? 190 : 126) * U} st={{ family: theme.font.label, size: f.size, weight: 400, ls: f.ls, color: theme.color.text, alpha: 0.85, anchor: 'middle' }} p={prog(t, 0.3, rise, E.out4)} />
          ) : null}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** A full-frame title on the themed backdrop: a small line above, the title, a line below, a rule and a foot line. */
export function titleCard(o: TitleCardOptions): Layer[] {
  const text = [o.kicker, o.title, o.sub, o.foot].filter((s): s is string => Boolean(s));
  return [el({ a: o.a, d: o.d, tag: 'text', text, node: <TitleCard {...o} /> })];
}
