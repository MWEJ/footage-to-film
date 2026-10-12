// What differs between the edit as it is now and a delivered version.   npm run changes [-- "<version name>"]
// Without a name: the newest version. It compares shot lists, so it sees what the edit says, not what a render shows:
// for that, render the film and run npm run compare.
import fs from 'node:fs';
import path from 'node:path';
import { H, W } from '../src/grid';
import { clock, diffRows, rowsOf } from './lib/list';
import { EDIT_DIR, PROJECT } from './lib/paths';
import { listVersions, rowsOfVersion } from './lib/versions';

async function main(): Promise<void> {
  if (!PROJECT) throw new Error('there is no film project above this folder');
  const versions = listVersions(PROJECT);
  if (versions.length === 0) throw new Error('no version has been kept yet: npm run film keeps one for every film it makes');
  const wanted = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const v = wanted ? versions.find((x) => x.name === wanted) : versions[versions.length - 1];
  if (!v) throw new Error(`there is no version "${wanted}"; there are: ${versions.map((x) => x.name).join(', ')}`);
  const { EDIT } = await import('../src/edit');
  const d = diffRows(rowsOfVersion(v), rowsOf(EDIT, { W, H }));
  for (const r of d.removed) console.log(`  gone   ${clock(r.a)}-${clock(r.b)}  ${r.what}${r.detail ? ` (${r.detail})` : ''}`);
  for (const r of d.added) console.log(`  new    ${clock(r.a)}-${clock(r.b)}  ${r.what}${r.detail ? ` (${r.detail})` : ''}`);
  const settings = fs.readFileSync(path.join(EDIT_DIR, 'film.config.ts'), 'utf8') !== fs.readFileSync(path.join(v.dir, 'film.config.ts'), 'utf8');
  if (settings) console.log('NOTE  film.config.ts differs from that version: a change of theme, music, tempo or sections can alter the whole film without altering a row');
  if (d.ranges.length === 0) console.log(`CHANGES_OK  nothing has changed since "${v.name}"${settings ? ' in the shot list' : ''}`);
  else console.log(`CHANGES_OK  ${d.ranges.length === 1 ? '1 stretch differs' : `${d.ranges.length} stretches differ`} from "${v.name}" (${d.ranges.map(([a, b]) => `${clock(a)}-${clock(b)}`).join(', ')}): ${d.added.length} rows added, ${d.removed.length} removed`);
}

main().catch((e) => {
  console.error(`CHANGES FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
