import data from './sources.json';
import type { ShotLayer } from './types';

/** P: portrait, 1080 wide. F: portrait at full resolution, for full-frame crops. L: landscape. */
export type Tier = 'P' | 'F' | 'L';
/** One converted file. a and b are seconds in the original clip, handles included. */
export type ClipFile = { file: string; tier: Tier; a: number; b: number; fps: number; w: number; h: number; audio: boolean };
export type PhotoFile = { file: string; w: number; h: number };
export type Sources = { clips: Record<string, ClipFile[]>; photos: Record<string, PhotoFile> };

/** The film's converted files. sources.json is written by the skill's convert step. */
export const SOURCES = data as unknown as Sources;

/** The converted file that covers a shot. `full` prefers the full-resolution tier, for portrait clips cropped to fill the frame. */
export function pickFile(clips: Sources['clips'], clip: string, inPoint: number, d: number, speed: number, full: boolean): ClipFile {
  const files = clips[clip];
  if (!files) throw new Error(`unknown clip ${clip} (have: ${Object.keys(clips).join(', ')})`);
  const end = inPoint + d * speed;
  const order: Tier[] = full ? ['F', 'L', 'P'] : ['P', 'L', 'F'];
  for (const tier of order) {
    const hit = files.find((f) => f.tier === tier && f.a <= inPoint + 1e-6 && f.b >= end - 0.05);
    if (hit) return hit;
  }
  const have = files.map((f) => `${f.tier} ${f.a}-${f.b}`).join(', ');
  throw new Error(`no converted file covers clip ${clip} from ${inPoint.toFixed(2)} to ${end.toFixed(2)} s (have: ${have})`);
}

export const fileFor = (l: ShotLayer): ClipFile => pickFile(SOURCES.clips, l.clip, l.in, l.d, l.speed ?? 1, l.full ?? false);

export function photoFor(photos: Sources['photos'], name: string): PhotoFile {
  const p = photos[name];
  if (!p) throw new Error(`unknown photo ${name} (have: ${Object.keys(photos).join(', ')})`);
  return p;
}
