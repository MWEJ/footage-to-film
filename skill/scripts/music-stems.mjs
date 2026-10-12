#!/usr/bin/env node
// Splits the film's song into four stems with Demucs, so the mix can take the singing out under speech and thin the song
// where a section asks. The fourth stem is made as the song minus the other three, so the four always sum to the song.
// usage: node music-stems.mjs <footage folder> <file in audio/> [--fetch]
// Demucs fetches its model when it is missing; this script does not let it unless --fetch is given, which is for after
// the user has agreed to the download. Without the model and without --fetch it stops and says what would be fetched.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fail, needProject, project, run, tools } from './lib/common.mjs';
import { MODEL_SOURCE, demucsModel } from './lib/demucs.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const mayFetch = process.argv.includes('--fetch');
const p = project(args[0]);
needProject(p);
const t = tools(p);
const name = args[1];
if (!name) fail('give the music file (a name in film-project/audio/) as the second argument');
const song = path.join(p.audio, name);
if (!fs.existsSync(song)) fail(`${song} does not exist`);
// Checked before Demucs is started at all. With the model there, Demucs runs offline and fetches nothing.
const model = demucsModel();
if (!model.found && !mayFetch) fail(`Demucs's model is not on this Mac (looked for ${model.places.join(' and ')}). Demucs would fetch it from ${MODEL_SOURCE}: ask the user first, then run this again with --fetch. Nothing was split.`);
const demucsEnv = mayFetch ? process.env : { ...process.env, HF_HUB_OFFLINE: '1' };
const demucs = [process.env.DEMUCS, path.join(os.homedir(), '.local/bin/demucs'), 'demucs'].filter(Boolean).find((c) => !spawnSync(c, ['--help'], { stdio: 'ignore' }).error);
if (!demucs) fail('Demucs was not found (tried $DEMUCS, ~/.local/bin/demucs and the PATH)');

const log = path.join(p.logs, 'music-stems.log');
fs.writeFileSync(log, `${new Date().toISOString()}  stems of ${song}\n`);
const outDir = path.join(p.audio, `${path.basename(name, path.extname(name))}.stems`);
const work = path.join(p.logs, 'music-stems-work');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

// Demucs works at 44.1 kHz. Everything is kept as 32-bit float until the end, so nothing clips and nothing is rounded twice.
const at441 = path.join(work, 'song.wav');
run(t.ffmpeg, ['-v', 'error', '-y', '-i', song, '-ar', '44100', '-ac', '2', '-c:a', 'pcm_f32le', at441], { log });
const split = (device) => spawnSync(demucs, ['-n', 'htdemucs', '-d', device, '--float32', '--clip-mode', 'none', '-o', work, at441], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: demucsEnv });
let r = split('mps');
if (r.status !== 0) r = split('cpu');
fs.appendFileSync(log, `${r.stdout ?? ''}${r.stderr ?? ''}`);
const from = path.join(work, 'htdemucs', 'song');
if (r.status !== 0 || !fs.existsSync(path.join(from, 'vocals.wav'))) fail(`Demucs did not produce stems (log: ${log})`);

for (const s of ['vocals', 'drums', 'bass']) run(t.ffmpeg, ['-v', 'error', '-y', '-i', path.join(from, `${s}.wav`), '-ar', '48000', '-c:a', 'pcm_s24le', path.join(outDir, `${s}.wav`)], { log });
// other = the song minus vocals, drums and bass.
const minus = '[1:a][2:a][3:a]amix=inputs=3:normalize=0,aeval=-val(0)|-val(1):c=same[neg];[0:a][neg]amix=inputs=2:normalize=0,aresample=48000[other]';
run(t.ffmpeg, ['-v', 'error', '-y', '-i', at441, '-i', path.join(from, 'vocals.wav'), '-i', path.join(from, 'drums.wav'), '-i', path.join(from, 'bass.wav'), '-filter_complex', minus, '-map', '[other]', '-c:a', 'pcm_s24le', path.join(outDir, 'other.wav')], { log });

// Measured, not assumed: the four stems against the song, and how loud the vocals are in it.
const level = (args) => {
  const m = run(t.ffmpeg, ['-hide_banner', '-nostats', ...args, '-f', 'null', '-'], { log }).stderr.match(/mean_volume: (-?[\d.]+) dB/);
  return m ? Number(m[1]) : -91;
};
const stems = ['vocals', 'drums', 'bass', 'other'].flatMap((s) => ['-i', path.join(outDir, `${s}.wav`)]);
const left = level(['-i', at441, ...stems, '-filter_complex', '[1:a][2:a][3:a][4:a]amix=inputs=4:normalize=0,aeval=-val(0)|-val(1):c=same[neg];[0:a]aresample=48000[s];[s][neg]amix=inputs=2:normalize=0,volumedetect']);
const whole = level(['-i', at441, '-af', 'volumedetect']);
const vocals = level(['-i', path.join(outDir, 'vocals.wav'), '-af', 'volumedetect']);
fs.rmSync(work, { recursive: true, force: true });
if (left - whole > -50) fail(`the stems do not sum to the song: what is left over is ${(left - whole).toFixed(1)} dB under it`);
console.log(`SONG_STEMS_OK  ${outDir}  (the four sum to the song within ${(left - whole).toFixed(1)} dB; the vocals are ${(whole - vocals).toFixed(1)} dB under it)`);
