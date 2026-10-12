import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../Backdrop';
import { E, clamp, prog } from '../ease';
import { MaskUp } from '../gfx';
import { FPS, H, U, W } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import type { Layer } from '../types';
import { fitLabel, fitSize, textWidth } from './titleCard';

export type EndCardOptions = { a: number; d: number; lines: string[]; note?: string };

const EndCard: React.FC<EndCardOptions> = ({ d, lines, note }) => {
  const t = useCurrentFrame() / FPS;
  const cx = W / 2;
  const [head, ...rest] = lines;
  const grow = 0.02; // a slow push, so the card is never a frozen frame
  const width = (W - SAFE.l - SAFE.r) / (1 + grow); // lines fit the safe width even at the end of the push
  const size = fitSize(head, 150 * U, textWidth(), theme.displayEm);
  const noteSize = note ? fitSize(note, 84 * U, width, theme.handEm) : 0;
  const step = 58 * U;
  const y0 = H / 2 - (rest.length * step) / 2 - (note ? 40 * U : 0); // baseline of the first line; the block stays centred
  const noteY = y0 + rest.length * step + 130 * U;
  const push = 1 + grow * clamp(t / d);
  const rise = theme.motion.rise;
  return (
    <AbsoluteFill>
      <Backdrop gy={0.5} />
      {/* Positioned, so it paints above the Backdrop (an absolutely positioned sibling paints over a static one) */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <g transform={`translate(${cx} ${H / 2}) scale(${push}) translate(${-cx} ${-H / 2})`}>
          <MaskUp s={head} x={cx} y={y0} st={{ family: theme.font.display, size, weight: theme.displayWeight, italic: theme.displayItalic, color: theme.color.text, anchor: 'middle' }} p={prog(t, 0.05, rise, E.out4)} />
          {rest.map((s, i) => {
            const fit = fitLabel(s.toUpperCase(), 28 * U, 7 * U, width, theme.labelEm);
            return <MaskUp key={i} s={s.toUpperCase()} x={cx} y={y0 + (i + 1) * step + 14 * U} st={{ family: theme.font.label, size: fit.size, weight: 500, ls: fit.ls, color: theme.color.text, alpha: 0.9, anchor: 'middle' }} p={prog(t, 0.2 + 0.1 * i, rise, E.out4)} />;
          })}
          {note ? (
            <g transform={`rotate(-4 ${cx} ${noteY})`}>
              {/* below: the handwriting face's descenders reach further than the default mask allows (the y of "you" was cut) */}
              <MaskUp s={note} x={cx} y={noteY} st={{ family: theme.font.hand, size: noteSize, weight: theme.handWeight, color: theme.color.accent, anchor: 'middle' }} p={prog(t, 0.45, rise, E.out4)} below={0.6} />
            </g>
          ) : null}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** The closing card on the themed backdrop: a first line in the display face, more lines in small capitals, and an optional handwritten note. */
export function endCard(o: EndCardOptions): Layer[] {
  if (o.lines.length === 0) throw new Error('endCard: lines is empty');
  return [el({ a: o.a, d: o.d, tag: 'text', text: o.note ? [...o.lines, o.note] : o.lines, node: <EndCard {...o} /> })];
}
