import React from 'react';
import { staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { config } from '../film.config';
import { duckGain, type DuckRange } from './duck';
import { FPS, T } from './grid';
import { STEMS, modeLevel, vocalGate, type Part } from './music';

const MUSIC = config.music;
const PARTS: Part[] = config.sections.map((s) => ({ a: T(s.bar), b: T(s.bar + s.bars), mode: s.music ?? 'full' }));

/**
 * The film's music: the song as one file, or as its four stems. Under speech everything ducks and the singing leaves;
 * each section plays as much of the song as it asks for. flat: no ducking, for measuring how loud the music is.
 * It starts `at` seconds into its files, so the song's first bar falls on the film's; a position between frames is passed through.
 */
export const Music: React.FC<{ ducks: DuckRange[]; flat: boolean }> = ({ ducks, flat }) => {
  if (!MUSIC) return null;
  const gain = MUSIC.gain ?? 1;
  const trim = (MUSIC.at ?? 0) * FPS;
  const speech = ducks.map(([a, b]): [number, number] => [a, b]);
  const base = (f: number): number => gain * (flat ? 1 : duckGain(f / FPS, ducks));
  if (!MUSIC.stems) return <Audio src={staticFile(`audio/${MUSIC.file}`)} trimBefore={trim} volume={(f) => base(f) * modeLevel('all', f / FPS, PARTS)} />;
  return (
    <>
      {STEMS.map((s) => (
        <Audio key={s} src={staticFile(`audio/${MUSIC.stems}/${s}.wav`)} trimBefore={trim} volume={(f) => base(f) * modeLevel(s, f / FPS, PARTS) * (s === 'vocals' ? vocalGate(f / FPS, speech) : 1)} />
      ))}
    </>
  );
};
