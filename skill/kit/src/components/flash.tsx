import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { E, clamp } from '../ease';
import { FPS } from '../grid';
import { el } from '../layers';
import type { Layer } from '../types';

export type FlashOptions = { t: number; d?: number; peak?: number; color?: string };

const Flash: React.FC<{ d: number; peak: number; color: string }> = ({ d, peak, color }) => {
  const p = clamp(useCurrentFrame() / FPS / d);
  return <AbsoluteFill style={{ backgroundColor: color, opacity: peak * (1 - E.out2(p)) }} />;
};

/** A short flash of light over the whole frame, for a musical drop. Put it last in `layers`, so it draws on top. */
export function flash(o: FlashOptions): Layer[] {
  const d = o.d ?? 0.35;
  return [el({ a: o.t, d, node: <Flash d={d} peak={o.peak ?? 0.7} color={o.color ?? '#ffffff'} /> })];
}
