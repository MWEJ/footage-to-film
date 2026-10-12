import data from './speech.json';
import type { ShotLayer } from './types';

type Spoken = Pick<ShotLayer, 'clip' | 'in' | 'd' | 'speed' | 'clean'>;

/** How a spoken shot is known: its clip, in-point and length. A cleaned file is cut for exactly these. */
export const speechKey = (l: Spoken): string => `${l.clip}@${l.in.toFixed(3)}+${l.d.toFixed(3)}`;

/**
 * The cleaned file for a shot, or null. A shot that was moved or trimmed since the file was made does not match, and falls
 * back to its clip's own sound. So does a shot with clean: false, at once, before npm run speech has been run again.
 */
export function speechFileIn(map: Record<string, string>, l: Spoken): string | null {
  if ((l.speed ?? 1) !== 1 || l.clean === false) return null;
  return map[speechKey(l)] ?? null;
}

/** The cleaned files of this film, written by `npm run speech`. */
export const SPEECH = data as unknown as Record<string, string>;
export const speechFileFor = (l: Spoken): string | null => speechFileIn(SPEECH, l);
