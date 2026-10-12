import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { E, clamp } from '../ease';
import { H, U, W } from '../grid';
import { el } from '../layers';
import { theme } from '../theme';
import type { Layer } from '../types';

export type WipeOptions = { at: number; d?: number };

/** The fraction of the frame each of the two panels covers at progress p: nothing at 0, half each (the whole frame) at 1. */
export const wipeCover = (p: number): number => 0.5 * E.io2(clamp(p));

/** Two panels in the backdrop colour, from the sides in a wide or square frame, from top and bottom in a tall one. */
const Wipe: React.FC<{ closing: boolean }> = ({ closing }) => {
  const frame = useCurrentFrame();
  // The layer's own length in frames, after its start and end were rounded to whole frames. Progress is counted in these frames,
  // so a closing wipe is shut on its last frame and an opening one on its first, wherever the rounding put them.
  const { durationInFrames: n } = useVideoConfig();
  const p = closing ? clamp((frame + 1) / n) : 1 - clamp(frame / n);
  const cover = wipeCover(p);
  if (cover <= 0) return null;
  const tall = H > W;
  const size = Math.ceil((tall ? H : W) * cover) + 1; // one pixel of overlap, so no line shows between the panels when closed
  // The accent edge shows only while the panels move: shut, the frame is one plain colour.
  const edge = p < 1 ? `${4 * U}px solid ${theme.color.accent}` : 'none';
  const panel = (first: boolean): React.CSSProperties =>
    tall
      ? { position: 'absolute', boxSizing: 'border-box', left: 0, width: W, height: size, [first ? 'top' : 'bottom']: 0, background: theme.color.bg, [first ? 'borderBottom' : 'borderTop']: edge }
      : { position: 'absolute', boxSizing: 'border-box', top: 0, height: H, width: size, [first ? 'left' : 'right']: 0, background: theme.color.bg, [first ? 'borderRight' : 'borderLeft']: edge };
  return (
    <AbsoluteFill>
      <div style={panel(true)} />
      <div style={panel(false)} />
    </AbsoluteFill>
  );
};

/** Closes over the picture, fully closed at `at`. Put it last in the section that ends at `at`, so it draws on top. */
export function wipeOut(o: WipeOptions): Layer[] {
  const d = o.d ?? 0.45;
  return [el({ a: o.at - d, d, node: <Wipe closing /> })];
}

/** Starts closed at `at` and opens. Put it last in the section that starts at `at`. Use with wipeOut for a change of day or place. */
export function wipeIn(o: WipeOptions): Layer[] {
  const d = o.d ?? 0.45;
  return [el({ a: o.at, d, node: <Wipe closing={false} /> })];
}
