import type { ReactNode } from 'react';

/** x, y, width, height in frame pixels. */
export type Rect = [x: number, y: number, w: number, h: number];
/** x and y in the source (0..1), then zoom (1 or more; 1 when left out). */
export type Focus = [x: number, y: number, zoom?: number];
/** How a picture arrives: up, down, from the left or from the right (the side it comes from), or a fade. */
export type Reveal = 'none' | 'up' | 'down' | 'left' | 'right' | 'fade';
/** How a picture leaves: up, down, to the left or to the right (the side it goes to), or a fade. */
export type Exit = 'none' | 'up' | 'down' | 'left' | 'right' | 'fade';

/** What shots and photos share. Times are timeline seconds. */
export type Media = {
  a: number; // start
  d: number; // duration
  rect: Rect;
  focus?: Focus; // where the crop is centred at the start; default [0.5, 0.5, 1]
  zoomTo?: number | Focus; // the end: a zoom, or a focus to drift to. Default: the same point, zoom + 0.04
  bump?: number; // zoom pulse on the cut, for example 0.05
  reveal?: Reveal;
  revealD?: number; // seconds; default from the theme
  exit?: Exit;
  exitD?: number; // seconds; default from the theme
  radius?: number; // corner radius, px
  free?: boolean; // start and end need not be on the beat grid
  faceCheck?: boolean; // false: do not check this layer's crop against the faces found in its source
};

export type ShotLayer = Media & {
  kind: 'shot';
  clip: string; // clip id, a key of sources.json "clips"
  in: number; // in-point, seconds in the original clip
  speed?: number; // 1 = real time
  full?: boolean; // prefer the full-resolution file, for a portrait clip cropped to fill the frame
  audio?: 'off' | 'speech' | 'nat';
  gain?: number; // linear, 1 = unchanged
  clean?: boolean; // false: a spoken shot keeps its clip's own sound; npm run speech leaves it alone
};
export type PhotoLayer = Media & { kind: 'photo'; name: string };
export type ElLayer = {
  kind: 'el';
  a: number;
  d: number;
  node: ReactNode;
  tag?: 'caption' | 'text';
  text?: string[]; // the words this element puts on screen, for the spelling stills and the transcript check
  stills?: number[]; // timeline seconds at which the final checks take a still; default: 60% through
};
/** A sound effect: the file audio/sfx/<name>.wav of the film project, starting at `a`. gain is in decibels (default -12). */
export type SfxLayer = { kind: 'sfx'; a: number; d: number; name: string; gain?: number };
export type Layer = ShotLayer | PhotoLayer | ElLayer | SfxLayer;

export type SectionSpec = {
  id: string; // the module src/sections/<id>.tsx
  bar: number; // first bar, counted from 1
  bars: number; // length in bars
  grid?: 'beat' | 'free'; // 'beat' (default): every cut must be on a half-beat. 'free': cut to speech
  music?: 'full' | 'no-vocals' | 'bed' | 'off'; // how much of the song this section plays; 'full' when left out
};

/** A film's own look: a preset (`base`, 'house' when left out) with anything changed. Families must be in src/fonts.json. */
export type ThemeSpec = {
  base?: string;
  name?: string;
  color?: { bg?: string; glow?: string; text?: string; accent?: string; scrim?: string; party?: string[] };
  font?: { display?: string; label?: string; hand?: string };
  margin?: number;
  gutter?: number;
  radius?: number;
  motion?: { reveal?: number; fade?: number; rise?: number; stagger?: number };
};

export type FilmConfig = {
  title: string;
  width: number;
  height: number;
  fps: number;
  bpm: number;
  bars: number;
  theme: string | ThemeSpec; // a preset's name, or a preset with anything changed
  language: string;
  music: null | {
    file: string; // a file in the film project's audio/
    gain?: number; // linear, 1 = unchanged
    duck?: number; // a fixed gain under speech (0 to 1), which switches the measured ducking off
    under?: number; // how many dB below the speech the music sits while someone speaks; 12 when left out
    at?: number; // the second of the music file that plays at the film's 0 s: the start of the song's first bar, or of a later one
    stems?: string; // a folder in audio/ with vocals.wav, drums.wav, bass.wav and other.wav, made by music-stems.mjs
  };
  sections: SectionSpec[];
};
