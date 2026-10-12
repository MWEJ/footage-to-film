import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainFor, cleanArgs, measureArgs, noiseCut, speechName } from './speech';

test('a cleaned file is named after its clip, in-point and length, in milliseconds', () => {
  assert.equal(speechName({ clip: 'IMG_5608', in: 12.4, d: 2.8 }), 'IMG_5608_0012400_002800.wav');
  assert.equal(speechName({ clip: 'land', in: 0.5, d: 6 }), 'land_0000500_006000.wav');
});

test('noise is taken out only as far as a recording needs', () => {
  assert.equal(noiseCut(45), 0);
  assert.equal(noiseCut(29), 0); // under 2 dB is not worth the artefacts
  assert.equal(noiseCut(24), 6);
  assert.equal(noiseCut(5), 12);
});

// A noise that falls by 2 dB a band, from -30 dB at 80 Hz: on average -44 dB.
const SLOPE = Array.from({ length: 15 }, (_, i) => -30 - 2 * i);
const REST = 'ratio=3:attack=8:release=160:makeup=1,equalizer=f=3200:t=q:w=0.8:g=2.5,lowpass=f=14000';

test('the chain: rumble out, noise down if needed, loud words held back, a little presence, the hiss above speech off', () => {
  // The denoiser is told the noise's shape, and a floor 6 dB over its average, so that it takes out what it is asked to.
  assert.equal(
    chainFor({ speech: -18.4, snr: 24, bands: SLOPE }),
    `highpass=f=90,afftdn=nr=6:nf=-38:nt=c:bn=14|12|10|8|6|4|2|0|-2|-4|-6|-8|-10|-12|-14,acompressor=threshold=-15dB:${REST}`,
  );
  // A clean recording: no denoiser. Only words 3 dB louder than the speech's usual level are held back.
  assert.equal(chainFor({ speech: -20, snr: 45, bands: SLOPE }), `highpass=f=90,acompressor=threshold=-17dB:${REST}`);
});

test("a noise louder than the denoiser's highest floor is turned down first, and the compressor's threshold with it", () => {
  const loud = chainFor({ speech: -6, snr: 5, bands: new Array(15).fill(-12) });
  assert.match(loud, /^highpass=f=90,volume=-14\.0dB,afftdn=nr=12:nf=-20:nt=c:bn=0\|0\|0\|0\|0\|0\|0\|0\|0\|0\|0\|0\|0\|0\|0,acompressor=threshold=-17dB:/);
});

test('an empty band (nothing above an encoder cut-off) neither pulls the floor down nor bends the shape the denoiser re-centres', () => {
  const chain = chainFor({ speech: -18.4, snr: 24, bands: [...SLOPE.slice(0, 14), -120] });
  const bn = (chain.match(/:bn=([^,]+),/)?.[1] ?? '').split('|').map(Number);
  assert.match(chain, /afftdn=nr=6:nf=-39:nt=c:bn=14\.7\|/);
  assert.equal(bn[14], -24);
  assert.ok(Math.abs(bn.reduce((s, v) => s + v, 0) / 15) < 0.05, `the shape averages ${bn.reduce((s, v) => s + v, 0) / 15}, not 0`);
});

test("the noise's shape is passed within the denoiser's range of 24 dB either way", () => {
  const steep = Array.from({ length: 15 }, (_, i) => -20 - 5 * i); // -20 to -90: on average -55
  assert.match(chainFor({ speech: -20, snr: 20, bands: steep }), /:bn=24\|24\|24\|20\|15\|10\|5\|0\|-5\|-10\|-15\|-20\|-24\|-24\|-24,/);
});

const at = (a: string[], flag: string): string => a[a.indexOf(flag) + 1];
const TRIM6 = 'asetpts=PTS-STARTPTS,apad=whole_dur=6.000000';

test('the measuring pass cuts the shot from its file, runs the chain it is given, then the level meter', () => {
  const a = measureArgs('/p/land_L_000.0-007.0.mp4', 0.5, 6, 'highpass=f=90,afftdn=nr=6:nf=-52:tn=1');
  // A lead-in of 0.1 s for the filters to settle on, and 25 ms more at the end, for the denoiser's delay.
  assert.equal(at(a, '-ss'), '0.400');
  assert.equal(at(a, '-t'), '6.125');
  // The lead-in and the delay are cut off again, so the first sample is the one at the in-point and the length is the shot's.
  assert.equal(at(a, '-af'), `highpass=f=90,afftdn=nr=6:nf=-52:tn=1,atrim=start=0.125000:duration=6.000000,${TRIM6},loudnorm=I=-17:TP=-2:LRA=11:print_format=json`);
});

test('a chain without the denoiser has no delay to take off', () => {
  const a = measureArgs('/p/land_L_000.0-007.0.mp4', 0.5, 6, 'highpass=f=90');
  assert.equal(at(a, '-ss'), '0.400');
  assert.equal(at(a, '-t'), '6.100');
  assert.equal(at(a, '-af'), `highpass=f=90,atrim=start=0.100000:duration=6.000000,${TRIM6},loudnorm=I=-17:TP=-2:LRA=11:print_format=json`);
});

test('a shot near the start of its file gets the lead-in there is', () => {
  const a = measureArgs('/p/x.mp4', 0.03, 2, 'highpass=f=90,afftdn=nr=6:nf=-52:tn=1');
  assert.equal(at(a, '-ss'), '0.000');
  assert.equal(at(a, '-t'), '2.055');
  assert.match(at(a, '-af'), /,atrim=start=0\.055000:duration=2\.000000,/);
  const b = measureArgs('/p/x.mp4', 0.03, 2, 'highpass=f=90');
  assert.equal(at(b, '-ss'), '0.000');
  assert.equal(at(b, '-t'), '2.030');
  assert.match(at(b, '-af'), /,atrim=start=0\.030000:duration=2\.000000,/);
});

test('the cleaning pass cuts as the measuring pass did, applies the measured level, fades both ends, and writes 48 kHz stereo', () => {
  const m = { input_i: '-24.10', input_tp: '-7.00', input_lra: '4.00', input_thresh: '-34.50', target_offset: '0.10' };
  for (const chain of ['highpass=f=90,afftdn=nr=6:nf=-52:tn=1', 'highpass=f=90']) {
    const a = cleanArgs('/p/land_L_000.0-007.0.mp4', 0.5, 6, chain, m, '/s/land_0000500_006000.wav');
    const measured = measureArgs('/p/land_L_000.0-007.0.mp4', 0.5, 6, chain);
    assert.equal(at(a, '-ss'), at(measured, '-ss'));
    assert.equal(at(a, '-t'), at(measured, '-t'));
    const af = at(a, '-af');
    const cutAndChain = at(measured, '-af').replace(/,loudnorm=.*$/, '');
    assert.ok(af.startsWith(`${cutAndChain},loudnorm=`), af);
    assert.match(af, /loudnorm=I=-17:TP=-2:LRA=11:measured_I=-24\.10:.*linear=true,afade=t=in:st=0:d=0\.012,afade=t=out:st=5\.970:d=0\.03$/);
    assert.equal(at(a, '-ar'), '48000');
    assert.equal(at(a, '-ac'), '2');
    assert.equal(a[a.length - 1], '/s/land_0000500_006000.wav');
  }
});
