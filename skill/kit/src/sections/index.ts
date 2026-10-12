// Every section module, by id. film.config.ts decides which are used, and where on the timeline.
import type { Layer } from '../types';
import * as example from './example';

export const SECTIONS: Record<string, { layers: Layer[] }> = { example };
