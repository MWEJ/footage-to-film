import { clamp } from './ease';

/** The four parts a song is split into. They sum to the song. */
export type Stem = 'vocals' | 'drums' | 'bass' | 'other';
export const STEMS: Stem[] = ['vocals', 'drums', 'bass', 'other'];

/** How much of the song a section plays: all of it, all but the singing, a bed (no drums, no singing, the bass held back), or nothing. */
export type MusicMode = 'full' | 'no-vocals' | 'bed' | 'off';
/** A section's place on the timeline (seconds) and its mode. */
export type Part = { a: number; b: number; mode: MusicMode };

// 'all' is the song as one file, for a film without stems: it can only play or be silent.
const LEVEL: Record<MusicMode, Record<Stem | 'all', number>> = {
  full: { all: 1, vocals: 1, drums: 1, bass: 1, other: 1 },
  'no-vocals': { all: 1, vocals: 0, drums: 1, bass: 1, other: 1 },
  bed: { all: 1, vocals: 0, drums: 0, bass: 0.7, other: 1 },
  off: { all: 0, vocals: 0, drums: 0, bass: 0, other: 0 },
};

/**
 * The level of a stem at time t, from the sections' modes. Going down, it glides over the last `glide` seconds of the
 * section before; going up, it steps in on the bar line, so the downbeat lands whole.
 */
export function modeLevel(stem: Stem | 'all', t: number, parts: Part[], glide = 0.25): number {
  const i = parts.findIndex((p) => t >= p.a && t < p.b);
  if (i < 0) return 1;
  const now = LEVEL[parts[i].mode][stem];
  const next = parts[i + 1];
  if (!next || Math.abs(next.a - parts[i].b) > 1e-6) return now;
  const then = LEVEL[next.mode][stem];
  if (then >= now) return now;
  return then + (now - then) * clamp((parts[i].b - t) / glide);
}

/** The level of the singing around speech: gone from `lead` seconds before a spoken range until it ends, fading over `fade` seconds on both sides. */
export function vocalGate(t: number, speech: [number, number][], lead = 0.1, fade = 0.3): number {
  let gate = 1;
  for (const [a, b] of speech) {
    let open: number;
    if (t >= a - lead && t <= b) open = 0;
    else if (t < a - lead) open = clamp((a - lead - t) / fade);
    else open = clamp((t - b) / fade);
    gate = Math.min(gate, open);
  }
  return gate;
}
