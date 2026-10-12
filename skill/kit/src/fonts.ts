// The fonts the kit can load. Browser only: import this from Root.tsx or Probe.tsx, never from a section, a component or a script.
// To add a Google font: add its import and a line in FAMILIES here, add `"<Family>": { "weight": 400 }` to fonts.json, run `npm run fonts`.
import * as AbrilFatface from '@remotion/google-fonts/AbrilFatface';
import * as Baloo2 from '@remotion/google-fonts/Baloo2';
import * as BebasNeue from '@remotion/google-fonts/BebasNeue';
import * as Bungee from '@remotion/google-fonts/Bungee';
import * as Caveat from '@remotion/google-fonts/Caveat';
import * as CormorantGaramond from '@remotion/google-fonts/CormorantGaramond';
import * as DMSans from '@remotion/google-fonts/DMSans';
import * as DMSerifDisplay from '@remotion/google-fonts/DMSerifDisplay';
import * as Fraunces from '@remotion/google-fonts/Fraunces';
import * as Fredoka from '@remotion/google-fonts/Fredoka';
import * as GochiHand from '@remotion/google-fonts/GochiHand';
import * as HomemadeApple from '@remotion/google-fonts/HomemadeApple';
import * as InstrumentSerif from '@remotion/google-fonts/InstrumentSerif';
import * as Inter from '@remotion/google-fonts/Inter';
import * as JosefinSans from '@remotion/google-fonts/JosefinSans';
import * as Jost from '@remotion/google-fonts/Jost';
import * as Kalam from '@remotion/google-fonts/Kalam';
import * as LilitaOne from '@remotion/google-fonts/LilitaOne';
import * as Montserrat from '@remotion/google-fonts/Montserrat';
import * as Nunito from '@remotion/google-fonts/Nunito';
import * as Outfit from '@remotion/google-fonts/Outfit';
import * as Pacifico from '@remotion/google-fonts/Pacifico';
import * as PermanentMarker from '@remotion/google-fonts/PermanentMarker';
import * as PlayfairDisplay from '@remotion/google-fonts/PlayfairDisplay';
import * as Poppins from '@remotion/google-fonts/Poppins';
import * as Quicksand from '@remotion/google-fonts/Quicksand';
import * as Righteous from '@remotion/google-fonts/Righteous';
import * as ShadowsIntoLight from '@remotion/google-fonts/ShadowsIntoLight';
import * as Yellowtail from '@remotion/google-fonts/Yellowtail';
import { weightFor } from './fontTable';
import type { Theme } from './theme';

type Loaded = { fontFamily: string; waitUntilDone: () => Promise<undefined> };
type Info = { fontFamily: string; subsets: string[]; fonts: Record<string, Record<string, unknown>> };
/** The part of a @remotion/google-fonts module the kit uses. The modules type their weights per family, so the options are loosened here. */
export type FontModule = { loadFont: (style?: never, options?: never) => Loaded; getInfo: () => Info };

export const FAMILIES: Record<string, FontModule> = {
  'Abril Fatface': AbrilFatface,
  'Baloo Two': Baloo2, // Google Fonts calls it "Baloo 2"; the module loads it as "Baloo Two", and that is the name text is drawn in
  'Bebas Neue': BebasNeue,
  'Bungee': Bungee,
  'Caveat': Caveat,
  'Cormorant Garamond': CormorantGaramond,
  'DM Sans': DMSans,
  'DM Serif Display': DMSerifDisplay,
  'Fraunces': Fraunces,
  'Fredoka': Fredoka,
  'Gochi Hand': GochiHand,
  'Homemade Apple': HomemadeApple,
  'Instrument Serif': InstrumentSerif,
  'Inter': Inter,
  'Josefin Sans': JosefinSans,
  'Jost': Jost,
  'Kalam': Kalam,
  'Lilita One': LilitaOne,
  'Montserrat': Montserrat,
  'Nunito': Nunito,
  'Outfit': Outfit,
  'Pacifico': Pacifico,
  'Permanent Marker': PermanentMarker,
  'Playfair Display': PlayfairDisplay,
  'Poppins': Poppins,
  'Quicksand': Quicksand,
  'Righteous': Righteous,
  'Shadows Into Light': ShadowsIntoLight,
  'Yellowtail': Yellowtail,
} as unknown as Record<string, FontModule>;

/** The weights a family has in a style ('normal' or 'italic'). */
export const weightsOf = (m: FontModule, style: string): number[] => Object.keys(m.getInfo().fonts[style] ?? {}).map(Number);

/** Loads a family at the nearest weights it has. Western European and, where the family has it, extended Latin (for names such as Łukasz). */
export function loadFamily(family: string, weights: number[], italic = false): Loaded[] {
  const m = FAMILIES[family];
  if (!m) throw new Error(`fonts.ts has no loader for "${family}"`);
  // Text is drawn in the family named here, so it must be the name the module registers, or the browser falls back to another face.
  const registered = m.getInfo().fontFamily;
  if (registered !== family) throw new Error(`fonts.ts calls a family "${family}", but its module loads it as "${registered}": use "${registered}" in fonts.ts and fonts.json`);
  const subsets = ['latin', 'latin-ext'].filter((s) => m.getInfo().subsets.includes(s));
  const load = (style: string): Loaded => {
    const have = weightsOf(m, style);
    const pick = [...new Set(weights.map((w) => String(weightFor(have, w))))];
    return m.loadFont(style as never, { weights: pick, subsets } as never);
  };
  return italic && weightsOf(m, 'italic').length > 0 ? [load('normal'), load('italic')] : [load('normal')];
}

/** Loads the three families of a theme: the display face (with its italic), the label face at its three weights, the handwriting face. */
export function loadThemeFonts(t: Pick<Theme, 'font' | 'displayWeight' | 'handWeight' | 'displayItalic'>): void {
  loadFamily(t.font.display, [t.displayWeight], t.displayItalic);
  loadFamily(t.font.label, [400, 500, 600]);
  loadFamily(t.font.hand, [t.handWeight]);
}
