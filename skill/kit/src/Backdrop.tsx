import React from 'react';
import { AbsoluteFill } from 'remotion';
import { H, W } from './grid';
import { theme } from './theme';

/** The themed background: the theme colour with a soft glow centred at (gx, gy), both 0..1. It sits under every section, so a gap in the edit never shows black. */
export const Backdrop: React.FC<{ gx?: number; gy?: number }> = ({ gx = 0.5, gy = 0.45 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(circle ${0.75 * Math.max(W, H)}px at ${gx * 100}% ${gy * 100}%, ${theme.color.glow}, transparent), ${theme.color.bg}` }} />
);
