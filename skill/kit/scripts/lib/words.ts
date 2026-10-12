/** The words of a text, lowercased, without punctuation. Letters of any alphabet, digits and apostrophes are kept. */
export function words(s: string): string[] {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** A stretch of transcribed speech: its text and its times in seconds. */
export type Heard = { s: string; a: number; b: number };

/** whisper.cpp's JSON output (-oj) as segments. */
export function heardFromWhisper(json: unknown): Heard[] {
  const list = (json as { transcription?: { offsets: { from: number; to: number }; text: string }[] }).transcription ?? [];
  return list.map((x) => ({ s: x.text.trim(), a: x.offsets.from / 1000, b: x.offsets.to / 1000 })).filter((x) => x.s.length > 0);
}

/** Everything heard in segments that overlap the window from a to b. */
export const heardIn = (heard: Heard[], a: number, b: number): string =>
  heard
    .filter((h) => h.b > a && h.a < b)
    .map((h) => h.s)
    .join(' ');

/**
 * Why a caption line was not heard in the final mix, from how much of it is heard in the speech alone (the film without
 * music and effects) and in the clip's own sound. null means that could not be checked.
 */
export function diagnose(r: { speech: number | null; raw: number | null }, need = 0.6): string {
  if (r.speech !== null && r.speech >= need) return 'it is clear without the music, so the music or an effect covers it: lower the music under speech (music: { under: 16 }), or move the effect';
  if (r.raw !== null && r.raw >= need) return 'it is clear in the clip itself but not after cleaning: set clean: false on the shot and run npm run speech again';
  if (r.raw !== null) return 'it is unclear in the recording itself: the caption carries it; choose another take if the line matters';
  return 'it could not be checked further';
}

/** Whether an expected line can be found in what was heard: at least `need` of its words appear in the transcript. */
export function lineFound(expected: string, heard: string, need = 0.6): { found: boolean; ratio: number } {
  const want = words(expected);
  if (want.length === 0) return { found: true, ratio: 1 };
  const have = new Set(words(heard));
  const ratio = want.filter((w) => have.has(w)).length / want.length;
  return { found: ratio >= need, ratio };
}
