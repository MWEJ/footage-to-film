/** A moment the final checks take a still of: just after a cut, or while a text element is up. */
export type Mark = { t: number; what: string; cut: boolean };

/**
 * One entry per still. Cuts that start within `window` seconds of the first of a group (a row of panels arriving
 * one after another) share one still, taken after the last of them, when the whole row is on screen.
 * Text marks are never merged: each one is there to be read.
 */
export function groupMarks(marks: Mark[], window = 0.2): { t: number; what: string[] }[] {
  const groups: { first: number; t: number; what: string[] }[] = [];
  for (const m of marks.filter((x) => x.cut).sort((x, y) => x.t - y.t)) {
    const last = groups[groups.length - 1];
    if (last && m.t - last.first <= window + 1e-9) {
      last.t = m.t;
      last.what.push(m.what);
    } else {
      groups.push({ first: m.t, t: m.t, what: [m.what] });
    }
  }
  const texts = marks.filter((x) => !x.cut).map((m) => ({ t: m.t, what: [m.what] }));
  return [...groups.map(({ t, what }) => ({ t, what })), ...texts].sort((x, y) => x.t - y.t);
}
