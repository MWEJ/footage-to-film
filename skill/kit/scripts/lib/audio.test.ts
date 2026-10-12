import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND_CENTRES, bestLag, noiseBands, residualDb, rms, speechLevels } from './audio';

/** Repeatable noise in -1..1. */
function noise(n: number): Float32Array {
  const x = new Float32Array(n);
  let s = 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = s / 2 ** 31 - 1;
  }
  return x;
}

test('bestLag finds how late or early a copy is', () => {
  const ref = noise(4000);
  const late = new Float32Array(4000);
  late.set(ref.subarray(0, 3960), 40);
  const a = bestLag(ref, late, 100);
  assert.equal(a.lag, 40);
  assert.ok(a.match > 0.99, `${a.match}`);
  const early = new Float32Array(4000);
  early.set(ref.subarray(25), 0);
  assert.equal(bestLag(ref, early, 100).lag, -25);
});

test('bestLag reports a weak match for unrelated sound', () => {
  const other = noise(8000).subarray(4000);
  assert.ok(bestLag(noise(4000), other, 100).match < 0.2);
});

test('rms of a constant and of silence', () => {
  assert.ok(Math.abs(rms(new Float32Array(100).fill(0.5)) - 0.5) < 1e-6);
  assert.equal(rms(new Float32Array(100)), 0);
  assert.equal(rms(new Float32Array(0)), 0);
});

test('residualDb is very low when the stems sum to the mix, and high when one is missing', () => {
  const a = noise(4000);
  const b = noise(8000).subarray(4000);
  const mix = Float32Array.from(a, (v, i) => v + b[i]);
  assert.ok(residualDb(mix, [a, b]) < -100);
  const without = residualDb(mix, [a]);
  assert.ok(without > -10 && without < 0, `${without}`);
});

test('residualDb copes with silence and with stems of slightly different lengths', () => {
  assert.equal(residualDb(new Float32Array(100), [new Float32Array(100)]), -120);
  const a = noise(4000);
  assert.ok(residualDb(a, [a.subarray(0, 3990), new Float32Array(4010)]) < -100);
});

/** A repeatable hiss between -1 and 1. */
const hiss = (i: number): number => ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - Math.sign(Math.sin(i * 12.9898));

function talk(noise: number, rate = 16000): Float32Array {
  const x = new Float32Array(rate * 4);
  for (let i = 0; i < x.length; i++) {
    const speaking = Math.floor(i / (rate / 2)) % 2 === 0; // half a second on, half a second off
    x[i] = noise * hiss(i) + (speaking ? 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate) : 0);
  }
  return x;
}

test('the test hiss stays between -1 and 1', () => {
  for (let i = 0; i < 100000; i++) assert.ok(Math.abs(hiss(i)) <= 1, `hiss(${i}) = ${hiss(i)}`);
});

test('speechLevels says how far speech stands over the noise between the words', () => {
  const noisy = speechLevels(talk(0.02), 16000);
  assert.ok(noisy.snr > 18 && noisy.snr < 30, `noisy: ${noisy.snr}`);
  assert.ok(noisy.noise > -45 && noisy.noise < -32, `noise floor: ${noisy.noise}`);
  const clean = speechLevels(talk(0.0005), 16000);
  assert.ok(clean.snr > 45, `clean: ${clean.snr}`);
});

test('speechLevels does not judge silence or a scrap of sound', () => {
  assert.equal(speechLevels(new Float32Array(16000), 16000).snr, 60);
  assert.equal(speechLevels(talk(0.02).subarray(0, 1000), 16000).snr, 60);
});

test("afftdn's fifteen bands start at 80 Hz and grow by half each time, rounded as ffmpeg rounds them", () => {
  assert.deepEqual(BAND_CENTRES, [80, 120, 180, 270, 410, 620, 930, 1400, 2100, 3150, 4750, 7100, 10700, 16000, 24000]);
});

test('noiseBands reads a white noise at its own level in every band, from the quietest frames only', () => {
  const rate = 48000;
  const white = noise(rate * 4); // uniform in -1..1: 1/sqrt(3) rms
  const x = Float32Array.from(white, (v, i) => v * (Math.floor(i / (rate / 2)) % 2 === 0 ? 0.01 : 0.3)); // quiet and loud halves of a second
  const level = 20 * Math.log10(0.01 / Math.sqrt(3));
  const bands = noiseBands(x, rate);
  assert.equal(bands.length, 15);
  for (const [i, b] of bands.entries()) assert.ok(Math.abs(b - level) < 1.5, `band ${BAND_CENTRES[i]} Hz: ${b.toFixed(1)}, expected ${level.toFixed(1)}`);
});

test('noiseBands sees where a noise has its weight', () => {
  const rate = 48000;
  const white = noise(rate * 2);
  const hum = Float32Array.from(white, (v, i) => 0.001 * v + 0.05 * Math.sin((2 * Math.PI * 120 * i) / rate));
  const bands = noiseBands(hum, rate);
  assert.ok(bands[1] - bands[8] > 20, bands.map((b) => b.toFixed(0)).join(' '));
  assert.ok(Math.abs(bands[8] - bands[12]) < 2, bands.map((b) => b.toFixed(0)).join(' '));
  assert.deepEqual(noiseBands(new Float32Array(100), rate), new Array(15).fill(-120)); // too short to measure
});
