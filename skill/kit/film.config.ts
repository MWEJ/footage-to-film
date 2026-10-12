import type { FilmConfig } from './src/types';

/** Everything about this film that is not a layer. Sizes, times and the section list all derive from this. */
export const config: FilmConfig = {
  title: 'Untitled film',
  width: 1920,
  height: 1080,
  fps: 30,
  bpm: 120, // 120 gives 2 s bars and 0.5 s beats, which land on whole frames at 30 fps
  bars: 4, // length of the film, in bars of four beats
  theme: 'house',
  language: 'en', // language of the speech, for the transcript check
  music: null, // { file: 'music.wav' }: a file in the film project's audio/ folder
  sections: [{ id: 'example', bar: 1, bars: 4 }],
};
