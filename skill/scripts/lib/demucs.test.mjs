import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { demucsModel } from './demucs.mjs';

const tempHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'f2f-demucs-'));
const touch = (...parts) => {
  const file = path.join(...parts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  return file;
};

test('without the model nothing is found, and both places it could be are named', () => {
  const home = tempHome();
  const m = demucsModel({}, home);
  assert.equal(m.found, null);
  assert.deepEqual(m.places, [
    path.join(home, '.cache', 'huggingface', 'hub', 'models--adefossez--HTDemucs', 'snapshots', '<snapshot>', '955717e8.safetensors'),
    path.join(home, '.cache', 'torch', 'hub', 'checkpoints', '955717e8-8726e21a.th'),
  ]);
  fs.rmSync(home, { recursive: true });
});

test('Demucs 4.1 keeps its model in the Hugging Face cache: the weights and the list that names them', () => {
  const home = tempHome();
  const snapshot = path.join(home, '.cache', 'huggingface', 'hub', 'models--adefossez--HTDemucs', 'snapshots', 'abc123');
  const weights = touch(snapshot, '955717e8.safetensors');
  assert.equal(demucsModel({}, home).found, null); // half a download is not the model
  touch(snapshot, 'htdemucs.yaml');
  assert.equal(demucsModel({}, home).found, weights);
  fs.rmSync(home, { recursive: true });
});

test('earlier versions keep it in torch\'s cache', () => {
  const home = tempHome();
  const file = touch(home, '.cache', 'torch', 'hub', 'checkpoints', '955717e8-8726e21a.th');
  assert.equal(demucsModel({}, home).found, file);
  fs.rmSync(home, { recursive: true });
});

test('the caches are looked for where the usual variables put them', () => {
  const home = tempHome();
  const hub = touch(home, 'hub', 'models--adefossez--HTDemucs', 'snapshots', 's', '955717e8.safetensors');
  touch(home, 'hub', 'models--adefossez--HTDemucs', 'snapshots', 's', 'htdemucs.yaml');
  assert.equal(demucsModel({ HF_HUB_CACHE: path.join(home, 'hub') }, home).found, hub);
  assert.equal(demucsModel({ HF_HOME: home }, home).found, hub);
  const torch = touch(home, 'torch', 'hub', 'checkpoints', '955717e8-8726e21a.th');
  assert.equal(demucsModel({ TORCH_HOME: path.join(home, 'torch') }, home).found, torch);
  assert.equal(demucsModel({ XDG_CACHE_HOME: home }, home).found, torch);
  fs.rmSync(home, { recursive: true });
});
