/** One word with its times, in whatever seconds the caller uses (the caption uses seconds in the original clip). */
export type Word = { s: string; a: number; b: number };

/** A word as it is compared: lowercase letters and digits only. */
const plain = (s: string): string => s.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * The words of `said` (a line as it should read) with times taken from `heard` (the transcript's words for the same
 * stretch). Each typed word is matched to the next heard word that reads the same, looking at most `look` words ahead.
 * A typed word that matches nothing (a name whisper got wrong, a word it dropped) is placed between its matched
 * neighbours; unmatched words share that gap evenly. The typed spelling is kept.
 */
export function alignSaid(said: string, heard: Word[], look = 7): Word[] {
  const typed = said.split(/\s+/).filter(Boolean);
  if (typed.length === 0 || heard.length === 0) return [];
  const hit: (number | null)[] = [];
  let next = 0;
  for (const word of typed) {
    let found: number | null = null;
    const want = plain(word);
    for (let k = next; want !== '' && k < Math.min(heard.length, next + look); k++) {
      if (plain(heard[k].s) === want) {
        found = k;
        break;
      }
    }
    hit.push(found);
    if (found !== null) next = found + 1;
  }
  const out: Word[] = [];
  for (let i = 0; i < typed.length; i++) {
    const h = hit[i];
    if (h !== null) {
      out.push({ s: typed[i], a: heard[h].a, b: heard[h].b });
      continue;
    }
    // A run of unmatched words: from the end of the matched word before it to the start of the matched word after it.
    let j = i;
    while (j < typed.length && hit[j] === null) j++;
    const before = i > 0 ? hit[i - 1] : null;
    const after = j < typed.length ? hit[j] : null;
    const t0 = before !== null ? heard[before].b : heard[0].a;
    const t1 = Math.max(t0, after !== null ? heard[after].a : heard[heard.length - 1].b);
    const n = j - i;
    // The ends of the run are the gap's own ends exactly, not sums that may be off in the last digit.
    const at = (r: number): number => (r === 0 ? t0 : r === n ? t1 : t0 + (r / n) * (t1 - t0));
    for (let r = 0; r < n; r++) out.push({ s: typed[i + r], a: at(r), b: at(r + 1) });
    i = j - 1;
  }
  return out;
}
