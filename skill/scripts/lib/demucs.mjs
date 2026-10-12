import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Demucs's default model (htdemucs), about 84 MB. Demucs 4.1 takes it from the Hugging Face hub and keeps it in that
// cache; earlier versions took a .th file from Meta's server and kept it in torch's cache, and 4.1 still reads that one.
export const HF_REPO = 'adefossez/HTDemucs';
export const HF_FILE = '955717e8.safetensors';
export const TORCH_FILE = '955717e8-8726e21a.th';
export const MODEL_SOURCE = `https://huggingface.co/${HF_REPO} (${HF_FILE} and htdemucs.yaml), about 84 MB`;

/**
 * Is Demucs's model on this Mac? `found` is the copy that is there, or null; `places` are the two files looked for.
 * Reads only. With a model found, Demucs can be run with HF_HUB_OFFLINE=1 and will fetch nothing.
 */
export function demucsModel(env = process.env, home = os.homedir()) {
  const cache = env.XDG_CACHE_HOME || path.join(home, '.cache');
  const hub = env.HF_HUB_CACHE || env.HUGGINGFACE_HUB_CACHE || path.join(env.HF_HOME || path.join(cache, 'huggingface'), 'hub');
  const snapshots = path.join(hub, `models--${HF_REPO.replace('/', '--')}`, 'snapshots');
  const torch = path.join(env.TORCH_HOME || path.join(cache, 'torch'), 'hub', 'checkpoints', TORCH_FILE);
  let found = null;
  if (fs.existsSync(snapshots)) {
    for (const s of fs.readdirSync(snapshots).sort()) {
      const weights = path.join(snapshots, s, HF_FILE);
      // The weights alone are half a download: Demucs also reads the list that names them.
      if (fs.existsSync(weights) && fs.existsSync(path.join(snapshots, s, 'htdemucs.yaml'))) found = weights;
    }
  }
  if (!found && fs.existsSync(torch)) found = torch;
  return { found, places: [path.join(snapshots, '<snapshot>', HF_FILE), torch] };
}
