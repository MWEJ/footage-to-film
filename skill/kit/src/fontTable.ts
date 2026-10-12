import data from './fonts.json';

/** What the kit knows about a font family. Widths are in ems: multiply by the font size and the number of characters for a line's width. */
export type FontInfo = { em: number; caps: number; italic: boolean; weight: number };

/** Every family the kit can load. `npm run fonts` measures a family that fonts.ts loads and this table lacks. */
export const FONTS = data as unknown as Record<string, FontInfo>;

/** The weight to draw at when `want` is asked of a family that has only `have`: the nearest; the lighter one on a tie. */
export function weightFor(have: number[], want: number): number {
  if (have.length === 0) return want;
  return [...have].sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b)[0];
}
