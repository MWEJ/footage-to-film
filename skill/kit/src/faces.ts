import data from './faces.json';
import type { Focus } from './types';

/** A face: x, y, width, height as fractions of the upright picture, measured from its top-left corner. */
export type Face = [x: number, y: number, w: number, h: number];
/** What faces.swift found: per clip a sample each half second (t in seconds of the original clip), and the faces in each photo. Largest face first. */
export type Faces = { clips: Record<string, { t: number; f: Face[] }[]>; photos: Record<string, Face[]> };

export const FACES = data as unknown as Faces;

/** The faces in a clip at a time: those of the nearest sample within `within` seconds. null when no sample is that close. */
export function facesAt(faces: Faces, clip: string, t: number, within = 0.4): Face[] | null {
  let best: { t: number; f: Face[] } | null = null;
  for (const s of faces.clips[clip] ?? []) {
    if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  }
  return best && Math.abs(best.t - t) <= within ? best.f : null;
}

// The focus sits a little above the middle of the face, which leaves room over the head.
const onFace = (face: Face | undefined, zoom: number): Focus => (face ? [face[0] + face[2] / 2, face[1] + face[3] * 0.45, zoom] : [0.5, 0.5, zoom]);

export const focusOn = (faces: Faces, clip: string, t: number, zoom = 1): Focus => onFace(facesAt(faces, clip, t)?.[0], zoom);

/** A focus centred on the largest face in a clip at a time (seconds in the original clip). The centre of the picture when no face is known there. */
export const faceFocus = (clip: string, t: number, zoom = 1): Focus => focusOn(FACES, clip, t, zoom);

/** The same for a photo. */
export const photoFaceFocus = (name: string, zoom = 1): Focus => onFace(FACES.photos[name]?.[0], zoom);
