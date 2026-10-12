import fs from 'node:fs';
import path from 'node:path';

/** Scripts are run through npm, so the working directory is the edit folder. */
export const EDIT_DIR = process.cwd();
/** The film project is the folder above edit/. A kit that is run where it sits in the skill's repo has none, and keeps its output in out/. */
export const PROJECT: string | null = fs.existsSync(path.join(EDIT_DIR, '..', 'sources')) ? path.resolve(EDIT_DIR, '..') : null;
export const OUT = path.join(EDIT_DIR, 'out');
/** Where the finished film goes: next to film-project/. */
export const FOOTAGE = PROJECT ? path.resolve(PROJECT, '..') : OUT;

/** A folder of the film project (or of out/ when there is no project), created if missing. */
export function dir(name: 'logs' | 'review' | 'audio' | 'notes' | 'versions', ...sub: string[]): string {
  const d = path.join(PROJECT ?? OUT, name, ...sub);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** A folder under out/, created if missing. out/ holds working files that can always be deleted. */
export function out(...sub: string[]): string {
  const d = path.join(OUT, ...sub);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
