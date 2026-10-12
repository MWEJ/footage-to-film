// Where two finished films differ, picture and sound.   npm run compare [-- "<earlier film>" "<later film>"]
// Without files: the films of the two newest versions. Differences are set against what the edit's shot lists say changed.
import fs from 'node:fs';
import path from 'node:path';
import { decodeMono } from './lib/audio';
import { changedFrames, explain, frameRanges, lengthDifference, parseStats, soundRanges } from './lib/compare';
import { clock, diffRows, mergeRanges } from './lib/list';
import { EDIT_DIR, PROJECT, dir, out } from './lib/paths';
import { run, tool } from './lib/tools';
import { listVersions, rowsOfVersion, versionName } from './lib/versions';

type Probe = { width: number; height: number; frames: number; fps: number };

function probe(file: string): Probe {
  const s = JSON.parse(run(tool('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate', '-of', 'json', file]).stdout).streams[0];
  const [n, d] = String(s.r_frame_rate).split('/').map(Number);
  return { width: s.width, height: s.height, frames: Number(s.nb_frames), fps: n / (d || 1) };
}

const span = (r: [number, number][]): string => (r.length === 0 ? 'nowhere' : r.map(([a, b]) => `${clock(a)}-${clock(b)}`).join(', '));
const where = (r: [number, number][]): string => (r.length === 0 ? 'nowhere' : `at ${span(r)}`);

