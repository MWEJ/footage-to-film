import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FONTS, weightFor } from './fontTable';

test('the display and label families of the three first themes keep the widths they had', () => {
  assert.deepEqual(FONTS['Instrument Serif'], { em: 0.46, caps: 0.62, italic: true, weight: 400 });
  assert.equal(FONTS['Fraunces'].em, 0.55);
  assert.equal(FONTS['Bebas Neue'].em, 0.4);
  for (const label of ['Jost', 'DM Sans', 'Inter']) assert.equal(FONTS[label].caps, 0.62, label);
});

test('the two first handwriting faces have their measured widths, so a long note is not cut short', () => {
  // The first numbers (0.32 and 0.52) were judged on short notes; a note of 24 characters in Caveat lost its last letter.
  assert.deepEqual([FONTS['Caveat'].em, FONTS['Caveat'].weight], [0.4, 600]);
  assert.deepEqual([FONTS['Permanent Marker'].em, FONTS['Permanent Marker'].weight], [0.56, 400]);
});

test('every family has plausible numbers', () => {
  for (const [family, f] of Object.entries(FONTS)) {
    assert.ok(f.em > 0.25 && f.em < 0.8, `${family}: em ${f.em}`);
    assert.ok(f.caps > 0.35 && f.caps < 1, `${family}: caps ${f.caps}`);
    assert.equal(typeof f.italic, 'boolean', family);
    assert.ok(f.weight >= 100 && f.weight <= 900, `${family}: weight ${f.weight}`);
  }
});

test('every family in the table has a loader, and every loader a table entry', () => {
  // fonts.ts cannot be imported in Node, so its text is read: each family is a quoted key of FAMILIES.
  const text = fs.readFileSync(path.join(import.meta.dirname, 'fonts.ts'), 'utf8');
  const block = text.slice(text.indexOf('export const FAMILIES'));
  // The object ends at the first line that starts with a closing brace.
  const loaders = [...block.slice(0, block.indexOf('\n}')).matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]).sort();
  assert.deepEqual(loaders, Object.keys(FONTS).sort());
});

test('every family is named as its module registers it, so text is drawn in it and not in a fallback', () => {
  // "Baloo 2" on Google Fonts is registered as "Baloo Two": a key that differs from the module's fontFamily draws nothing in that face.
  const text = fs.readFileSync(path.join(import.meta.dirname, 'fonts.ts'), 'utf8');
  const modules = new Map([...text.matchAll(/^import \* as (\w+) from '@remotion\/google-fonts\/(\w+)';$/gm)].map((m) => [m[1], m[2]]));
  const block = text.slice(text.indexOf('export const FAMILIES'));
  const entries = [...block.slice(0, block.indexOf('\n}')).matchAll(/^\s*'([^']+)': (\w+),/gm)];
  assert.equal(entries.length, Object.keys(FONTS).length);
  for (const [, family, ident] of entries) {
    const mod = modules.get(ident);
    assert.ok(mod, `${family}: no import of ${ident}`);
    const js = fs.readFileSync(path.join(import.meta.dirname, '..', 'node_modules', '@remotion', 'google-fonts', 'dist', 'cjs', `${mod}.js`), 'utf8');
    assert.equal(js.match(/fontFamily: '([^']+)'/)?.[1], family, `${mod}`);
  }
});

test('a face is drawn at a weight it has', () => {
  assert.equal(weightFor([400], 600), 400);
  assert.equal(weightFor([300, 400, 700], 600), 700);
  assert.equal(weightFor([400, 600], 500), 400);
  assert.equal(weightFor([], 500), 500);
});
