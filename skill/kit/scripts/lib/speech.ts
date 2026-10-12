import type { ShotLayer } from '../../src/types';
import type { Loudness } from './master';

/** Level of cleaned speech, and its peak ceiling. The master brings the whole mix to -14 LUFS afterwards. */
const LEVEL = 'I=-17:TP=-2:LRA=11';

/** Decibels of steady noise to take out of a recording whose speech stands `snr` dB over its noise: none for a clean one, at most 12. */
export function noiseCut(snr: number): number {
  const cut = Math.round(Math.min(12, Math.max(0, 30 - snr)));
  return cut < 2 ? 0 : cut;
}

/**
 * How far over the noise's average level afftdn's floor is set. Measured with ffmpeg 9: told the noise's shape and a floor
 * this far over it, afftdn takes out 85 to 100% of what it is asked to from a steady pink or white noise; told the
 * noise's own level, about half.
 */
const FLOOR_OVER_NOISE = 6;
/** The highest floor afftdn accepts. */
const TOP_FLOOR = -20;

/**
 * A noise's shape as afftdn takes it: offsets from a centre, each within 24 dB of it, that average to zero (afftdn
 * re-centres whatever it is given). The centre is found so that the clipped offsets average to zero; a plain average
 * would be dragged down by an empty band, such as everything above an encoder's cut-off.
 */
function shapeOf(bands: number[]): { centre: number; shape: number[] } {
  const clip = (v: number): number => Math.min(24, Math.max(-24, v));
  let lo = Math.min(...bands) - 24;
  let hi = Math.max(...bands) + 24;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (bands.reduce((s, b) => s + clip(b - m), 0) > 0) lo = m;
    else hi = m;
  }
  const centre = (lo + hi) / 2;
  return { centre, shape: bands.map((b) => clip(b - centre)) };
}

/**
 * The cleaning chain for one shot, from its measured levels: `speech` and `snr` from speechLevels(), `bands` from
 * noiseBands(). Rumble out; steady noise down, only as far as this recording needs, told the noise's own shape; the loud
 * words held back a little; a little presence so consonants carry over music; the hiss above speech off.
 * Gentle on purpose: a line should still sound like the room it was said in.
 */
export function chainFor(levels: { speech: number; snr: number; bands: number[] }): string {
  const cut = noiseCut(levels.snr);
  let pre = 0;
  let denoise = '';
  if (cut > 0) {
    const { centre, shape } = shapeOf(levels.bands);
    const floor = centre + FLOOR_OVER_NOISE;
    // A noise louder than the highest floor is turned down first. The level is set again at the end, so nothing is lost.
    pre = Math.min(0, TOP_FLOOR - floor);
    const bn = shape.map((v) => Math.round(v * 10) / 10).join('|');
    denoise = `${pre < 0 ? `volume=${pre.toFixed(1)}dB,` : ''}afftdn=nr=${cut}:nf=${Math.round(Math.max(-80, floor + pre))}:nt=c:bn=${bn},`;
  }
  // Only words that rise 3 dB over the speech's usual level are held back. A fixed threshold would compress a loud
  // recording all the way through, and bring its noise up between the words when the shot is levelled.
  const threshold = Math.round(Math.min(-3, Math.max(-50, levels.speech + 3 + pre)));
  return `highpass=f=90,${denoise}acompressor=threshold=${threshold}dB:ratio=3:attack=8:release=160:makeup=1,equalizer=f=3200:t=q:w=0.8:g=2.5,lowpass=f=14000`;
}

/**
 * afftdn delays its output by 25 ms (1200 samples at 48 kHz, the rate of every converted clip; measured with ffmpeg 9).
 * Left in, the cleaned speech would be most of a frame late against the picture. The other filters of the chain add no delay.
 */
const DENOISE_DELAY = 0.025;
/** Sound before the in-point that the filters run over first, so they have settled when the shot starts. Less when the file starts sooner. */
const LEAD = 0.1;

const ms = (seconds: number, digits: number): string => String(Math.round(seconds * 1000)).padStart(digits, '0');

/** The file name of a shot's cleaned speech. */
export const speechName = (l: Pick<ShotLayer, 'clip' | 'in' | 'd'>): string => `${l.clip}_${ms(l.in, 7)}_${ms(l.d, 6)}.wav`;

/**
 * The input options that cut the shot from its file, with the lead-in and, when the chain has the denoiser, room for its
 * delay; and the filters that take both off again after the chain, so the first sample is the one at the in-point and
 * the length is the shot's.
 */
function cut(src: string, start: number, length: number, chain: string): { input: string[]; trim: string } {
  const from = Number(Math.max(0, start - LEAD).toFixed(3));
  const skip = start - from + (/(^|,)afftdn(=|,|$)/.test(chain) ? DENOISE_DELAY : 0);
  return {
    input: ['-ss', from.toFixed(3), '-t', (skip + length).toFixed(3), '-i', src, '-vn'],
    trim: `atrim=start=${skip.toFixed(6)}:duration=${length.toFixed(6)},asetpts=PTS-STARTPTS,apad=whole_dur=${length.toFixed(6)}`,
  };
}

/** First pass: measure the loudness of the shot's sound after the chain. `start` is seconds into the converted file. */
export function measureArgs(src: string, start: number, length: number, chain: string): string[] {
  const c = cut(src, start, length, chain);
  return ['-hide_banner', ...c.input, '-af', `${chain},${c.trim},loudnorm=${LEVEL}:print_format=json`, '-f', 'null', '-'];
}

/** Second pass: clean, level to the measurement, fade both ends so the shot does not click in or out, write 48 kHz stereo. */
export function cleanArgs(src: string, start: number, length: number, chain: string, m: Loudness, outFile: string): string[] {
  const c = cut(src, start, length, chain);
  const level = `loudnorm=${LEVEL}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const fades = `afade=t=in:st=0:d=0.012,afade=t=out:st=${(length - 0.03).toFixed(3)}:d=0.03`;
  return ['-hide_banner', '-v', 'error', '-y', ...c.input, '-af', `${chain},${c.trim},${level},${fades}`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', outFile];
}
