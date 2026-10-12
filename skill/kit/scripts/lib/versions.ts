import fs from 'node:fs';
import path from 'node:path';
import type { Row } from './list';

/** A delivered film and the edit that made it. `dir` holds the edit's text and its shot list; never media. */
export type Version = { name: string; dir: string; film: string; made: string; title: string; seconds: number; frames: number; width: number; height: number };

/** A version is named after its film: the file name without its extension. */
export const versionName = (film: string): string => path.basename(film, path.extname(film));

/**
 * Keeps the edit as it is now, beside the name of the film it just made: film.config.ts, the sections, the data files
 * of src/ and the shot list. `root` is the film project. A version of the same name is replaced: its film was replaced too.
 */
export function keepVersion(o: { root: string; editDir: string; film: string; rows: Row[]; listing: string[]; info: Omit<Version, 'name' | 'dir' | 'film' | 'made'>; now?: Date }): Version {
  const name = versionName(o.film);
  const dir = path.join(o.root, 'versions', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.copyFileSync(path.join(o.editDir, 'film.config.ts'), path.join(dir, 'film.config.ts'));
  fs.cpSync(path.join(o.editDir, 'src', 'sections'), path.join(dir, 'src', 'sections'), { recursive: true });
  for (const f of fs.readdirSync(path.join(o.editDir, 'src'))) {
    if (f.endsWith('.json')) fs.copyFileSync(path.join(o.editDir, 'src', f), path.join(dir, 'src', f));
  }
  const version: Version = { name, dir, film: o.film, made: (o.now ?? new Date()).toISOString(), ...o.info };
  fs.writeFileSync(path.join(dir, 'version.json'), `${JSON.stringify({ ...version, dir: undefined }, null, 1)}\n`);
  fs.writeFileSync(path.join(dir, 'shotlist.json'), `${JSON.stringify(o.rows)}\n`);
  fs.writeFileSync(path.join(dir, 'shotlist.md'), `${[`# Shot list of ${name}`, '', ...o.listing].join('\n')}\n`);
  return version;
}

/**
 * Every version of a film project, oldest first. A film is always written to the folder above the project, so its
 * place is taken from there and only its name from the record: a footage folder that was moved still finds its films.
 */
export function listVersions(root: string): Version[] {
  const base = path.join(root, 'versions');
  if (!fs.existsSync(base)) return [];
  const out: Version[] = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const file = path.join(base, entry.name, 'version.json');
    if (!entry.isDirectory() || !fs.existsSync(file)) continue;
    const v = JSON.parse(fs.readFileSync(file, 'utf8')) as Version;
    out.push({ ...v, film: path.join(path.dirname(root), path.basename(v.film)), dir: path.join(base, entry.name) });
  }
  return out.sort((a, b) => a.made.localeCompare(b.made));
}

export const rowsOfVersion = (v: Version): Row[] => JSON.parse(fs.readFileSync(path.join(v.dir, 'shotlist.json'), 'utf8')) as Row[];
