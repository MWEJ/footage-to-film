#!/usr/bin/env node
// Transcribes every clip that has sound, with a time for each word. The words go into the edit, where captions are built from them.
// A clip that already has a transcript keeps it; --force transcribes every clip again (for a project transcribed before
// word starts were improved).
// usage: node transcribe.mjs <footage folder> [--language=en] [--force]     (language default: auto-detect)
import fs from 'node:fs';
import path from 'node:path';
import { needProject, pool, project, readJson, runAsync, tools } from './lib/common.mjs';
import { DOUBT, dtwPreset, phrases, wordsFromWhisper } from './lib/transcribe.mjs';

const args = process.argv.slice(2);
const p = project(args[0]);
needProject(p);
const t = tools(p);
const language = (args.find((a) => a.startsWith('--language=')) ?? '--language=auto').split('=')[1];
const force = args.includes('--force');
const inventory = readJson(path.join(p.notes, 'inventory.json'), `run inventory.mjs "${p.footage}" first`);
const log = path.join(p.logs, 'transcribe.log');
fs.writeFileSync(log, `${new Date().toISOString()}  transcripts for ${p.footage}, language ${language}\n`);
const dir = path.join(p.notes, 'transcripts');
const tmp = path.join(p.logs, 'tmp');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });

const withSound = inventory.clips.filter((c) => c.audio);
const results = await pool(withSound, 2, async (clip) => {
  const file = path.join(dir, `${clip.id}.json`);
  if (fs.existsSync(file) && !force) return 'kept';
  const wav = path.join(tmp, `${clip.id}.wav`);
  const base = path.join(tmp, clip.id);
  const a = await runAsync(t.ffmpeg, ['-v', 'error', '-y', '-i', path.join(p.footage, clip.file), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { log });
  if (a.code !== 0) return `failed: ${clip.id}: its sound could not be read`;
  // -ml 1 -sow: one entry per word. -sns: do not write tokens for non-speech sounds.
  // -dtw with -nfa: word times from whisper's alignment. Its plain entry times can be a second early after a silence.
  // whisper prints every entry over and over in this mode, so its output is not written to the log.
  const basic = ['-m', t.whisperModel, '-f', wav, '-l', language, '-of', base, '-ml', '1', '-sow', '-sns', '-np'];
  let timing = 'aligned';
  let w = await runAsync(t.whisper, [...basic, '-ojf', '-nfa', '-dtw', dtwPreset(t.whisperModel)]);
  if (w.code !== 0 || !fs.existsSync(`${base}.json`)) {
    // An unknown model has no alignment preset: fall back to whisper's own, rougher, entry times.
    timing = 'rough';
    w = await runAsync(t.whisper, [...basic, '-oj']);
  }
  fs.appendFileSync(log, `\n${clip.id}: whisper exit ${w.code}, word times ${timing}\n${w.code === 0 ? '' : w.stderr.trim().split('\n').slice(-8).join('\n')}\n`);
  if (w.code !== 0 || !fs.existsSync(`${base}.json`)) return `failed: ${clip.id}: whisper did not finish`;
  const json = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'));
  const words = wordsFromWhisper(json);
  fs.writeFileSync(file, `${JSON.stringify({ clip: clip.id, language: json.result?.language ?? language, timing, text: words.map((x) => x.s).join(' '), words }, null, 1)}\n`);
  fs.rmSync(wav, { force: true });
  fs.rmSync(`${base}.json`, { force: true });
  return 'made';
});

const failed = results.filter((r) => r.startsWith('failed'));
for (const f of failed) console.log(`FAIL  ${f}`);

// One file to read, and the words for the edit.
const forEdit = {};
const md = [
  '# Transcripts',
  '',
  'Times are seconds in the original clip, good to about a fifth of a second. Whisper can invent words where nobody speaks: a phrase marked "doubtful" contains a word it was unsure of. Read those, and any clip without visible speakers, against the frame strips.',
];
let spoken = 0;
let doubtful = 0;
for (const clip of inventory.clips) {
  const file = path.join(dir, `${clip.id}.json`);
  if (!fs.existsSync(file)) continue;
  const tr = JSON.parse(fs.readFileSync(file, 'utf8'));
  md.push('', `## ${clip.id} (${clip.duration.toFixed(1)} s, ${tr.language}${tr.timing === 'rough' ? ', word times rough' : ''})`, '');
  if (tr.words.length === 0) {
    md.push('(no speech found)');
    continue;
  }
  spoken++;
  forEdit[clip.id] = tr.words.map(({ s, a, b }) => ({ s, a, b }));
  for (const ph of phrases(tr.words)) {
    const doubt = ph.p !== undefined && ph.p < DOUBT;
    if (doubt) doubtful++;
    md.push(`- ${ph.a.toFixed(1)} to ${ph.b.toFixed(1)}: ${ph.s}${doubt ? '  **(doubtful)**' : ''}`);
  }
}
const mdFile = path.join(p.notes, 'transcripts.md');
fs.writeFileSync(mdFile, `${md.join('\n')}\n`);
fs.writeFileSync(path.join(p.edit, 'src', 'transcripts.json'), `${JSON.stringify(forEdit)}\n`);

if (failed.length > 0) {
  console.log(`TRANSCRIBE FAIL (${failed.length} of ${withSound.length} clips; log: ${log})`);
  process.exit(1);
}
console.log(`TRANSCRIBE_OK  ${withSound.length} clips with sound, ${spoken} with words, ${doubtful} doubtful phrase${doubtful === 1 ? '' : 's'}, ${inventory.clips.length - withSound.length} silent: ${mdFile}`);
