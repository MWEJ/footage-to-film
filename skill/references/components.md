# Layers and components

An edit is data. Each section is a file in `edit/src/sections/` that exports `layers`, an array. Array order is stacking order: later layers draw on top. The film is every section's layers, in the order `film.config.ts` lists the sections. A themed backdrop lies under everything, so a gap shows the backdrop, never black.

Times are timeline seconds. Write them from the beat grid: `T(bar, beat)` gives the seconds of a bar (counted from 1) and a beat (1 to 4, fractions allowed); `BAR` and `BEAT` are the lengths. Rectangles are `[x, y, width, height]` in frame pixels; `W` and `H` are the frame size. All of these come from `../grid`.

```tsx
import { caption } from '../components/caption';
import { BAR, H, T, W } from '../grid';
import { photo, shot } from '../layers';
import type { Layer } from '../types';

const talk = shot({ a: T(1), d: 2 * BAR, clip: 'IMG_5608', in: 11.0, rect: [0, 0, W, H], audio: 'speech' });
export const layers: Layer[] = [talk, ...caption({ shot: talk }), photo({ a: T(3), d: BAR, name: 'IMG_5581', rect: [0, 0, W, H] })];
```

A new section needs three things: its file, a line in `src/sections/index.ts`, and an entry in `film.config.ts` (`{ id, bar, bars }`, with `grid: 'free'` if it is cut to speech and not to the beat). The entry can also say how much of the song plays under it, with `music` (see `music.md`; all but `'full'` and `'off'` need the song's stems):

- `'full'` (the default): the whole song.
- `'no-vocals'`: everything but the singing.
- `'bed'`: no drums and no singing, the bass held back; for a long spoken passage.
- `'off'`: no music.

## Layer types

### `shot({ … })`: a piece of a video clip

| Option | Meaning | Default |
|---|---|---|
| `a`, `d` | start and duration on the timeline, seconds | required |
| `clip` | clip id, a key of `src/sources.json` | required |
| `in` | in-point, seconds in the original clip | required |
| `rect` | where it sits in the frame | required |
| `speed` | 1 is real time, 0.5 is half speed | 1 |
| `focus` | `[x, y, zoom]`: the point of the source (0 to 1) the crop is centred on, and the zoom at the start | `[0.5, 0.5, 1]` |
| `zoomTo` | the end of the move: a zoom, or a `[x, y, zoom]` to drift to | same point, zoom + 0.04 |
| `bump` | a short zoom pulse on the cut, for example 0.05 | none |
| `reveal` | `'up'`, `'down'`, `'left'`, `'right'`, `'fade'`: how it arrives (the side it arrives from) | none (a cut) |
| `exit` | `'up'`, `'down'`, `'left'`, `'right'`, `'fade'`: how it leaves (the side it leaves to) | none (a cut) |
| `revealD`, `exitD` | seconds for the reveal and the exit | from the theme (0.3) |
| `radius` | corner radius, pixels | 0 |
| `full` | use the full-resolution file; for a clip cropped to fill the frame (a vertical clip in a wide film, a landscape clip in a tall one) | false |
| `audio` | `'off'`, `'speech'` (the music ducks under it, and it needs a caption) or `'nat'` (natural sound) | `'off'` |
| `gain` | volume of the clip's sound, 1 is unchanged | 1 |
| `clean` | `false`: a spoken shot keeps its clip's own sound; `npm run speech` leaves it alone | cleaned |
| `free` | allow the start and end to be off the beat | false |
| `faceCheck` | `false` switches off the check for cut faces on this layer | on |

The clip's sound starts at the same in-point as its picture, so lips stay in sync. To hold a shot still, give `zoomTo` the same zoom as `focus`.

### `photo({ … })`: a still photo

`a`, `d`, `rect`, `focus`, `zoomTo`, `bump`, `reveal`, `exit`, `revealD`, `exitD`, `radius`, `free`, `faceCheck` as for a shot, and `name`, a key of `"photos"` in `src/sources.json`.

### `el({ a, d, node })`: anything drawn in React

`node` is a React element. It is mounted inside a sequence, so `useCurrentFrame()` counts from the element's own start. Use `theme` (`../theme`) for colours, fonts and timings, and multiply sizes by `U` (`../grid`) so they scale with the frame. An element that puts words on screen should also pass `tag: 'text'` and `text: [the words]`, so the final checks take a still of it to be read for spelling. A custom caption passes `tag: 'caption'`.

### `sfx({ t, name, gain? })`: a sound effect

Plays `audio/sfx/<name>.wav` from `t`. `gain` is in decibels (−12 by default). The names and when to use them are in `sound.md`. `npm run check` fails for a name that has no file.

## Faces

`faceFocus(clip, t, zoom?)` and `photoFaceFocus(name, zoom?)` (from `../faces`) return a focus centred on the largest face, with room over the head: `focus: faceFocus('IMG_5608', 12.5, 1.3)`. `t` is seconds in the original clip. They return the centre of the picture when no face is known, so they are safe to use before `faces.swift` has run.

`npm run check` fails when a shot or photo shows only part of a face that is at least a tenth of the picture wide (between 15% and 85% of it), at its start, middle or end. A face that the camera itself cut off at the picture's edge is measured by the part that is in the picture. A smaller face is a note. Set `faceCheck: false` on a layer where it is meant.

## House components

Each returns an array of layers: spread it into `layers` with `...`.

| Component | Options | What it makes |
|---|---|---|
| `titleCard` | `a`, `d`, `title`, `kicker?`, `sub?`, `foot?` | a full-frame title on the backdrop: small line, title, line below, rule, foot line |
| `endCard` | `a`, `d`, `lines` (first line large), `note?` (handwritten) | the closing card |
| `lowerThird` | `a`, `d`, `title`, `sub?`, `side?: 'left' \| 'right'` | a name low in the frame, over the picture |
| `chapterTag` | `a`, `d`, `text`, `sub?`, `corner?: 'tl' \| 'tr'` | a small heading in a top corner, over the picture: a day, a place |
| `caption` | `shot`, `say?`, `lines?`, `words?`, `top?` | captions for a spoken shot, one line at a time |
| `panelRow` | `a`, `d`, `panels`, `weights?`, `area?`, `direction?`, `stagger?`, `reveal?`, `exit?` | clips and photos side by side, or stacked |
| `polaroid` | `a`, `d`, `name`, `x`, `y`, `w`, `rotate?`, `caption?`, `focus?` | a photo in a white frame centred at `x`, `y`, with a handwritten caption |
| `handNote` | `a`, `d`, `text`, `x`, `y`, `size?`, `rotate?`, `underline?`, `color?` | a handwritten aside that writes itself in; use sparingly |
| `confetti` | `a`, `d`, `count?`, `seed?`, `shape?`, `rise?`, `colors?` | falling paper for a celebration, the same in every render. `shape`: `'paper'`, `'petal'`, `'snow'`, `'heart'`, `'star'`; `rise: true` sends the pieces up; `colors` defaults to the theme's party colours (snow: white) |
| `flash` | `t`, `d?`, `peak?`, `color?` | a flash of light on a musical drop; put it last so it draws on top |
| `wipeOut`, `wipeIn` | `at`, `d?` (0.45 s) | two panels in the backdrop colour close over the picture and open again: a change of day or place. `wipeOut` goes last in the section that ends at `at`, `wipeIn` last in the section that starts there; the frame is fully covered on both sides of `at` |
| `wordPop` | `a`, `d`, `text`, `x?`, `y?`, `size?`, `rotate?`, `color?` | a big word that pops in over the picture: a toast, a count, a cheer. In the display face, at the centre of the frame and in the accent colour unless told otherwise |
| `route` | `a`, `d`, `stops` (2 to 6 names), `title?` | a full-frame card: the stops of a trip on a line that draws itself |

**`caption`** takes its words from `src/transcripts.json` (word times for the shot's clip) and groups them into lines. To correct what was heard (a name, a misheard word), pass `say`, the line as it should read: its words take their times from the transcript, and a word that was never heard is placed between its neighbours. `lines: [{ s, a, b }]`, with `a` and `b` in timeline seconds, is for when nothing usable was heard. Every `'speech'` shot must have a caption over it; `npm run check` fails otherwise.

**`panelRow`** is how vertical clips sit in a wide film. A panel is `{ clip, in, speed?, audio?, gain?, focus?, zoomTo? }` or `{ photo, focus?, zoomTo? }`. `weights` sets relative widths (`[2, 1, 1]`); `area` is the rectangle the row fills (the whole frame by default). Panels arrive one after another, `stagger` seconds apart, and end together. `direction` is `'columns'` or `'rows'`; by default panels sit side by side in a wide or square frame and stack in a tall one.

## Frame shape and safe area

`film.config.ts` sets `width` and `height`: 1920x1080 (wide), 1080x1920 (tall) or 1080x1080 (square). `FORMAT` (from `../grid`) is `'wide'`, `'tall'` or `'square'`. `SAFE` (from `../theme`) is the area text must stay inside, as pixel insets `{ l, r, t, b }`: the theme's margin on every side, and in a tall frame the top 10% and the bottom 16% of the height, because phone apps cover them. The house components already follow both. In your own elements, place things from `W`, `H` and `SAFE`, not from fixed pixel positions.

## The theme

`theme` (from `../theme`) is the film's look: `theme.color.{bg, glow, text, accent, scrim}` and `theme.color.party` (a list, for confetti and other celebration elements), `theme.font.{display, label, hand}`, `theme.margin` (a fraction of the frame's short side), `theme.gutter` and `theme.radius` (pixels at 1080p; multiply by `U`), `theme.motion.{reveal, fade, rise, stagger}` (seconds), and the numbers of its fonts: `theme.displayEm`, `theme.handEm`, `theme.labelEm` (average glyph widths in ems, for sizing a line to a width), `theme.displayWeight`, `theme.handWeight`, `theme.displayItalic`.

`theme` in `film.config.ts` is a preset's name, or a preset with anything changed.

| Preset | Look | Suits | Faces |
|---|---|---|---|
| `house` | navy, cream and apricot; calm and editorial | milestones, graduations, weddings | Instrument Serif, Jost, Caveat |
| `paper` | light and warm, like a printed album; rounded panels | a family year, a baby's first months | Fraunces, DM Sans, Caveat |
| `night` | near-black and loud, condensed capitals | sport, nights out, concerts | Bebas Neue, Inter, Permanent Marker |
| `coast` | deep teal, warm white and coral | summer trips, anything by the water | DM Serif Display, Josefin Sans, Kalam |
| `postcard` | cream paper, ink and stamp red, a fat poster face | city breaks, road trips | Abril Fatface, Montserrat, Homemade Apple |
| `fiesta` | violet, yellow and pink, round and loud | parties, birthdays | Lilita One, Outfit, Gochi Hand |
| `candy` | soft pink, plum and sweets colours, everything rounded | children's birthdays, small children | Fredoka, Nunito, Shadows Into Light |
| `hearth` | dark green, warm white and gold | Christmas, winter, family gatherings | Playfair Display, Poppins, Caveat |

### A look of the film's own

The presets are starting points. A film can change any part of one:

```ts
theme: { base: 'coast', name: 'our summer', color: { accent: '#FFD166' }, font: { display: 'Pacifico' }, radius: 0 },
```

- `base` is the preset to start from (`house` when left out); `name` is what the looks sheet calls it.
- `color`: any of `bg`, `text`, `accent` (as `#RRGGBB`), `glow`, `scrim` (any CSS colour) and `party` (a list of `#RRGGBB`). Take colours from the footage where you can: the sea, a dress, the balloons. A film that changes `bg` and gives no `scrim` or `glow` gets ones that suit the new backdrop.
- `font`: any of `display`, `label`, `hand`, by family name. The kit has: Abril Fatface, Baloo Two, Bebas Neue, Bungee, Caveat, Cormorant Garamond, DM Sans, DM Serif Display, Fraunces, Fredoka, Gochi Hand, Homemade Apple, Instrument Serif, Inter, Josefin Sans, Jost, Kalam, Lilita One, Montserrat, Nunito, Outfit, Pacifico, Permanent Marker, Playfair Display, Poppins, Quicksand, Righteous, Shadows Into Light, Yellowtail. (Google Fonts calls Baloo Two "Baloo 2".) Each face is drawn at a weight it has, so a face with one weight is never made bold.
- `margin`, `gutter`, `radius`, `motion`: as above.

`npm run check` refuses a look that cannot work, and says what to do: a preset that does not exist, an unknown font, a colour not written as `#RRGGBB`, text that does not stand out from the backdrop, a backdrop so dark that the final checks would take it for a black frame.

### Adding a font

Any Google font can be added to a film, in its `edit/` folder:

1. In `src/fonts.ts`, add `import * as Lobster from '@remotion/google-fonts/Lobster';` and the line `'Lobster': Lobster,` in `FAMILIES`. The module's name is the family's name without spaces. The key must be the family name the module registers, which is almost always the Google name; when it is not (the module `Baloo2` registers `Baloo Two`), `npm run fonts` stops and names the right one.
2. In `src/fonts.json`, add `"Lobster": { "weight": 400 }` (the weight to draw it at).
3. Run `npm run fonts`. It measures the family and fills in its widths.

Then name it in the theme, and read a still: the fit of a line is estimated from the measured width.

### Looking before choosing

- `npm run looks -- 3 15` writes `review/looks/looks_0003.00.jpg` and `looks_0015.00.jpg`: those frames of the film in the film's own look and in every preset, each labelled. Use the times of the title card and of a name over a picture.
- `npm run still -- 3 --theme=fiesta` and `npm run sheet -- 0 12 --theme=fiesta` render in another preset without changing `film.config.ts`.

## Rules that the check enforces

- Every shot's range must be covered by a converted file. The message names what exists.
- Every layer lies inside its section's bars.
- In a section cut on the beat, shots and photos start and end on a half-beat, unless they set `free: true`. Staggered panels are free already.
- Every spoken shot has a caption.
- A shot that plays sound must come from a file that has sound.
- Every sound effect has its file in `film-project/audio/sfx/`.
- No shot or photo cuts through a face that `faces.swift` found (see "Faces").
