import path from 'node:path';
import { SKILL, run } from './common.mjs';

/** Converts the project's photos and makes their contact sheets, through uv. Returns the helper's verdict line; throws if it failed. */
export function convertPhotos(p, t, log) {
  const out = run(t.uv, ['run', '--python', '3.12', '--with', 'pillow', '--with', 'pillow-heif', 'python', path.join(SKILL, 'scripts', 'photos.py'), p.footage], { log }).stdout;
  return out.trim().split('\n').pop();
}
