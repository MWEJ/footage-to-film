import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONTS } from './fontTable';
import { PRESETS, luma, resolveTheme } from './theme';

test('the three first themes resolve to what they were', () => {
  const house = resolveTheme('house');
  assert.equal(house.name, 'house');
  assert.deepEqual(house.font, { display: 'Instrument Serif', label: 'Jost', hand: 'Caveat' });
  assert.deepEqual([house.displayEm, house.displayItalic, house.displayWeight, house.handEm, house.handWeight, house.labelEm], [0.46, true, 400, 0.4, 600, 0.62]);
  assert.deepEqual([house.color.bg, house.color.text, house.color.accent], ['#0B1D3A', '#F7F1E5', '#F4A259']);
  assert.equal(resolveTheme('paper').displayEm, 0.55);
  const night = resolveTheme('night');
  assert.deepEqual([night.displayEm, night.displayItalic, night.handEm, night.handWeight], [0.4, false, 0.56, 400]);
});

test('every preset is complete, readable and never taken for a black frame', () => {
  for (const name of Object.keys(PRESETS)) {
    const t = resolveTheme(name);
    for (const c of [t.color.bg, t.color.text, t.color.accent, ...t.color.party]) assert.match(c, /^#[0-9A-Fa-f]{6}$/, `${name}: ${c}`);
    assert.ok(t.color.party.length >= 4, `${name}: party colours`);
    // The final checks call a frame black when its pixels are at about 3% brightness or less (8 of 255).
    assert.ok(luma(t.color.bg) > 12, `${name}: backdrop ${t.color.bg} is too close to black`);
    assert.ok(Math.abs(luma(t.color.text) - luma(t.color.bg)) > 120, `${name}: text does not stand out from the backdrop`);
    assert.ok(Math.abs(luma(t.color.accent) - luma(t.color.bg)) > 60, `${name}: the accent does not stand out from the backdrop`);
    assert.ok(t.margin >= 0.05 && t.margin <= 0.1, name);
    for (const f of [t.font.display, t.font.label, t.font.hand]) assert.ok(FONTS[f], `${name}: ${f}`);
  }
});

test('a film can change a preset: colours, fonts and shape', () => {
  const t = resolveTheme({ base: 'paper', name: 'ours', color: { accent: '#2A7F86' }, font: { display: 'Playfair Display' }, radius: 0, motion: { rise: 0.5 } });
  assert.equal(t.name, 'ours');
  assert.equal(t.color.accent, '#2A7F86');
  assert.equal(t.color.bg, PRESETS.paper.color.bg);
  assert.equal(t.font.display, 'Playfair Display');
  assert.equal(t.font.label, 'DM Sans');
  assert.deepEqual([t.displayEm, t.displayWeight, t.displayItalic], [FONTS['Playfair Display'].em, FONTS['Playfair Display'].weight, true]);
  assert.equal(t.radius, 0);
  assert.deepEqual(t.motion, { ...PRESETS.paper.motion, rise: 0.5 });
  assert.equal(resolveTheme({ color: { accent: '#FFFFFF' } }).font.display, 'Instrument Serif'); // no base: house
  assert.equal(resolveTheme({ base: 'night' }).name, 'night');
});

test('a new backdrop gets a scrim and a glow that suit it, unless the film gives its own', () => {
  const dark = resolveTheme({ base: 'paper', color: { bg: '#102A43', text: '#F0F4F8' } });
  assert.match(dark.color.scrim, /^rgba\(\d+,\d+,\d+,0\.66\)$/);
  assert.equal(dark.color.glow, 'rgba(255,255,255,0.07)');
  const light = resolveTheme({ base: 'house', color: { bg: '#FDF6EC', text: '#1F2933' } });
  assert.equal(light.color.scrim, 'rgba(253,246,236,0.88)');
  assert.equal(resolveTheme({ base: 'house', color: { bg: '#102A43', scrim: 'rgba(0,0,0,0.5)' } }).color.scrim, 'rgba(0,0,0,0.5)');
});

test('a look that cannot work is refused, with what to do', () => {
  assert.throws(() => resolveTheme('beach'), /no theme "beach"; the kit has: house, paper, night, coast, postcard, fiesta, candy, hearth/);
  assert.throws(() => resolveTheme({ base: 'nope' }), /no theme "nope"/);
  assert.throws(() => resolveTheme({ font: { display: 'Pacifco' } }), /no font "Pacifco".*The kit has: .*Pacifico.*components\.md/s);
  assert.throws(() => resolveTheme({ color: { text: '#22304A' } }), /text #22304A does not stand out from the backdrop #0B1D3A/);
  assert.throws(() => resolveTheme({ color: { bg: '#050505' } }), /backdrop #050505 is so dark that the final checks would take it for a black frame/);
  assert.throws(() => resolveTheme({ color: { accent: 'teal' } }), /accent "teal" is not a colour of the form #RRGGBB/);
});

test('a font that was added but not yet measured is refused, with what to run', () => {
  const fonts = { ...FONTS, Lobster: { weight: 400 } as unknown as (typeof FONTS)[string] };
  assert.throws(() => resolveTheme({ font: { display: 'Lobster' } }, fonts), /the font "Lobster" has not been measured yet; run npm run fonts/);
  assert.equal(resolveTheme({ font: { display: 'Pacifico' } }, fonts).font.display, 'Pacifico');
});

test('there are eight presets, and no two share a backdrop or a display face', () => {
  assert.deepEqual(Object.keys(PRESETS), ['house', 'paper', 'night', 'coast', 'postcard', 'fiesta', 'candy', 'hearth']);
  const all = Object.values(PRESETS);
  assert.equal(new Set(all.map((p) => p.color.bg)).size, 8);
  assert.equal(new Set(all.map((p) => p.font.display)).size, 8);
});
