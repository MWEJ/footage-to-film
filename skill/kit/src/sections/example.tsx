// A placeholder. Replace it with the film's own sections and list them in index.ts and in film.config.ts.
// Times are timeline seconds; T(bar, beat) converts from the beat grid. Array order is stacking order: later layers draw on top.
import { titleCard } from '../components/titleCard';
import { T } from '../grid';
import type { Layer } from '../types';

export const layers: Layer[] = [...titleCard({ a: T(1), d: T(5) - T(1), title: 'Untitled film', kicker: 'A film' })];
