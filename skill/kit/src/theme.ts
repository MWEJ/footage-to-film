import { config } from '../film.config';
import { FONTS, type FontInfo } from './fontTable';
import { H, W, safeArea } from './grid';
import type { ThemeSpec } from './types';

/** What a preset states. This file is data and pure functions, so scripts can import it in Node; fonts are loaded in fonts.ts. */
export type Look = {
  // party: the colours of confetti and other celebration elements
  color: { bg: string; glow: string; text: string; accent: string; scrim: string; party: string[] };
  font: { display: string; label: string; hand: string }; // family names, keys of fonts.json
  margin: number; // safe margin, as a fraction of the frame's short side
  gutter: number; // space between panels, px at 1080p
  radius: number; // corner radius of panels, px at 1080p
  motion: { reveal: number; fade: number; rise: number; stagger: number }; // seconds
};

/** A look with the numbers of its fonts filled in. */
export type Theme = Look & {
  name: string;
  displayEm: number; // average glyph width of the display face, in ems: used to size a title to a width
  displayItalic: boolean; // whether the display face has a real italic
  displayWeight: number;
  handEm: number;
  handWeight: number;
  labelEm: number; // average width of the label face's capitals, in ems
};

const calm = { reveal: 0.3, fade: 0.3, rise: 0.4, stagger: 0.08 };
const quick = { reveal: 0.25, fade: 0.25, rise: 0.3, stagger: 0.06 };

export const PRESETS: Record<string, Look> = {
  // The look of the first film: navy, cream and apricot; a serif for titles, a geometric sans for labels, a hand for notes.
  house: {
    color: { bg: '#0B1D3A', glow: 'rgba(46,84,150,0.55)', text: '#F7F1E5', accent: '#F4A259', scrim: 'rgba(6,14,30,0.66)', party: ['#F4A259', '#F7F1E5', '#F6C453', '#E86A92', '#6FB7E9'] },
    font: { display: 'Instrument Serif', label: 'Jost', hand: 'Caveat' },
    margin: 0.06, gutter: 10, radius: 0, motion: calm,
  },
  // Light and warm, like a printed album: a soft serif, a plain sans for labels.
  paper: {
    color: { bg: '#F4EEE2', glow: 'rgba(255,255,255,0.8)', text: '#1E1B18', accent: '#C4532F', scrim: 'rgba(244,238,226,0.88)', party: ['#C4532F', '#1E1B18', '#F6C453', '#E86A92', '#6FB7E9'] },
    font: { display: 'Fraunces', label: 'DM Sans', hand: 'Caveat' },
    margin: 0.06, gutter: 14, radius: 14, motion: calm,
  },
  // Near-black and loud: condensed capitals for titles, a marker for notes.
  night: {
    color: { bg: '#101214', glow: 'rgba(255,255,255,0.07)', text: '#F5F5F2', accent: '#FFD23F', scrim: 'rgba(0,0,0,0.62)', party: ['#FFD23F', '#F5F5F2', '#F6C453', '#E86A92', '#6FB7E9'] },
    font: { display: 'Bebas Neue', label: 'Inter', hand: 'Permanent Marker' },
    margin: 0.06, gutter: 6, radius: 0, motion: quick,
  },
  // Sea and sand: deep teal, warm white, coral. For summer trips and anything by the water.
  coast: {
    color: { bg: '#0F4C5C', glow: 'rgba(120,200,210,0.35)', text: '#FFF6E5', accent: '#FF8A5B', scrim: 'rgba(6,36,44,0.66)', party: ['#FF8A5B', '#FFF6E5', '#FFD166', '#7FD1D9', '#F4A9A0'] },
    font: { display: 'DM Serif Display', label: 'Josefin Sans', hand: 'Kalam' },
    margin: 0.06, gutter: 12, radius: 10, motion: calm,
  },
  // A travel poster on cream paper: ink, stamp red, a fat display face. For city breaks and road trips.
  postcard: {
    color: { bg: '#F1E7D0', glow: 'rgba(255,255,255,0.7)', text: '#23343B', accent: '#C8553D', scrim: 'rgba(241,231,208,0.9)', party: ['#C8553D', '#2A7F86', '#E3A72F', '#23343B', '#8FB9A8'] },
    font: { display: 'Abril Fatface', label: 'Montserrat', hand: 'Homemade Apple' },
    margin: 0.06, gutter: 14, radius: 4, motion: calm,
  },
  // Violet, yellow and pink, round and loud. For parties and birthdays.
  fiesta: {
    color: { bg: '#3A0CA3', glow: 'rgba(247,37,133,0.35)', text: '#FFF8F0', accent: '#FFD60A', scrim: 'rgba(24,6,70,0.66)', party: ['#FFD60A', '#F72585', '#4CC9F0', '#FFF8F0', '#7BF1A8'] },
    font: { display: 'Lilita One', label: 'Outfit', hand: 'Gochi Hand' },
    margin: 0.06, gutter: 8, radius: 18, motion: quick,
  },
  // Soft pink, plum and sweets colours, everything rounded. For children's birthdays and small children.
  candy: {
    color: { bg: '#FFE8EF', glow: 'rgba(255,255,255,0.85)', text: '#3D2C5E', accent: '#E0457B', scrim: 'rgba(255,232,239,0.9)', party: ['#FF5C8A', '#FFC145', '#5BC0EB', '#9BDEAC', '#B388EB'] },
    font: { display: 'Fredoka', label: 'Nunito', hand: 'Shadows Into Light' },
    margin: 0.06, gutter: 16, radius: 28, motion: calm,
  },
  // Dark green, warm white and gold. For Christmas, winter and family gatherings.
  hearth: {
    color: { bg: '#143528', glow: 'rgba(224,176,74,0.22)', text: '#FBF5E6', accent: '#E0B04A', scrim: 'rgba(8,24,18,0.66)', party: ['#E0B04A', '#C8402F', '#FBF5E6', '#7FB69A', '#F2D9A0'] },
    font: { display: 'Playfair Display', label: 'Poppins', hand: 'Caveat' },
    margin: 0.06, gutter: 10, radius: 6, motion: calm,
  },
};

