import path from 'node:path';

/** A film title as a file name: characters a file name cannot hold become spaces. */
export function fileTitle(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Film';
}

/** Video bits per second that keep a film of this length under `megabytes`, with 128 kbit/s of sound; and the short side that suits it. */
export function previewRate(seconds: number, megabytes = 24): { video: number; side: number } {
  const video = Math.min(4_000_000, Math.floor((megabytes * 8_000_000 * 0.97) / seconds) - 128_000);
  return { video, side: video >= 900_000 ? 720 : 540 };
}

/** Where the next render goes: "<title>.mp4" the first time, then "<title> (render N).mp4". A finished film is never overwritten unless `replace` is set. */
export function nextFilmPath(folder: string, title: string, exists: (p: string) => boolean, replace = false): string {
  const name = fileTitle(title);
  const first = path.join(folder, `${name}.mp4`);
  if (replace || !exists(first)) return first;
  for (let n = 2; ; n++) {
    const p = path.join(folder, `${name} (render ${n}).mp4`);
    if (!exists(p)) return p;
  }
}
