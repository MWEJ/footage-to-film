// The edit as a shot list: what is on screen and heard, when.   npm run list [-- <from seconds> <to seconds>]
// The whole list is also written to notes/shotlist.md.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../film.config';
import { BAR, BEAT, BPM, H, SECONDS, W } from '../src/grid';
import { rowsOf, table } from './lib/list';
import { dir } from './lib/paths';

async function main(): Promise<void> {
  const { EDIT } = await import('../src/edit');
  const nums = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0) || nums.length === 1 || nums.length > 2) {
    console.error('usage: npm run list [-- <from seconds> <to seconds>]');
    process.exit(2);
  }
  const rows = rowsOf(EDIT, { W, H });
  const g = { BAR, BEAT };
  const file = path.join(dir('notes'), 'shotlist.md');
  const head = [`# Shot list: ${config.title}`, '', `${SECONDS.toFixed(2)} s at ${BPM} BPM (a bar is ${BAR.toFixed(3)} s). Times are where a thing starts. Made by \`npm run list\`; do not edit.`, ''];
  fs.writeFileSync(file, `${[...head, ...table(rows, g)].join('\n')}\n`);
  const shown = nums.length === 2 ? rows.filter((r) => r.b > nums[0] && r.a < nums[1]) : rows;
  for (const line of table(shown, g)) console.log(line);
  console.log(`LIST_OK  ${shown.length} row${shown.length === 1 ? '' : 's'}${nums.length === 2 ? ` between ${nums[0]} and ${nums[1]} s (of ${rows.length})` : ''}: ${file}`);
}

main().catch((e) => {
  console.error(`LIST FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
