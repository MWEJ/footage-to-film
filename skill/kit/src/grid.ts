import { config } from '../film.config';
import type { FilmConfig } from './types';

/**
 * The part of the frame that text must stay inside, as pixel insets. `margin` is a fraction of the frame's short side.
 * Apps that show tall video cover the top and bottom with their own controls, so a tall frame keeps more clear there.
 */
export function safeArea(w: number, h: number, margin: number): { l: number; r: number; t: number; b: number } {
  const m = margin * Math.min(w, h);
  return w < h ? { l: m, r: m, t: 0.1 * h, b: 0.16 * h } : { l: m, r: m, t: m, b: m };
}

/** Frame size, frame rate and the beat grid for a film. Tests call this with their own numbers; everything else uses the constants below. */
export function makeGrid(c: Pick<FilmConfig, 'fps' | 'bpm' | 'bars' | 'width' | 'height'>) {
  const BEAT = 60 / c.bpm;
  const BAR = 4 * BEAT;
  /** Timeline seconds of a bar (counted from 1) and beat (1 to 4, may be fractional). */
  const T = (bar: number, beat = 1): number => (bar - 1) * BAR + (beat - 1) * BEAT;
  /** Seconds to the nearest whole frame. */
  const toFrame = (seconds: number): number => Math.round(seconds * c.fps);
  /** True when a time lands on a whole frame. */
  const onFrame = (seconds: number): boolean => Math.abs(seconds * c.fps - Math.round(seconds * c.fps)) < 1e-6;
  /** True when a time is within half a frame of a half-beat, so that it rounds to the frame the half-beat rounds to. */
  const onGrid = (seconds: number): boolean => {
    const half = BEAT / 2;
    return Math.abs(seconds - Math.round(seconds / half) * half) <= 0.5 / c.fps + 1e-9;
  };
  const SECONDS = T(c.bars + 1);
  return {
    FPS: c.fps,
    W: c.width,
    H: c.height,
    FORMAT: (c.width > c.height ? 'wide' : c.width < c.height ? 'tall' : 'square') as 'wide' | 'tall' | 'square',
    U: Math.min(c.width, c.height) / 1080, // multiply sizes designed at 1080p by this
    BPM: c.bpm,
    BEAT,
    BAR,
    T,
    toFrame,
    onFrame,
    onGrid,
    SECONDS,
    FRAMES: toFrame(SECONDS),
  };
}

export const { FPS, W, H, FORMAT, U, BPM, BEAT, BAR, T, toFrame, onFrame, onGrid, SECONDS, FRAMES } = makeGrid(config);
