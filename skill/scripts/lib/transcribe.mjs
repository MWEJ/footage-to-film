import path from 'node:path';

// whisper.cpp's alignment (-dtw) gives one time per token, which falls near the END of that token. A word is taken to
// start LEAD before its first token's time, but never before the last token of the word before it: in running speech
// one word starts where the last one ended. It ends TRAIL after its last token's time.
// Measured on the 18 words of the first film's nails clip that have reference times: 0.11 s off at the median, 0.27 s
// at worst, leaning neither early nor late (the earlier rule, 0.3 s before the first token: 0.18 s and 0.42 s, late).
// That is good to about a fifth of a second: enough for captions, not for type that lands on a syllable.
const LEAD = 0.45;
const TRAIL = 0.1;
/** A phrase containing a token whisper gave less than this probability is flagged for a human to read. */
export const DOUBT = 0.1;

const r3 = (x) => Math.round(x * 1000) / 1000;

/** The alignment preset whisper.cpp wants for a model file: "ggml-large-v3-turbo.bin" is "large.v3.turbo". */
export function dtwPreset(modelFile) {
  return path
    .basename(modelFile)
    .replace(/^ggml-/, '')
    .replace(/\.bin$/, '')
    .replace(/-q\d+_\d+$/, '')
    .replace(/-/g, '.');
}

/**
 * Words from whisper.cpp's JSON when it was run with one entry per word (-ml 1 -sow). Times are seconds in the clip.
 * With alignment times in the JSON (-ojf -dtw) they are used, and each word carries `p`, the lowest probability among
 * its tokens. Without them the entry's own, rougher, times are used.
 */
export function wordsFromWhisper(json) {
  const out = [];
  let prevEnd = 0; // the last token's time of the previous word that had alignment times
  for (const e of json.transcription ?? []) {
    const s = String(e.text ?? '').trim();
    if (!s || /^[\[(♪]/.test(s)) continue; // [BLANK_AUDIO], (music), ♪ are not speech
    const tokens = (e.tokens ?? []).filter((k) => !/^\[_/.test(String(k.text ?? ''))); // [_BEG_], [_TT_50] are markers
    const times = tokens.map((k) => k.t_dtw).filter((v) => typeof v === 'number' && v >= 0);
    const first = times.length > 0 ? times[0] / 100 : null;
    const last = times.length > 0 ? times[times.length - 1] / 100 : null;
    let a = first !== null ? Math.max(0, prevEnd, first - LEAD) : e.offsets.from / 1000;
    let b = last !== null ? last + TRAIL : e.offsets.to / 1000;
    if (last !== null) prevEnd = last;
    const prev = out[out.length - 1];
    if (prev && a < prev.a) a = prev.a; // words stay in order
    if (b < a + 0.1) b = a + 0.1;
    const word = { s, a: r3(a), b: r3(b) };
    if (tokens.length > 0) word.p = Math.round(Math.min(...tokens.map((k) => k.p ?? 1)) * 100) / 100;
    out.push(word);
  }
  return out;
}

/** Words joined into phrases: a new phrase starts after a pause longer than `gap` seconds. A phrase carries the lowest `p` of its words, when they have one. */
export function phrases(words, gap = 0.6) {
  const out = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last && w.a - last.b <= gap) {
      last.b = w.b;
      last.s += ` ${w.s}`;
      if (w.p !== undefined) last.p = Math.min(last.p ?? 1, w.p);
    } else {
      out.push(w.p === undefined ? { a: w.a, b: w.b, s: w.s } : { a: w.a, b: w.b, s: w.s, p: w.p });
    }
  }
  return out;
}
