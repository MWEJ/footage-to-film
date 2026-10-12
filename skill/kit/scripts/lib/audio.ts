import { runBuffer, tool } from './tools';

/** A file's sound as mono samples at the given rate. The whole file is decoded, so sample positions are exact. */
export function decodeMono(file: string, rate: number): Float32Array {
  const raw = runBuffer(tool('ffmpeg'), ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-']);
  const bytes = new Uint8Array(raw); // a copy, so the samples start at offset 0 of their own buffer
  return new Float32Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 4));
}

export function rms(x: Float32Array): number {
  if (x.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

/**
 * Levels of a recording of speech, in decibels relative to full scale: its noise (the quietest fifth of its 50 ms frames,
 * which are the gaps between words), its speech (the loudest third), and how far the speech stands over the noise.
 * A recording too short or too quiet to judge is called clean (snr 60), so nothing is done to it.
 */
export function speechLevels(x: Float32Array, rate: number): { noise: number; speech: number; snr: number } {
  const n = Math.round(0.05 * rate);
  const frames: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) frames.push(rms(x.subarray(i, i + n)) ** 2);
  frames.sort((a, b) => a - b);
  const db = (v: number[]): number => 10 * Math.log10(v.reduce((s, y) => s + y, 0) / Math.max(1, v.length) + 1e-12);
  const noise = db(frames.slice(0, Math.max(1, Math.floor(frames.length / 5))));
  const speech = db(frames.slice(Math.floor((frames.length * 2) / 3)));
  if (frames.length < 10 || speech < -70) return { noise, speech, snr: 60 };
  return { noise, speech, snr: speech - noise };
}

/** The centre frequencies (Hz) of the 15 bands in which ffmpeg's afftdn takes a noise's shape: 80 Hz, then half as much again each time, rounded as ffmpeg rounds them. */
export const BAND_CENTRES: number[] = [80];
for (let i = 1; i < 15; i++) {
  const c = Math.round(1.5 * BAND_CENTRES[i - 1] + 5);
  BAND_CENTRES.push(c < 1000 ? 10 * Math.floor(c / 10) : c < 5000 ? 50 * Math.floor((c + 20) / 50) : c < 15000 ? 100 * Math.floor((c + 45) / 100) : 1000 * Math.floor((c + 495) / 1000));
}

/** In-place radix-2 FFT. `cos` and `sin` hold the twiddles for the length of re and im. */
function fft(re: Float64Array, im: Float64Array, cos: Float64Array, sin: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = cos[k * step];
        const wi = -sin[k * step];
        const a = i + k + len / 2;
        const tr = re[a] * wr - im[a] * wi;
        const ti = re[a] * wi + im[a] * wr;
        re[a] = re[i + k] - tr;
        im[a] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }
}

/**
 * The noise of a recording in afftdn's 15 bands: for each band, the level in dBFS of a white noise as dense there as the
 * recording's quietest frames are (frames of about 85 ms; the quietest fifth are the gaps between words). A white noise
 * reads its own level in every band. -120 in every band for a recording too short to measure.
 */
export function noiseBands(x: Float32Array, rate: number): number[] {
  const n = 2 ** Math.round(Math.log2(0.085 * rate));
  const cos = Float64Array.from({ length: n }, (_, k) => Math.cos((2 * Math.PI * k) / n));
  const sin = Float64Array.from({ length: n }, (_, k) => Math.sin((2 * Math.PI * k) / n));
  const win = Float64Array.from({ length: n }, (_, k) => 0.5 - 0.5 * cos[k]);
  const w2 = win.reduce((s, v) => s + v * v, 0);
  const frames: { e: number; p: Float64Array }[] = [];
  for (let i = 0; i + n <= x.length; i += n / 2) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    let e = 0;
    for (let k = 0; k < n; k++) {
      re[k] = x[i + k] * win[k];
      e += x[i + k] * x[i + k];
    }
    fft(re, im, cos, sin);
    // Scaled so that a white noise of variance v gives v in every bin.
    const p = new Float64Array(n / 2 + 1);
    for (let k = 0; k <= n / 2; k++) p[k] = (re[k] * re[k] + im[k] * im[k]) / w2;
    frames.push({ e, p });
  }
  if (frames.length < 5) return new Array(15).fill(-120);
  frames.sort((a, b) => a.e - b.e);
  const quiet = frames.slice(0, Math.floor(frames.length / 5));
  const mean = new Float64Array(n / 2 + 1);
  for (const f of quiet) for (let k = 0; k <= n / 2; k++) mean[k] += f.p[k] / quiet.length;
  const hz = rate / n;
  const out: number[] = [];
  for (const c of BAND_CENTRES) {
    const lo = Math.max(1, Math.floor(c / Math.sqrt(1.5) / hz));
    const hi = Math.min(n / 2, Math.ceil((c * Math.sqrt(1.5)) / hz));
    if (lo > hi) {
      out.push(out[out.length - 1] ?? -120); // a band above what this rate can hold: as the one below
      continue;
    }
    let s = 0;
    for (let k = lo; k <= hi; k++) s += mean[k];
    out.push(Math.max(-120, 10 * Math.log10(s / (hi - lo + 1) + 1e-20)));
  }
  return out;
}

/**
 * How much of the mix the stems fail to account for: the level of (mix minus the sum of the stems) relative to the
 * mix, in decibels. Compared over the length they all share. -120 stands for "nothing left", and for a silent mix
 * with silent stems. Stems that sound where the mix is silent are reported as 0 dB: as loud as the mix, a failure.
 */
export function residualDb(mix: Float32Array, stems: Float32Array[]): number {
  const n = Math.min(mix.length, ...stems.map((s) => s.length));
  let left = 0;
  let whole = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const s of stems) sum += s[i];
    left += (mix[i] - sum) ** 2;
    whole += mix[i] ** 2;
  }
  if (left === 0) return -120;
  if (whole === 0) return 0;
  return Math.max(-120, 10 * Math.log10(left / whole));
}

/**
 * How late x is against ref, in samples, searched from -maxLag to +maxLag: x[n] is compared with ref[n - lag].
 * `match` is the normalised correlation at that lag: 1 for a perfect copy, near 0 for unrelated sound.
 */
export function bestLag(ref: Float32Array, x: Float32Array, maxLag: number): { lag: number; match: number } {
  let best = { lag: 0, match: -Infinity };
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const n0 = Math.max(0, lag);
    const n1 = Math.min(x.length, ref.length + lag);
    let dot = 0;
    let er = 0;
    let ex = 0;
    for (let n = n0; n < n1; n++) {
      const r = ref[n - lag];
      const v = x[n];
      dot += r * v;
      er += r * r;
      ex += v * v;
    }
    const match = dot / (Math.sqrt(er * ex) + 1e-12);
    if (match > best.match) best = { lag, match };
  }
  return best;
}
