import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSilent, parseLoudnorm, secondPass } from './master';

const STDERR = `Input #0, wav, from 'out/mix.wav':
  Duration: 00:00:12.00, bitrate: 1536 kb/s
[Parsed_loudnorm_0 @ 0x600003e0c000]
{
	"input_i" : "-22.47",
	"input_tp" : "-6.05",
	"input_lra" : "3.20",
	"input_thresh" : "-32.60",
	"output_i" : "-14.02",
	"output_tp" : "-1.50",
	"output_lra" : "2.90",
	"output_thresh" : "-24.11",
	"normalization_type" : "dynamic",
	"target_offset" : "0.02"
}
[out#0/null @ 0x600003b0c000] video:0KiB audio:2250KiB subtitle:0KiB other streams:0KiB
`;

test('parseLoudnorm reads the measurement out of what ffmpeg prints', () => {
  const m = parseLoudnorm(STDERR);
  assert.equal(m.input_i, '-22.47');
  assert.equal(m.input_thresh, '-32.60');
  assert.equal(m.target_offset, '0.02');
});

test('parseLoudnorm says so when there is no measurement', () => {
  assert.throws(() => parseLoudnorm('Conversion failed!'), /loudnorm printed no measurement/);
});

test('a silent mix is recognised, so it is not normalised', () => {
  const m = parseLoudnorm(STDERR);
  assert.equal(isSilent(m), false);
  assert.equal(isSilent({ ...m, input_i: '-inf' }), true);
  assert.equal(isSilent({ ...m, input_i: '-70.00' }), true);
});

test('the second pass gets the measurement back and keeps the targets', () => {
  const f = secondPass(parseLoudnorm(STDERR));
  assert.equal(f, 'loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=-22.47:measured_TP=-6.05:measured_LRA=3.20:measured_thresh=-32.60:offset=0.02:linear=true:print_format=summary');
});
