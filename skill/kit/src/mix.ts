import React from 'react';

/** The four groups of sound in a film. Each can be rendered alone, as a stem. */
export type Group = 'dialogue' | 'natural' | 'effects' | 'music';
export type Mix = Record<Group, boolean>;

/** Which groups sound, from the film's props. `only` sounds one group alone. */
export function mixFor(p: { music?: boolean; sfx?: boolean; only?: Group }): Mix {
  if (p.only) return { dialogue: p.only === 'dialogue', natural: p.only === 'natural', effects: p.only === 'effects', music: p.only === 'music' };
  return { dialogue: true, natural: true, effects: p.sfx ?? true, music: p.music ?? true };
}

export const MixContext = React.createContext<Mix>({ dialogue: true, natural: true, effects: true, music: true });
