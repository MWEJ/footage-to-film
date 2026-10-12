// Makes public/mezz, public/photos, public/audio and public/speech point at the film project's folders, so Remotion reads the media where it is.
import fs from 'node:fs';
import path from 'node:path';
import { EDIT_DIR, PROJECT } from './lib/paths';

const LINKS: [name: string, target: string][] = [
  ['mezz', 'sources/mezz'],
  ['photos', 'sources/photos'],
  ['audio', 'audio'],
  ['speech', 'sources/speech'],
];

function main(): void {
  if (!PROJECT) {
    console.error('LINK FAIL  there is no film project above this folder (expected ../sources)');
    process.exit(1);
  }
  const pub = path.join(EDIT_DIR, 'public');
  fs.mkdirSync(pub, { recursive: true });
  for (const [name, target] of LINKS) {
    fs.mkdirSync(path.join(PROJECT, target), { recursive: true });
    const link = path.join(pub, name);
    const rel = path.join('..', '..', target);
    let stat: fs.Stats | null = null;
    try {
      stat = fs.lstatSync(link);
    } catch {
      stat = null;
    }
    if (stat?.isSymbolicLink()) {
      if (fs.readlinkSync(link) === rel) continue;
      fs.unlinkSync(link);
    } else if (stat) {
      console.error(`LINK FAIL  public/${name} exists and is not a link; move it away first`);
      process.exit(1);
    }
    fs.symlinkSync(rel, link);
  }
  console.log(`LINK_OK  public/{${LINKS.map(([n]) => n).join(',')}} point into ${PROJECT}`);
}

main();
