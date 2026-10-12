import React from 'react';
import { AbsoluteFill } from 'remotion';
import { config } from '../film.config';
import { Backdrop } from './Backdrop';
import { duckKey, duckRanges } from './duck';
import depths from './duck.json';
import { ALL } from './edit';
import { Layers } from './LayerStack'; // not ./Layers: on macOS that name resolves to layers.ts
import { speechRanges } from './layers';
import { MixContext, mixFor, type Group } from './mix';
import { Music } from './MusicTrack'; // not ./Music: on macOS that name resolves to music.ts
import { Stamp } from './Stamp';
import { theme } from './theme';

/**
 * `music` and `sfx` switch those groups off; `only` sounds one group alone, which is how `npm run stems` makes a stem.
 * `flat`: the music is not ducked, which is how `npm run speech` measures how loud it is under each line.
 */
export type FilmProps = { music?: boolean; sfx?: boolean; only?: Group; stamp?: boolean; flat?: boolean };

const SPEECH = speechRanges(ALL);
const MUSIC = config.music;
/** How far the music goes down under each spoken range, in dB, measured by `npm run speech`. Keyed by where the range sits. */
const DEPTHS = depths as unknown as Record<string, number>;

/** The music's gain under a spoken range: fixed if the film says so, else from the measurement, else 0.4. */
const lowFor = (a: number, b: number): number => {
  if (MUSIC?.duck !== undefined) return MUSIC.duck;
  const depth = DEPTHS[duckKey(a, b)];
  return depth === undefined ? 0.4 : 10 ** (-depth / 20);
};
export const DUCK = duckRanges(SPEECH, lowFor);

export const Film: React.FC<FilmProps> = ({ music = true, sfx = true, only, stamp = false, flat = false }) => {
  const mix = mixFor({ music, sfx, only });
  return (
    // fontSynthesis: a face is drawn at a weight and style it has; the browser never fakes a bold or an italic for a family that lacks one.
    <AbsoluteFill style={{ backgroundColor: theme.color.bg, fontSynthesis: 'none' }}>
      <MixContext.Provider value={mix}>
        <Backdrop />
        <Layers layers={ALL} />
        {/* The music ducks under every speech shot and comes back after it, each time as far as was measured there.
            The singing leaves under speech in a flat render too: what is measured for ducking is the music as it will be under the line. */}
        {mix.music ? <Music ducks={DUCK} flat={flat} /> : null}
        {stamp ? <Stamp /> : null}
      </MixContext.Provider>
    </AbsoluteFill>
  );
};