function main(): void {
  const given = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const versions = PROJECT ? listVersions(PROJECT) : [];
  let before: string;
  let after: string;
  if (given.length === 2) [before, after] = given.map((f) => path.resolve(f));
  else if (given.length === 0 && versions.length >= 2) [before, after] = versions.slice(-2).map((v) => v.film);
  else throw new Error(given.length === 0 ? 'there are not two versions to compare yet: pass two film files, or render the film again' : 'pass two film files (the earlier first), or none');
  for (const f of [before, after]) if (!fs.existsSync(f)) throw new Error(`${f} does not exist`);
  const a = probe(before);
  const b = probe(after);
  if (a.width !== b.width || a.height !== b.height) throw new Error(`the films are of different sizes (${a.width}x${a.height} and ${b.width}x${b.height}) and cannot be compared`);

  const ff = tool('ffmpeg');
  const log = path.join(dir('logs'), 'compare.log');
  fs.writeFileSync(log, `${new Date().toISOString()}  ${before} against ${after}\n`);
  // The picture: both films small and grey, one subtracted from the other, measured frame by frame, up to the shorter.
  const small = a.width >= a.height ? `${Math.round((90 * a.width) / a.height / 2) * 2}:90` : `90:${Math.round((90 * a.height) / a.width / 2) * 2}`;
  const graph = `[0:v]scale=${small}:flags=area,format=gray[a];[1:v]scale=${small}:flags=area,format=gray[b];[a][b]blend=all_mode=difference:shortest=1,signalstats,metadata=print:file=-`;
  const stats = parseStats(run(ff, ['-v', 'error', '-i', before, '-i', after, '-lavfi', graph, '-an', '-f', 'null', '-']).stdout);
  const picture = frameRanges(changedFrames(stats), a.fps);
  const sound = soundRanges(decodeMono(before, 8000), decodeMono(after, 8000), 8000);

  // What the edit says changed between the two, when both are versions.
  const vb = versions.find((v) => v.film === before);
  const va = versions.find((v) => v.film === after);
  const expected = vb && va ? diffRows(rowsOfVersion(vb), rowsOfVersion(va)).ranges : null;
  const settings = vb && va && fs.readFileSync(path.join(vb.dir, 'film.config.ts'), 'utf8') !== fs.readFileSync(path.join(va.dir, 'film.config.ts'), 'utf8');
  const all = mergeRanges([...picture, ...sound], 0.3);
  // What only the longer film has is a difference too, judged like the others; it has no pair to show.
  const tail = lengthDifference(a.frames, b.frames, a.fps);
  const longer = b.frames > a.frames ? 'later' : 'earlier';
  const found = tail ? [...all, tail] : all;
  const judged = expected ? explain(found, expected) : null;
  const unexplained = judged ? judged.unexplained : found;
  // One row per part: a difference that reaches past what the edit changed is split there, and each part judged.
  const mark = (r: [number, number][], known: string): { x: number; y: number; known: string }[] => r.map(([x, y]) => ({ x, y, known }));
  const parts = (judged ? [...mark(judged.explained, 'yes'), ...mark(judged.unexplained, '**no**')] : mark(found, 'not known')).sort((p, q) => p.x - q.x);
  const paired = parts.filter((p) => !tail || p.x < tail[0]);
  const beyond = parts.filter((p) => tail && p.x >= tail[0]);

  // The middle frame of every part whose picture differs, before on the left and after on the right.
  const folder = dir('review', 'compare');
  for (const f of fs.readdirSync(folder)) fs.rmSync(path.join(folder, f), { recursive: true, force: true });
  const work = out('compare');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const cellW = a.width >= a.height ? 640 : 360;
  const sheets: string[] = [];
  const index = ['# Where the films differ', '', `Earlier: ${before}`, `Later: ${after}`, '', '| Sheet | Row | Time | Shown at | Picture | Sound | The edit changed here |', '|---|---|---|---|---|---|---|'];
  const PER = 6;
  paired.forEach(({ x, y, known }, i) => {
    const sees = (r: [number, number][]): string => (r.some(([p, q]) => p < y && q > x) ? 'differs' : 'same');
    const pic = picture.find(([p, q]) => p < y && q > x);
    const t = pic ? (Math.max(pic[0], x) + Math.min(pic[1], y)) / 2 : (x + y) / 2;
    const cell = path.join(work, `c_${String(i).padStart(3, '0')}.jpg`);
    run(ff, ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', before, '-ss', t.toFixed(3), '-i', after, '-filter_complex', `[0:v]scale=${cellW}:-2[a];[1:v]scale=${cellW}:-2[b];[a][b]hstack=inputs=2`, '-frames:v', '1', '-q:v', '3', cell], { log });
    index.push(`| pairs_${String(Math.floor(i / PER) + 1).padStart(2, '0')}.jpg | ${(i % PER) + 1} | ${clock(x)}-${clock(y)} | ${clock(t)} | ${sees(picture)} | ${sees(sound)} | ${known} |`);
  });
  for (let s = 0; s * PER < paired.length; s++) {
    const count = Math.min(PER, paired.length - s * PER);
    const file = path.join(folder, `pairs_${String(s + 1).padStart(2, '0')}.jpg`);
    run(ff, ['-v', 'error', '-y', '-framerate', '1', '-start_number', String(s * PER), '-i', path.relative(EDIT_DIR, path.join(work, 'c_%03d.jpg')), '-vf', `tile=1x${count}:padding=6:margin=6:color=0x1a1a1a`, '-frames:v', '1', '-q:v', '3', file], { log });
    sheets.push(file);
  }
  for (const { x, y, known } of beyond) index.push(`| none | | ${clock(x)}-${clock(y)} | | only in the ${longer} film | only in the ${longer} film | ${known} |`);
  const notes: string[] = [];
  if (tail) notes.push(`the films differ in length (${a.frames} and ${b.frames} frames, ${(a.frames / a.fps).toFixed(1)} and ${(b.frames / b.fps).toFixed(1)} s): they were compared frame by frame up to the shorter, and what only the ${longer} film has (${clock(tail[0])}-${clock(tail[1])}) counts as a difference. Where the length changed inside the film, everything after that point differs`);
  if (settings) notes.push('film.config.ts differs between the two versions: a change of theme, music, tempo or sections is not in the shot lists');
  if (!expected) notes.push('at least one of the films has no version, so nothing is known about what the edit changed');
  index.push('', ...notes.map((n) => `- ${n}`));
  const report = path.join(folder, 'compare.md');
  fs.writeFileSync(report, `${index.join('\n')}\n`);

  for (const n of notes) console.log(`NOTE  ${n}`);
  const names = `"${versionName(after)}" against "${versionName(before)}"`;
  const what = [tail ? `the ${longer} film is ${(tail[1] - tail[0]).toFixed(1)} s longer` : '', `the picture differs ${where(picture)}, the sound ${where(sound)}`].filter(Boolean).join('; ');
  if (found.length === 0) console.log(`COMPARE_OK  ${names}: picture and sound are the same throughout`);
  else if (expected && unexplained.length === 0) console.log(`COMPARE_OK  ${names}: ${what}; all of it where the edit changed. ${report}`);
  else console.log(`COMPARE LOOK  ${names}: ${what}; not explained by the edit's shot lists: ${span(unexplained)}. Read ${report} and the pairs beside it`);
}

try {
  main();
} catch (e) {
  console.error(`COMPARE FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
