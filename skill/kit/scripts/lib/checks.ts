import type { Section } from '../../src/edit';
import { pickFile, type ClipFile, type Sources } from '../../src/sources';
import type { Layer } from '../../src/types';

export type Finding = { level: 'FAIL' | 'NOTE'; where: string; what: string };
export type GridInfo = { SECONDS: number; BEAT: number; onGrid: (seconds: number) => boolean };

const EPS = 1e-6;
const s2 = (n: number): string => n.toFixed(2);
const nameOf = (l: Layer): string =>
  l.kind === 'shot'
    ? `shot ${l.clip} at ${s2(l.a)} s`
    : l.kind === 'photo'
      ? `photo ${l.name} at ${s2(l.a)} s`
      : l.kind === 'sfx'
        ? `sound effect ${l.name} at ${s2(l.a)} s`
        : `${l.tag ?? 'element'} at ${s2(l.a)} s`;
const halfBeat = (t: number, beat: number): string => s2(Math.round(t / (beat / 2)) * (beat / 2));

/** Everything that can be checked about an edit without rendering it. `music` says whether the film has a music track. */
export function checkEdit(edit: Section[], sources: Sources, g: GridInfo, music: boolean): Finding[] {
  const found: Finding[] = [];
  const fail = (where: string, what: string) => found.push({ level: 'FAIL', where, what });
  const note = (where: string, what: string) => found.push({ level: 'NOTE', where, what });

  // Sections are in order, do not overlap and stay inside the film.
  let cursor = 0;
  for (const s of edit) {
    if (s.a < cursor - EPS) fail(`section ${s.id}`, `starts at ${s2(s.a)} s, before the section before it ends (${s2(cursor)} s)`);
    else if (s.a > cursor + EPS) note(`section ${s.id}`, `nothing but the backdrop from ${s2(cursor)} to ${s2(s.a)} s`);
    if (s.b > g.SECONDS + EPS) fail(`section ${s.id}`, `ends at ${s2(s.b)} s, after the film's end (${s2(g.SECONDS)} s)`);
    cursor = Math.max(cursor, s.b);
  }
  if (cursor < g.SECONDS - EPS) note('film', `nothing but the backdrop from ${s2(cursor)} s to the end (${s2(g.SECONDS)} s)`);

  const captions = edit.flatMap((s) => s.layers).filter((l) => l.kind === 'el' && l.tag === 'caption');
  let sound = music;

  for (const s of edit) {
    for (const l of s.layers) {
      const where = `${s.id}: ${nameOf(l)}`;
      if (!(l.d > 0)) {
        fail(where, `has a duration of ${l.d} s`);
        continue;
      }
      if (l.a < s.a - EPS || l.a + l.d > s.b + EPS) fail(where, `runs from ${s2(l.a)} to ${s2(l.a + l.d)} s, outside its section (${s2(s.a)} to ${s2(s.b)} s)`);
      // An effect is placed at a moment, not cut on the beat; whether its file exists is checked with the other files.
      if (l.kind === 'sfx') sound = true;
      if (l.kind === 'el' || l.kind === 'sfx') continue;

      if (s.grid === 'beat' && !l.free) {
        if (!g.onGrid(l.a)) fail(where, `starts off the beat (the nearest half-beat is ${halfBeat(l.a, g.BEAT)} s); move it, or set free: true`);
        if (!g.onGrid(l.a + l.d)) fail(where, `ends at ${s2(l.a + l.d)} s, off the beat (the nearest half-beat is ${halfBeat(l.a + l.d, g.BEAT)} s); change it, or set free: true`);
      }
      if (l.kind === 'photo') {
        if (!sources.photos[l.name]) fail(where, `unknown photo ${l.name} (have: ${Object.keys(sources.photos).join(', ')})`);
        continue;
      }

      const speed = l.speed ?? 1;
      if (!(speed > 0)) {
        fail(where, `has speed ${speed}`);
        continue;
      }
      let file: ClipFile;
      try {
        file = pickFile(sources.clips, l.clip, l.in, l.d, speed, l.full ?? false);
      } catch (e) {
        fail(where, e instanceof Error ? e.message : String(e));
        continue;
      }
      const audio = l.audio ?? 'off';
      if (audio === 'off') continue;
      sound = true;
      if (!file.audio) fail(where, `is set to play its sound (${audio}), but ${file.file} has no sound`);
      if (speed !== 1) note(where, `plays its sound at speed ${speed}, so its pitch changes`);
      if (file.a > 0 && l.in - file.a < 0.02) {
        note(where, `starts on the first sample of ${file.file}, so the first 12 ms of its sound are lost; convert the clip again with a handle before ${s2(l.in)} s`);
      }
      if (audio === 'speech' && !captions.some((c) => c.a < l.a + l.d - EPS && c.a + c.d > l.a + EPS)) fail(where, 'is a spoken shot with no caption over it');
    }
  }
  if (!sound) note('film', 'there is no music and no shot plays its sound: the film is silent');
  return found;
}
