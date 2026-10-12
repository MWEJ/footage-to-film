// What to export, at what size, under what name, with which ffmpeg arguments. No file is touched here.
import path from 'node:path';

const RATES = [24, 25, 30, 48, 50, 60, 120];
/** The round frame rate a measured one stands for: 29.97 is 30, 59.94 is 60. Converted files have a constant rate. */
export function snapFps(rate) {
  return RATES.find((r) => Math.abs(rate - r) / r < 0.02) ?? Math.max(1, Math.round(rate));
}

const even = (n) => 2 * Math.round(n / 2);
/** Size of a converted file. P: portrait, 1080 wide. L: landscape, 1920 wide. F: the clip's own size. Never scaled up. */
export function sizeFor(clip, tier) {
  if (tier === 'F') return [even(clip.w), even(clip.h)];
  const w = Math.min(tier === 'P' ? 1080 : 1920, clip.w);
  return [even(w), even((clip.h * w) / clip.w)];
}

const tenth = (x) => Math.round(x * 10) / 10;
/**
 * The ranges to export for the selects of one clip: each with a handle before and after, snapped outwards to tenths
 * of a second, kept inside the clip, and merged where they touch. A handle means no shot starts on a file's first sample.
 */
export function exportRanges(ranges, duration, handle = 0.5) {
  const end = Math.floor(duration * 10 + 1e-6) / 10;
  const padded = ranges
    .map(([a, b]) => [Math.max(0, tenth(Math.floor((a - handle) * 10 + 1e-6) / 10)), Math.min(end, tenth(Math.ceil((b + handle) * 10 - 1e-6) / 10))])
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of padded) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-9) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

const stamp = (seconds) => seconds.toFixed(1).padStart(5, '0');
export const fileName = (id, tier, a, b) => `${id}_${tier}_${stamp(a)}-${stamp(b)}.mp4`;

export function parseFileName(name) {
  const m = name.match(/^(.+)_([PFL])_(\d+\.\d)-(\d+\.\d)\.mp4$/);
  return m && !m[1].endsWith('.mp4') && !name.endsWith('.tmp.mp4') ? { id: m[1], tier: m[2], a: Number(m[3]), b: Number(m[4]) } : null;
}

/** The picture chain. HLG goes through the colour table; the table file is named without a path, so run ffmpeg in its folder. */
export function videoFilter({ fps, w, h, hlg }) {
  const tags = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
  if (hlg) {
    return `fps=${fps},scale=${w}:${h}:flags=lanczos:in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp10le,lut3d=file=hlg2sdr_f.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,${tags}`;
  }
  return `fps=${fps},scale=${w}:${h}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p,${tags}`;
}

/**
 * The ffmpeg arguments for one converted file. BT.709 is written three ways (frame properties, the H.264 bitstream,
 * the container), because browsers honour stale HDR tags. A keyframe every half second keeps stills and scrubbing fast.
 */
export function ffmpegArgs(job) {
  return [
    '-hide_banner', '-v', 'error', '-y', '-hwaccel', 'videotoolbox',
    '-ss', job.a.toFixed(3), '-t', (job.b - job.a).toFixed(3), '-i', job.src,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', videoFilter(job),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-g', String(Math.max(1, Math.round(job.fps / 2))),
    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '256k', '-ac', '2', '-ar', '48000',
    '-movflags', '+faststart', job.tmp,
  ];
}

/** Turns the selects into conversion jobs, or into a list of what is wrong with them. Nothing is converted if anything is wrong. */
export function plan(selects, inventory, footage) {
  const problems = [];
  const byId = new Map(inventory.clips.map((c) => [c.id, c]));
  const groups = new Map(); // "id|tier" -> ranges
  for (const s of selects.clips ?? []) {
    const clip = byId.get(s.clip);
    if (!clip) {
      problems.push(`selects.json names clip ${s.clip}, which is not in the inventory`);
      continue;
    }
    if (!(s.b > s.a) || s.a < 0) {
      problems.push(`clip ${s.clip}: ${s.a} to ${s.b} s is not a range`);
      continue;
    }
    if (s.b > clip.duration + 0.05) {
      problems.push(`clip ${s.clip}: the range ends at ${s.b} s, but the clip is ${clip.duration.toFixed(2)} s long`);
      continue;
    }
    if (clip.transfer === 'smpte2084') {
      problems.push(`clip ${s.clip} is PQ HDR, which the colour table does not cover (see references/colour.md)`);
      continue;
    }
    const base = clip.portrait ? 'P' : 'L';
    const tiers = s.full && clip.w > sizeFor(clip, base)[0] ? [base, 'F'] : [base];
    for (const tier of tiers) {
      const key = `${s.clip}|${tier}`;
      groups.set(key, [...(groups.get(key) ?? []), [s.a, s.b]]);
    }
  }
  if (problems.length > 0) return { jobs: [], problems };
  const jobs = [];
  for (const [key, ranges] of groups) {
    const [id, tier] = key.split('|');
    const clip = byId.get(id);
    const [w, h] = sizeFor(clip, tier);
    for (const [a, b] of exportRanges(ranges, clip.duration, selects.handle ?? 0.5)) {
      jobs.push({ id, tier, a, b, w, h, fps: snapFps(clip.fps), hlg: clip.transfer === 'arib-std-b67', src: path.join(footage, clip.file), file: fileName(id, tier, a, b) });
    }
  }
  return { jobs, problems };
}