/** Brightness of a "#RRGGBB" colour, 0 to 255. */
export const luma = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const LIGHT = 140; // a backdrop brighter than this takes dark text and a light scrim

/** The full theme for a preset's name, or for a film's own changes to a preset. Throws, saying what to do, for a look that cannot work. */
export function resolveTheme(spec: string | ThemeSpec, fonts: Record<string, FontInfo> = FONTS): Theme {
  const s: ThemeSpec = typeof spec === 'string' ? { base: spec } : spec;
  const baseName = s.base ?? 'house';
  const base = PRESETS[baseName];
  if (!base) throw new Error(`there is no theme "${baseName}"; the kit has: ${Object.keys(PRESETS).join(', ')}. A film can also change one: theme: { base: 'paper', color: { accent: '#2A7F86' } }`);
  const where = `the theme in film.config.ts`;
  const color = { ...base.color, ...s.color };
  for (const [key, value] of [['bg', color.bg], ['text', color.text], ['accent', color.accent], ...color.party.map((c) => ['party', c])] as [string, string][]) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(`${where}: ${key} "${value}" is not a colour of the form #RRGGBB`);
  }
  if (luma(color.bg) <= 12) throw new Error(`${where}: the backdrop ${color.bg} is so dark that the final checks would take it for a black frame; choose a slightly lighter one`);
  if (Math.abs(luma(color.text) - luma(color.bg)) <= 120) throw new Error(`${where}: the text ${color.text} does not stand out from the backdrop ${color.bg}; make one lighter and the other darker`);
  // A film that changes the backdrop without saying how text sits on pictures gets a scrim and a glow that suit the new backdrop.
  if (s.color?.bg !== undefined) {
    const light = luma(color.bg) > LIGHT;
    const [r, g, b] = rgb(color.bg);
    if (s.color.scrim === undefined) color.scrim = light ? `rgba(${r},${g},${b},0.88)` : `rgba(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)},0.66)`;
    if (s.color.glow === undefined) color.glow = light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.07)';
  }
  const font = { ...base.font, ...s.font };
  for (const family of [font.display, font.label, font.hand]) {
    if (!fonts[family]) throw new Error(`${where}: the kit has no font "${family}". The kit has: ${Object.keys(fonts).sort().join(', ')}. Any Google font can be added: see "Adding a font" in the skill's references/components.md`);
    // A family that was added to fonts.json and not yet measured has no widths: every size worked out from it would be NaN.
    if (!(fonts[family].em > 0) || !(fonts[family].caps > 0)) throw new Error(`${where}: the font "${family}" has not been measured yet; run npm run fonts in the edit folder`);
  }
  const d = fonts[font.display];
  const h = fonts[font.hand];
  return {
    name: s.name ?? baseName,
    color,
    font,
    margin: s.margin ?? base.margin,
    gutter: s.gutter ?? base.gutter,
    radius: s.radius ?? base.radius,
    motion: { ...base.motion, ...s.motion },
    displayEm: d.em,
    displayItalic: d.italic,
    displayWeight: d.weight,
    handEm: h.em,
    handWeight: h.weight,
    labelEm: fonts[font.label].caps,
  };
}

// One render can be given another preset through the environment: this is how `npm run looks` shows a film in every look.
const asked = typeof process !== 'undefined' && process.env ? process.env.REMOTION_THEME : undefined;
export const theme: Theme = resolveTheme(asked ? asked : config.theme);

/** The part of this film's frame that text must stay inside, as pixel insets from each edge. */
export const SAFE = safeArea(W, H, theme.margin);
