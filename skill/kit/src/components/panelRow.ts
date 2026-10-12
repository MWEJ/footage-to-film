import { cols, rows } from '../crop';
import { FORMAT, H, U, W } from '../grid';
import { photo, shot } from '../layers';
import { theme } from '../theme';
import type { Exit, Focus, Layer, Rect, Reveal, ShotLayer } from '../types';

type Framing = { focus?: Focus; zoomTo?: number | Focus };
export type Panel = (Framing & { clip: string; in: number; speed?: number; audio?: ShotLayer['audio']; gain?: number }) | (Framing & { photo: string });
export type PanelRowOptions = { a: number; d: number; panels: Panel[]; weights?: number[]; area?: Rect; direction?: 'columns' | 'rows'; stagger?: number; reveal?: Reveal; exit?: Exit };

/**
 * Clips and photos side by side in a wide or square frame, stacked in a tall one: how vertical footage sits in a wide film.
 * Panels arrive `stagger` seconds apart and end together.
 */
export function panelRow(o: PanelRowOptions): Layer[] {
  if (o.panels.length === 0) throw new Error('panelRow: panels is empty');
  const weights = o.weights ?? o.panels.map(() => 1);
  if (weights.length !== o.panels.length) throw new Error(`panelRow: ${o.panels.length} panels but ${weights.length} weights`);
  const direction = o.direction ?? (FORMAT === 'tall' ? 'rows' : 'columns');
  const rects = (direction === 'rows' ? rows : cols)(weights, theme.gutter * U, o.area ?? [0, 0, W, H]);
  const stagger = o.stagger ?? theme.motion.stagger;
  return o.panels.map((p, i) => {
    const media = {
      a: o.a + stagger * i,
      d: o.d - stagger * i,
      rect: rects[i],
      focus: p.focus,
      zoomTo: p.zoomTo,
      reveal: o.reveal ?? ('up' as Reveal),
      exit: o.exit,
      radius: theme.radius * U,
      free: stagger * i > 0, // a staggered panel starts just after the beat, on purpose
    };
    return 'photo' in p ? photo({ ...media, name: p.photo }) : shot({ ...media, clip: p.clip, in: p.in, speed: p.speed, audio: p.audio, gain: p.gain });
  });
}
