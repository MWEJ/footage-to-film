import { config } from '../film.config';
import { T } from './grid';
import { SECTIONS } from './sections';
import type { Layer } from './types';

/** One section of the film: its place on the timeline (seconds) and its layers. */
export type Section = { id: string; a: number; b: number; grid: 'beat' | 'free'; layers: Layer[] };

/** The whole edit as data. The film draws it; the scripts check and measure it. */
export const EDIT: Section[] = config.sections.map((s) => {
  const mod = SECTIONS[s.id];
  if (!mod || !Array.isArray(mod.layers)) {
    throw new Error(`film.config.ts lists section "${s.id}", but src/sections/index.ts has no module of that name that exports layers`);
  }
  return { id: s.id, a: T(s.bar), b: T(s.bar + s.bars), grid: s.grid ?? 'beat', layers: mod.layers };
});

export const ALL: Layer[] = EDIT.flatMap((s) => s.layers);
