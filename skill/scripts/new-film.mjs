#!/usr/bin/env node
// Creates film-project/ inside the footage folder: its folders, the edit (a copy of the kit), STATUS.md and README.md.
// Then runs the tool check, which writes logs/tools.json.
// usage: node new-film.mjs <footage folder> [--title "Film title"]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL, fail, project, run } from './lib/common.mjs';

const args = process.argv.slice(2);
const p = project(args[0]);
const at = args.indexOf('--title');
const title = at > 0 && args[at + 1] ? args[at + 1] : 'Untitled film';
// STATUS.md is written once the edit and its packages are in place, so it marks a project that was created completely.
if (fs.existsSync(path.join(p.root, 'STATUS.md'))) fail(`${p.root} already exists, and this script never overwrites a project. Read its STATUS.md and continue from there.`);
if (fs.existsSync(p.root)) {
  // A film-project that this script did not start belongs to someone else's work: a film made with the earlier kit,
  // or by hand. It must never be touched. Only a run of this script that stopped partway (it leaves its log) is finished.
  if (!fs.existsSync(path.join(p.root, 'logs', 'new-film.log'))) {
    const earlier = fs.existsSync(path.join(p.root, 'render')) ? ' It has a render/ folder: a film made with the earlier kit.' : '';
    fail(`${p.root} exists and was not made by this script.${earlier} Nothing was changed. Read references/earlier-kit.md in the skill's folder, and the project's own HANDOFF.md or README.md.`);
  }
  console.log(`NOTE  ${p.root} was started by an earlier run of this script that did not finish. Completing it.`);
}

const kit = path.join(SKILL, 'kit');
if (!fs.existsSync(path.join(kit, 'film.config.ts'))) fail(`the kit is missing at ${kit}`);

for (const d of [p.logs, p.notes, path.join(p.notes, 'transcripts'), p.review, p.mezz, p.photos, path.join(p.root, 'sources', 'speech'), p.audio, p.conversion]) fs.mkdirSync(d, { recursive: true });
const log = path.join(p.logs, 'new-film.log');
fs.writeFileSync(log, `${new Date().toISOString()}  new film in ${p.footage}\n`);
// The sound effects, copied into the project so that a film does not depend on the skill being installed.
fs.cpSync(path.join(SKILL, 'assets', 'sfx'), path.join(p.audio, 'sfx'), { recursive: true });

// The edit: the kit, without its installed packages and working files.
fs.cpSync(kit, p.edit, { recursive: true, filter: (src) => !['node_modules', 'out'].includes(path.basename(src)) });
const configFile = path.join(p.edit, 'film.config.ts');
fs.writeFileSync(configFile, fs.readFileSync(configFile, 'utf8').replace("title: 'Untitled film'", `title: ${JSON.stringify(title)}`));

// Packages. If the kit has them installed, clone them: on this Mac's file system that is instant and takes no extra space,
// and it brings Remotion's browser along, so nothing is downloaded. Otherwise install from the lock file.
const kitModules = path.join(kit, 'node_modules');
const editModules = path.join(p.edit, 'node_modules');
if (!fs.existsSync(path.join(editModules, '.bin', 'remotion'))) {
  fs.rmSync(editModules, { recursive: true, force: true }); // what a run that stopped partway left behind
  if (fs.existsSync(path.join(kitModules, '.bin', 'remotion'))) run('cp', ['-Rc', kitModules, editModules], { log });
  else run('npm', ['ci', '--prefix', p.edit], { log });
}
// Tens of thousands of small files: keep Spotlight from indexing them.
fs.writeFileSync(path.join(editModules, '.metadata_never_index'), '');
run('npm', ['--prefix', p.edit, 'run', 'link'], { log });

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(p.root, 'STATUS.md'),
  `# Status: ${title}

Any session can continue this film from here. Update this file at the end of every step.

## Step
2 of 10 done: the project exists and the tools are checked.

## Decisions
- Format (frame size): 1920x1080, 30 fps
- Length:
- Title and names, spelled exactly:
- Music:
- Leave out:
- Tempo:
- Look (theme): house
- Kind of film:
- Language of the speech:

## Done
- ${today}: project created.

## Next
Step 3: inventory, frame strips and photo sheets, transcripts.

## Open questions
- None yet.
`,
);

fs.writeFileSync(
  path.join(p.root, 'README.md'),
  `# Film project: ${title}

Everything needed to change this film and render it again. The original clips and photos are in the folder above and are never changed.

## Render the film

\`\`\`
cd edit
npm run film
\`\`\`

The film is written to the folder above this one. A later render gets "(render 2)" in its name; nothing is overwritten. \`npm run qc\` then checks it and writes \`logs/qc.md\`. \`edit/README.md\` lists the other commands.

## What is here

| Folder | What it is | Safe to delete? |
|---|---|---|
| \`STATUS.md\` | where the work stands, and what was decided | no |
| \`edit/\` | the edit, as text, and the render tool | no. \`edit/node_modules\` and \`edit/out\` can go; \`npm ci\` restores the first |
| \`sources/\` | the parts of the clips the film uses, converted, and the photos as JPEG | only while the originals are still in the folder above |
| \`audio/\` | the music and the mastered mix | no |
| \`notes/\` | inventory, selects, transcripts, the brief | no |
| \`versions/\` | the edit as it was for each film that was made: text only, small | no |
| \`conversion/\` | the colour table and the exact commands that built \`sources/\` | no |
| \`review/\` | frame strips, contact sheets, stills | yes |
| \`logs/\` | tool output, the final checks | yes |

Before deleting \`sources/\`, check that the original clips and photos still exist.
`,
);

const check = spawnSync('bash', [path.join(SKILL, 'scripts', 'check-tools.sh'), p.footage], { stdio: ['ignore', 'inherit', 'inherit'] });
if (check.status !== 0) fail(`the project was created at ${p.root}, but the tool check failed; fix what it reports and run check-tools.sh "${p.footage}" again`);
console.log(`NEW_FILM_OK  ${p.root}`);
