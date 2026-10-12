import { focusAt, focusRange, region, type Region } from '../../src/crop';
import type { Section } from '../../src/edit';
import { facesAt, type Face, type Faces } from '../../src/faces';
import { pickFile, type Sources } from '../../src/sources';
import type { Finding } from './checks';

// A face counts as cut when the crop shows more than a sliver of it but not nearly all of it.
const CUT_FROM = 0.15;
const CUT_TO = 0.85;
/** A face at least this wide (as a fraction of the picture) is someone the shot is about; a smaller one is in the background. */
const PROMINENT = 0.1;

/**
 * How much of a face a region of the picture shows: 0 is none, 1 is all of it.
 * Measured against the part of the face inside the picture: Vision gives a face that the camera cut at the edge a box that runs past it.
 */
export function shown(face: Face, reg: Region): number {
  const w = Math.min(face[0] + face[2], reg.x + reg.w) - Math.max(face[0], reg.x);
  const h = Math.min(face[1] + face[3], reg.y + reg.h) - Math.max(face[1], reg.y);
  const inW = Math.min(face[0] + face[2], 1) - Math.max(face[0], 0);
  const inH = Math.min(face[1] + face[3], 1) - Math.max(face[1], 0);
  // At most 1: (x + w) - x is not always w in floating point, so a face wholly inside could come out at 1.0000000000000004.
  return w > 0 && h > 0 && inW > 0 && inH > 0 ? Math.min(1, (w * h) / (inW * inH)) : 0;
}

/** Shots and photos whose crop cuts through a face, looked at where each starts, halfway, and where it ends. One finding per layer, for its largest cut face. */
export function faceFindings(edit: Section[], sources: Sources, faces: Faces): Finding[] {
  const found: Finding[] = [];
  for (const s of edit) {
    for (const l of s.layers) {
      if (l.kind === 'el' || l.kind === 'sfx' || l.faceCheck === false || !(l.d > 0)) continue;
      let sar: number;
      let facesAtLocal: (local: number) => Face[] | null;
      if (l.kind === 'photo') {
        const p = sources.photos[l.name];
        if (!p) continue; // reported by the main check
        sar = p.w / p.h;
        facesAtLocal = () => faces.photos[l.name] ?? null;
      } else {
        const speed = l.speed ?? 1;
        try {
          const file = pickFile(sources.clips, l.clip, l.in, l.d, speed, l.full ?? false);
          sar = file.w / file.h;
        } catch {
          continue; // reported by the main check
        }
        facesAtLocal = (local) => facesAt(faces, l.clip, l.in + local * speed);
      }
      const [f, g] = focusRange(l);
      let worst: { local: number; share: number; face: Face } | null = null;
      for (const local of [0, l.d / 2, l.d]) {
        const reg = region(l.rect, focusAt(f, g, local / l.d, local, 0), sar);
        for (const face of facesAtLocal(local) ?? []) {
          const share = shown(face, reg);
          if (share > CUT_FROM && share < CUT_TO && (!worst || face[2] > worst.face[2])) worst = { local, share, face };
        }
      }
      if (!worst) continue;
      const name = l.kind === 'shot' ? `shot ${l.clip} at ${l.a.toFixed(2)} s` : `photo ${l.name} at ${l.a.toFixed(2)} s`;
      found.push({
        level: worst.face[2] >= PROMINENT ? 'FAIL' : 'NOTE',
        where: `${s.id}: ${name}`,
        what: `the crop cuts through a face ${worst.local.toFixed(1)} s in (${Math.round(worst.share * 100)}% of it shows); move the focus (faceFocus helps), or set faceCheck: false if it is meant`,
      });
    }
  }
  return found;
}
