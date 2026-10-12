import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { alignSaid, type Word } from '../align';
import { E, prog } from '../ease';
import { FPS, U } from '../grid';
import { el } from '../layers';
import { SAFE, theme } from '../theme';
import transcripts from '../transcripts.json';
import type { Layer, ShotLayer } from '../types';
import { textWidth } from './titleCard';

/** One transcribed word. a and b are seconds in the original clip. (Defined in ../align, where typed words are placed on heard ones.) */
export type { Word };
/** One caption line. a and b are timeline seconds. */
export type Line = { s: string; a: number; b: number };
export type CaptionOptions = {
  shot: ShotLayer;
  lines?: Line[];
  words?: Word[];
  say?: string; // the line as it should read: its words take their times from the transcript
  top?: boolean;
};

/** Groups the words spoken during a shot into caption lines on the timeline: a new line at a pause longer than `gap`, or when a line would pass `maxChars`. */
export function captionLines(words: Word[], shot: Pick<ShotLayer, 'a' | 'd' | 'in' | 'speed'>, maxChars = 34, gap = 0.6): Line[] {
  const speed = shot.speed ?? 1;
  const end = shot.a + shot.d;
  const at = (source: number): number => shot.a + (source - shot.in) / speed;
  const inside = words.filter((w) => at(w.b) > shot.a + 1e-6 && at(w.a) < end - 1e-6);
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of inside) {
    const length = cur.map((x) => x.s).join(' ').length + 1 + w.s.length;
    if (cur.length > 0 && (length > maxChars || w.a - cur[cur.length - 1].b > gap)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length > 0) groups.push(cur);
  const lines = groups.map((g) => ({ s: g.map((w) => w.s).join(' '), a: Math.max(shot.a, at(g[0].a)), b: Math.min(end, at(g[g.length - 1].b)) }));
  // A line stays up until the next one starts if that is within a second; otherwise for 0.4 s after its last word.
  return lines.map((l, i) => {
    const next = lines[i + 1];
    return { ...l, b: next && next.a - l.b <= 1 ? next.a : Math.min(end, l.b + 0.4) };
  });
}

/** lines are in seconds since the start of the element. */
const Caption: React.FC<{ lines: Line[]; top: boolean }> = ({ lines, top }) => {
  const t = useCurrentFrame() / FPS;
  const line = lines.find((l) => t >= l.a && t < l.b);
  if (!line) return null;
  const p = prog(t, line.a, 0.18, E.out3);
  return (
    <AbsoluteFill style={{ justifyContent: top ? 'flex-start' : 'flex-end', alignItems: 'center', paddingLeft: SAFE.l, paddingRight: SAFE.r, paddingTop: SAFE.t, paddingBottom: SAFE.b }}>
      <div
        style={{
          maxWidth: textWidth(),
          padding: `${10 * U}px ${26 * U}px`,
          borderRadius: 10 * U,
          background: theme.color.scrim,
          color: theme.color.text,
          fontFamily: theme.font.label,
          fontWeight: 500,
          fontSize: 44 * U,
          lineHeight: 1.25,
          textAlign: 'center',
          opacity: p,
          transform: `translateY(${(1 - p) * 14 * U}px)`,
        }}
      >
        {line.s}
      </div>
    </AbsoluteFill>
  );
};

/**
 * A caption for a spoken shot, one line at a time, low in the frame (or high with top: true).
 * The words come from the transcript of the shot's clip. To correct what was heard (a name, a misheard word), pass `say`,
 * the line as it should read: its words take their times from the transcript. `lines` (timeline seconds) is for when
 * nothing usable was heard.
 */
export function caption(o: CaptionOptions): Layer[] {
  let words = o.words ?? (transcripts as unknown as Record<string, Word[]>)[o.shot.clip];
  if (o.say !== undefined) {
    const speed = o.shot.speed ?? 1;
    const to = o.shot.in + o.shot.d * speed;
    const inShot = (words ?? []).filter((w) => w.b > o.shot.in && w.a < to);
    if (inShot.length === 0) throw new Error(`caption: no words were heard in clip ${o.shot.clip} between ${o.shot.in.toFixed(2)} and ${to.toFixed(2)} s, so "say" has no times to take; pass lines: [{ s, a, b }] in timeline seconds`);
    words = alignSaid(o.say, inShot);
  }
  const lines = o.lines ?? (words ? captionLines(words, o.shot) : []);
  if (lines.length === 0) {
    const to = o.shot.in + o.shot.d * (o.shot.speed ?? 1);
    throw new Error(`caption: no words for clip ${o.shot.clip} between ${o.shot.in.toFixed(2)} and ${to.toFixed(2)} s; pass lines: [{ s, a, b }] in timeline seconds`);
  }
  return [
    el({
      a: o.shot.a,
      d: o.shot.d,
      tag: 'caption',
      text: lines.map((l) => l.s),
      stills: lines.map((l) => (l.a + l.b) / 2),
      node: <Caption lines={lines.map((l) => ({ ...l, a: l.a - o.shot.a, b: l.b - o.shot.a }))} top={o.top ?? false} />,
    }),
  ];
}
