// Checks the edit without rendering anything.   npm run check
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../film.config';
import { FACES } from '../src/faces';
import { BEAT, SECONDS, onGrid } from '../src/grid';
import { STEMS } from '../src/music';
import { SOURCES, fileFor } from '../src/sources';
import { checkEdit } from './lib/checks';
import { faceFindings } from './lib/faces';
import { EDIT_DIR } from './lib/paths';

async function main(): Promise<void> {
  // Imported here, so that a theme that cannot be resolved, or a section that cannot be loaded, is reported as a failed check.
  await import('../src/theme');
  const { ALL, EDIT } = await import('../src/edit');
  const findings = checkEdit(EDIT, SOURCES, { SECONDS, BEAT, onGrid }, config.music !== null);
  findings.push(...faceFindings(EDIT, SOURCES, FACES));

  // The media files themselves, through the links in public/.
  const files = new Set<string>();
  for (const l of ALL) {
    if (l.kind === 'shot') {
      try {
        files.add(`mezz/${fileFor(l).file}`);
      } catch {
        // already reported by checkEdit
      }
    }
    if (l.kind === 'photo' && SOURCES.photos[l.name]) files.add(`photos/${SOURCES.photos[l.name].file}`);
    // The message below names the effect: public/audio/sfx/<name>.wav.
    if (l.kind === 'sfx') files.add(`audio/sfx/${l.name}.wav`);
  }
  if (config.music) files.add(`audio/${config.music.file}`);
  if (config.music?.stems) for (const s of STEMS) files.add(`audio/${config.music.stems}/${s}.wav`);
  for (const s of config.sections) {
    if ((s.music === 'no-vocals' || s.music === 'bed') && !config.music?.stems) {
      findings.push({ level: 'FAIL', where: `section ${s.id}`, what: `asks for music: '${s.music}', which needs the song's stems: run the skill's music-stems.mjs and set music.stems in film.config.ts` });
    }
  }
  for (const f of files) {
    if (!fs.existsSync(path.join(EDIT_DIR, 'public', f))) {
      findings.push({ level: 'FAIL', where: 'files', what: `public/${f} does not exist; run npm run link, then look in the film project's sources and audio folders` });
    }
  }

  for (const f of findings) console.log(`${f.level}  ${f.where}: ${f.what}`);
  const fails = findings.filter((f) => f.level === 'FAIL').length;
  const notes = findings.length - fails;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (fails > 0) {
    console.log(`CHECK FAIL (${plural(fails, 'problem')}, ${plural(notes, 'note')})`);
    process.exit(1);
  }
  const count = (kind: string) => ALL.filter((l) => l.kind === kind).length;
  console.log(`CHECK PASS (${plural(EDIT.length, 'section')}, ${plural(count('shot'), 'shot')}, ${plural(count('photo'), 'photo')}, ${plural(count('el'), 'element')}, ${plural(notes, 'note')})`);
}

main().catch((e) => {
  console.log(`FAIL  edit: ${e instanceof Error ? e.message : String(e)}`);
  console.log('CHECK FAIL (the edit could not be loaded)');
  process.exit(1);
});
