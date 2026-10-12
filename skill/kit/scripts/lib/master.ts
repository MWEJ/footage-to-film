import { run, tool } from './tools';

export type Loudness = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string };

/**
 * −14 LUFS integrated. The peak target is −1.5 dBTP, not −1: encoding to AAC raises peaks by a few tenths of a decibel,
 * and the finished file must stay at or below −1 dBTP.
 */
export const TARGET = { I: -14, TP: -1.5, LRA: 11 };

/** The measurement that loudnorm prints as JSON at the end of its first pass. */
export function parseLoudnorm(stderr: string): Loudness {
  const key = stderr.lastIndexOf('"input_i"');
  const a = key < 0 ? -1 : stderr.lastIndexOf('{', key);
  const b = a < 0 ? -1 : stderr.indexOf('}', a);
  if (a < 0 || b < 0) throw new Error('loudnorm printed no measurement');
  return JSON.parse(stderr.slice(a, b + 1)) as Loudness;
}

/** True when there is nothing to normalise: loudnorm reports -inf, or its floor of -70. */
export const isSilent = (m: Loudness): boolean => !(Number(m.input_i) > -69);

/** The loudnorm filter for the second pass, fed with the first pass's measurement. */
export function secondPass(m: Loudness): string {
  return `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`;
}

/**
 * Masters the mix (two-pass loudness, 48 kHz FLAC) and puts it on the picture.
 * The picture is copied, never re-encoded. Sound and picture both start at 0, so they stay in sync.
 */
export function master(picture: string, mix: string, film: string, flac: string, log: string): string | null {
  const ff = tool('ffmpeg');
  const first = run(ff, ['-hide_banner', '-i', mix, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-'], { log });
  const measured = parseLoudnorm(first.stderr);
  let remark: string | null = null;
  if (isSilent(measured)) {
    remark = 'the mix is silent, so it was not normalised';
    run(ff, ['-v', 'error', '-y', '-i', mix, '-ar', '48000', '-c:a', 'flac', flac], { log });
  } else {
    run(ff, ['-hide_banner', '-y', '-i', mix, '-af', secondPass(measured), '-ar', '48000', '-c:a', 'flac', flac], { log });
  }
  run(ff, ['-v', 'error', '-y', '-i', picture, '-i', flac, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', film], { log });
  return remark;
}
