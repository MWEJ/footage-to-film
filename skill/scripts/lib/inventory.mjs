/** An EXIF or QuickTime date, "2026:09:19 10:21:33-04:00". `offset` is used when the value has no zone of its own. Without any zone the time is kept as written and ordered as if it were UTC. */
export function parseExifDate(value, offset = null) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?/);
  if (!m) return null;
  const [, year, month, day, hour, minute, second, zone] = m;
  let off = zone ?? offset ?? null;
  if (off === 'Z') off = '+00:00';
  if (off && /^[+-]\d{4}$/.test(off)) off = `${off.slice(0, 3)}:${off.slice(3)}`;
  const local = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const epoch = Date.parse(`${local}${off ?? 'Z'}`) / 1000;
  return Number.isFinite(epoch) ? { local, offset: off, epoch } : null;
}

/** "30000/1001" as a number; 0 when it cannot be read. */
export function fpsOf(fraction) {
  const [n, d] = String(fraction).split('/').map(Number);
  return d ? n / d : 0;
}

/** Width and height as displayed. A phone stores a vertical clip sideways with a rotation of 90 or 270 degrees. */
export function displaySize(w, h, rotation) {
  return Math.abs(rotation) % 180 === 90 ? [h, w] : [w, h];
}

/**
 * The originals against the inventory. `sizeOf` gives a file's size in bytes for a path relative to the footage folder,
 * or null when it is not there; `present` lists the media in the folder now, as relative paths.
 */
export function compareOriginals(inventory, sizeOf, present) {
  const known = [...inventory.clips, ...inventory.photos];
  const missing = [];
  const changed = [];
  for (const x of known) {
    const now = sizeOf(x.file);
    if (now === null) missing.push(x.file);
    else if (typeof x.bytes === 'number' && now !== x.bytes) changed.push({ file: x.file, was: x.bytes, now });
  }
  const files = new Set(known.map((x) => x.file));
  return { missing, changed, added: present.filter((f) => !files.has(f)) };
}

/** Sets `day` and `scene` on each item and returns them in time order. A scene ends at a gap longer than `gapMinutes`, and at midnight. Items without a time come last, in one scene. */
export function assignScenes(items, gapMinutes = 20) {
  const timed = items.filter((x) => x.time).sort((a, b) => a.time.epoch - b.time.epoch);
  let scene = 0;
  let lastEnd = -Infinity;
  let lastDay = null;
  for (const x of timed) {
    const day = x.time.local.slice(0, 10);
    if (day !== lastDay || x.time.epoch - lastEnd > gapMinutes * 60) scene++;
    x.day = day;
    x.scene = scene;
    lastEnd = Math.max(lastEnd, x.time.epoch + (x.duration ?? 0));
    lastDay = day;
  }
  const rest = items.filter((x) => !x.time);
  for (const x of rest) {
    x.day = null;
    x.scene = scene + 1;
  }
  return [...timed, ...rest];
}
