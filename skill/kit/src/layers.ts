import type { ElLayer, Layer, PhotoLayer, SfxLayer, ShotLayer } from './types';

export const shot = (o: Omit<ShotLayer, 'kind'>): ShotLayer => ({ kind: 'shot', ...o });
export const photo = (o: Omit<PhotoLayer, 'kind'>): PhotoLayer => ({ kind: 'photo', ...o });
export const el = (o: Omit<ElLayer, 'kind'>): ElLayer => ({ kind: 'el', ...o });
/** A sound effect at a moment. Its nominal length only places it in a section; the sound rings for as long as its file. */
export const sfx = (o: { t: number; name: string; gain?: number }): SfxLayer => ({ kind: 'sfx', a: o.t, d: 0.1, name: o.name, gain: o.gain });

/** Timeline ranges [start, end] in seconds of every shot that carries speech, merged where they touch. */
export function speechRanges(layers: Layer[]): [number, number][] {
  const ranges = layers
    .filter((l): l is ShotLayer => l.kind === 'shot' && l.audio === 'speech')
    .map((l) => [l.a, l.a + l.d] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of ranges) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
