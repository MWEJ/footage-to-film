import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EDIT_DIR, PROJECT } from './paths';

type Saved = { ffmpeg?: string; ffprobe?: string; whisper?: string; whisperModel?: string };

/** What the skill's tool check found on this Mac, if it has run for this film. */
function saved(): Saved {
  if (!PROJECT) return {};
  try {
    return JSON.parse(fs.readFileSync(path.join(PROJECT, 'logs', 'tools.json'), 'utf8')) as Saved;
  } catch {
    return {};
  }
}

const found = new Map<string, string>();

/** The path of ffmpeg or ffprobe: from logs/tools.json, the FFMPEG or FFPROBE variable, Homebrew's ffmpeg-full, then the PATH. */
export function tool(name: 'ffmpeg' | 'ffprobe'): string {
  const hit = found.get(name);
  if (hit) return hit;
  const candidates = [saved()[name], process.env[name.toUpperCase()], `/opt/homebrew/opt/ffmpeg-full/bin/${name}`, name].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { stdio: 'ignore' });
    if (!r.error && r.status === 0) {
      found.set(name, c);
      return c;
    }
  }
  throw new Error(`${name} was not found (tried ${candidates.join(', ')}). Run the skill's tool check, or set ${name.toUpperCase()}.`);
}

/** whisper.cpp and its model, or null when either is missing. */
export function whisper(): { bin: string; model: string } | null {
  const s = saved();
  const bin = [s.whisper, process.env.WHISPER, 'whisper-cli'].filter((c): c is string => Boolean(c)).find((c) => !spawnSync(c, ['--help'], { stdio: 'ignore' }).error);
  const model = [s.whisperModel, process.env.WHISPER_MODEL, path.join(os.homedir(), '.local/share/whisper.cpp/models/ggml-large-v3-turbo.bin')]
    .filter((c): c is string => Boolean(c))
    .find((c) => fs.existsSync(c));
  return bin && model ? { bin, model } : null;
}

/** Runs a command in the edit folder with no standard input. Appends its output to `log` when given. Throws on a non-zero exit, with the end of what it printed. */
export function run(cmd: string, args: string[], o: { log?: string } = {}): { stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, { cwd: EDIT_DIR, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (o.log) fs.appendFileSync(o.log, `\n$ ${cmd} ${args.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-12).join('\n');
    throw new Error(`${path.basename(cmd)} failed with exit ${r.status}${o.log ? ` (log: ${o.log})` : ''}\n${tail}`);
  }
  return { stdout: r.stdout, stderr: r.stderr };
}

/** Like run, for commands that write binary data to standard output. */
export function runBuffer(cmd: string, args: string[]): Buffer {
  const r = spawnSync(cmd, args, { cwd: EDIT_DIR, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} failed with exit ${r.status}\n${r.stderr.toString().trim().split('\n').slice(-12).join('\n')}`);
  return r.stdout;
}
