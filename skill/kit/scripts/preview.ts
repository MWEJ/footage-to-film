// A small copy of a finished film, for sending to someone who is not at this Mac.   npm run preview [-- "<film>"]
// At most 24 MB (what a chat attachment takes), 720 pixels on the short side, or 540 when the film is long.
import fs from 'node:fs';
import path from 'node:path';
import { previewRate } from './lib/names';
import { dir, out } from './lib/paths';
import { run, tool } from './lib/tools';

function main(): void {
  const given = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const last = path.join(out(), 'last-film.txt');
  const film = given ? path.resolve(given) : fs.existsSync(last) ? fs.readFileSync(last, 'utf8').trim() : '';
  if (!film || !fs.existsSync(film)) throw new Error(film ? `${film} does not exist` : 'there is no film to make a preview of: run npm run film first, or pass the file');
  const seconds = Number(run(tool('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', film]).stdout.trim());
  const { video, side } = previewRate(seconds);
  if (video < 150_000) throw new Error(`the film is ${Math.round(seconds / 60)} minutes long: too long for a preview of 24 MB`);
  const file = path.join(dir('review'), 'preview.mp4');
  if (path.resolve(file) === path.resolve(film)) throw new Error(`${film} is the preview itself; pass a finished film`);
  const log = path.join(dir('logs'), 'preview.log');
  fs.writeFileSync(log, `${new Date().toISOString()}  preview of ${film}\n`);
  // The short side becomes `side`; the other follows and is kept even.
  const scale = `scale='if(gt(iw,ih),-2,${side})':'if(gt(iw,ih),${side},-2)'`;
  run(tool('ffmpeg'), ['-v', 'error', '-y', '-i', film, '-vf', scale, '-c:v', 'libx264', '-preset', 'medium', '-b:v', String(video), '-maxrate', String(Math.round(video * 1.3)), '-bufsize', String(video * 2), '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', file], { log });
  const size = JSON.parse(run(tool('ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file]).stdout).streams[0];
  console.log(`PREVIEW_OK  ${file}  (${size.width}x${size.height}, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

try {
  main();
} catch (e) {
  console.error(`PREVIEW FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
