import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportRanges, ffmpegArgs, fileName, parseFileName, plan, sizeFor, snapFps, videoFilter } from './convert.mjs';

const LAND = { id: 'land', file: 'land.mov', duration: 8, fps: 30, w: 1920, h: 1080, portrait: false, transfer: 'bt709' };
const PORT = { id: 'IMG_5608', file: 'IMG_5608.MOV', duration: 31.27, fps: 59.94, w: 2160, h: 3840, portrait: true, transfer: 'arib-std-b67' };
const INVENTORY = { clips: [LAND, PORT, { ...LAND, id: 'pq', file: 'pq.mov', transfer: 'smpte2084' }], photos: [] };

test('snapFps turns a phone frame rate into the round rate it stands for', () => {
  assert.equal(snapFps(29.97), 30);
  assert.equal(snapFps(59.94), 60);
  assert.equal(snapFps(23.976), 24);
  assert.equal(snapFps(25), 25);
  assert.equal(snapFps(20), 20);
});

test('sizeFor scales portrait clips to 1080 wide and landscape to 1920 wide, never up, and keeps full size for F', () => {
  assert.deepEqual(sizeFor(PORT, 'P'), [1080, 1920]);
  assert.deepEqual(sizeFor(PORT, 'F'), [2160, 3840]);
  assert.deepEqual(sizeFor({ w: 3840, h: 2160 }, 'L'), [1920, 1080]);
  assert.deepEqual(sizeFor({ w: 1280, h: 720 }, 'L'), [1280, 720]);
  assert.deepEqual(sizeFor({ w: 720, h: 1280 }, 'P'), [720, 1280]);
});

test('exportRanges adds handles, snaps outwards to tenths, and stays inside the clip', () => {
  assert.deepEqual(exportRanges([[11, 31]], 40), [[10.5, 31.5]]);
  assert.deepEqual(exportRanges([[0.2, 3]], 10), [[0, 3.5]]);
  assert.deepEqual(exportRanges([[5, 9.8]], 10.04), [[4.5, 10]]);
  assert.deepEqual(exportRanges([[1.23, 2.31]], 10), [[0.7, 2.9]]);
});

test('exportRanges merges ranges that touch or overlap once the handles are on, and keeps others apart', () => {
  assert.deepEqual(exportRanges([[2.6, 4], [1, 2]], 10), [[0.5, 4.5]]);
  assert.deepEqual(exportRanges([[1, 2], [5, 6]], 10), [[0.5, 2.5], [4.5, 6.5]]);
});

test('file names carry the id, tier and range, and parse back even when the id has underscores', () => {
  const name = fileName('IMG_5608', 'P', 10.5, 31.5);
  assert.equal(name, 'IMG_5608_P_010.5-031.5.mp4');
  assert.deepEqual(parseFileName(name), { id: 'IMG_5608', tier: 'P', a: 10.5, b: 31.5 });
  assert.deepEqual(parseFileName('a_P_b_L_000.0-007.0.mp4'), { id: 'a_P_b', tier: 'L', a: 0, b: 7 });
  assert.equal(parseFileName('notes.txt'), null);
  assert.equal(parseFileName('IMG_5608_P_010.5-031.5.mp4.tmp.mp4'), null);
});

test('the filter sends HLG through the colour table and always ends by tagging BT.709', () => {
  const hlg = videoFilter({ fps: 60, w: 1080, h: 1920, hlg: true });
  assert.match(hlg, /^fps=60,scale=1080:1920:/);
  assert.match(hlg, /in_color_matrix=bt2020.*lut3d=file=hlg2sdr_f\.cube:interp=tetrahedral/);
  const sdr = videoFilter({ fps: 30, w: 1920, h: 1080, hlg: false });
  assert.doesNotMatch(sdr, /lut3d/);
  for (const f of [hlg, sdr]) assert.match(f, /format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv$/);
});

test('the ffmpeg arguments cut the range, put a keyframe every half second, tag BT.709 twice, and keep sound optional', () => {
  const a = ffmpegArgs({ src: '/f/land.mov', tmp: '/p/x.tmp.mp4', a: 0.5, b: 7, fps: 30, w: 1920, h: 1080, hlg: false });
  const at = (flag) => a[a.indexOf(flag) + 1];
  assert.equal(at('-ss'), '0.500');
  assert.equal(at('-t'), '6.500');
  assert.equal(at('-g'), '15');
  assert.equal(at('-bsf:v'), 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1');
  assert.equal(at('-color_trc'), 'bt709');
  assert.ok(a.includes('0:a:0?'));
  assert.ok(a.indexOf('-ss') < a.indexOf('-i'), 'seek before the input, so it is fast and exact');
  assert.equal(a[a.length - 1], '/p/x.tmp.mp4');
});

test('plan makes one job per merged range and tier', () => {
  const { jobs, problems } = plan({ clips: [{ clip: 'land', a: 0.5, b: 6.5 }, { clip: 'IMG_5608', a: 11, b: 31, full: true }] }, INVENTORY, '/f');
  assert.deepEqual(problems, []);
  assert.deepEqual(jobs.map((j) => j.file), ['land_L_000.0-007.0.mp4', 'IMG_5608_P_010.5-031.2.mp4', 'IMG_5608_F_010.5-031.2.mp4']);
  const p = jobs[1];
  assert.deepEqual([p.w, p.h, p.fps, p.hlg, p.src], [1080, 1920, 60, true, '/f/IMG_5608.MOV']);
  assert.equal(jobs[0].hlg, false);
});

test('plan does not ask for a full-resolution file when the clip is no larger than the normal one', () => {
  const { jobs } = plan({ clips: [{ clip: 'land', a: 1, b: 2, full: true }] }, INVENTORY, '/f');
  assert.deepEqual(jobs.map((j) => j.tier), ['L']);
});

test('plan reports selects it cannot export, naming the clip', () => {
  const { jobs, problems } = plan({ clips: [{ clip: 'nope', a: 0, b: 1 }, { clip: 'land', a: 5, b: 12 }, { clip: 'land', a: 3, b: 3 }, { clip: 'pq', a: 0, b: 1 }] }, INVENTORY, '/f');
  assert.deepEqual(jobs, []);
  assert.match(problems[0], /names clip nope, which is not in the inventory/);
  assert.match(problems[1], /clip land: the range ends at 12 s, but the clip is 8\.00 s long/);
  assert.match(problems[2], /clip land: 3 to 3 s is not a range/);
  assert.match(problems[3], /clip pq is PQ HDR/);
});
