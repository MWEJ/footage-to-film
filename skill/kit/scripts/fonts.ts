// Measures font families in the browser and writes src/fonts.json.   npm run fonts [-- --all]
// Without --all it measures only the families that fonts.json lists without an "em".
import fs from 'node:fs';
import path from 'node:path';
import { openBrowser, selectComposition } from '@remotion/renderer';
import { EDIT_DIR } from './lib/paths';
import { makeBundle } from './lib/stills';

type Entry = { em?: number; caps?: number; italic?: boolean; weight?: number };

async function main(): Promise<void> {
  const file = path.join(EDIT_DIR, 'src', 'fonts.json');
  const table = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Entry>;
  const all = process.argv.includes('--all');
  const wanted = Object.keys(table).filter((f) => all || table[f].em === undefined);
  if (wanted.length === 0) {
    console.log(`FONTS_OK  ${Object.keys(table).length} families, 0 measured: ${file}`);
    return;
  }
  const serveUrl = await makeBundle();
  const browser = await openBrowser('chrome');
  let measured: Record<string, Required<Entry>>;
  try {
    // The probe downloads every family it measures from Google's font servers, so it gets longer than the default 30 s.
    const comp = await selectComposition({ serveUrl, id: 'Probe', inputProps: {}, envVariables: { REMOTION_PROBE: wanted.join('|') }, puppeteerInstance: browser, timeoutInMilliseconds: 120000 });
    measured = (comp.props as { fonts: Record<string, Required<Entry>> }).fonts;
  } finally {
    await browser.close({ silent: true });
  }
  const missing = wanted.filter((f) => !measured[f]);
  if (missing.length > 0) throw new Error(`fonts.ts has no loader for ${missing.join(', ')}: add the import and the line in FAMILIES`);
  for (const f of wanted) table[f] = measured[f];
  const lines = Object.entries(table).map(([f, e]) => ` ${JSON.stringify(f)}: ${JSON.stringify(e).replace(/([:,])/g, '$1 ').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`);
  fs.writeFileSync(file, `{\n${lines.join(',\n')}\n}\n`);
  for (const f of wanted) console.log(`  ${f}: em ${measured[f].em}, caps ${measured[f].caps}, weight ${measured[f].weight}${measured[f].italic ? ', has an italic' : ''}`);
  console.log(`FONTS_OK  ${Object.keys(table).length} families, ${wanted.length} measured: ${file}`);
}

main().catch((e) => {
  console.error(`FONTS FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
