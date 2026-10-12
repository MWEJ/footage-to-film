// Measures how wide each font family runs, in the browser, for `npm run fonts`. Not part of any film.
import React from 'react';
import { FAMILIES, loadFamily, weightsOf } from './fonts';
import { FONTS, weightFor } from './fontTable';

/** Mixed-case words of the kind a family film's titles are made of, with Danish letters. */
export const SAMPLE = "Sommer i Skagen and Maya's Graduation, Søndag på Ærø 2026";
export type Measured = Record<string, { em: number; caps: number; italic: boolean; weight: number }>;

/** Measures the families named (all of them when the list is empty). Widths are padded by 3% and rounded up to two places, so a fitted line errs towards smaller. */
export async function measureFonts(only: string[]): Promise<Measured> {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const pad = (v: number): number => Math.ceil(v * 1.03 * 100) / 100;
  const families = Object.entries(FAMILIES).filter(([family]) => only.length === 0 || only.includes(family));
  // Every family's weights: the one it is drawn at, and the one its capitals are measured at.
  const plan = families.map(([family, m]) => {
    const have = weightsOf(m, 'normal');
    return { family, m, weight: weightFor(have, FONTS[family]?.weight ?? 400), capsWeight: weightFor(have, 500) };
  });
  // All downloads at once: one family after another can take longer than the browser is given to answer.
  await Promise.all(plan.flatMap((p) => loadFamily(p.family, [p.weight, p.capsWeight]).map((l) => l.waitUntilDone())));
  const width = (text: string, w: number, family: string): number => {
    ctx.font = `${w} 200px "${family}", monospace`;
    return ctx.measureText(text).width / (200 * text.length);
  };
  const result: Measured = {};
  for (const { family, m, weight, capsWeight } of plan) {
    // A family that did not load is measured in the fallback face; that number must not reach fonts.json.
    ctx.font = '200px monospace';
    const fallback = ctx.measureText(SAMPLE).width / (200 * SAMPLE.length);
    const em = width(SAMPLE, weight, family);
    if (Math.abs(em - fallback) < 1e-6) throw new Error(`${family} did not load: its width is the fallback face's`);
    result[family] = { em: pad(em), caps: pad(width(SAMPLE.toUpperCase(), capsWeight, family)), italic: weightsOf(m, 'italic').length > 0, weight };
  }
  return result;
}

/** The probe draws nothing: its result is in the props that calculateMetadata gives it. */
export const Probe: React.FC<{ fonts: Measured }> = () => null;
