import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderFrames, selectComposition } from '@remotion/renderer';
import { PRESETS } from '../../src/theme';
import { EDIT_DIR, out } from './paths';

export type StillOptions = { scale?: number; stamp?: boolean; quality?: number; env?: Record<string, string> };

/** The environment for a render in another preset, from a script's arguments (`--theme=<preset>`); empty when none is asked for. */
export function themeEnv(args: string[]): Record<string, string> {
  const arg = args.find((a) => a.startsWith('--theme='));
  if (!arg) return {};
  const name = arg.slice('--theme='.length);
  if (!PRESETS[name]) throw new Error(`there is no theme "${name}"; the kit has: ${Object.keys(PRESETS).join(', ')}`);
  return { REMOTION_THEME: name };
}

/** Bundles the edit once. The result can be rendered from any number of times. */
export async function makeBundle(): Promise<string> {
  const bundleDir = path.join(out(), 'bundle');
  // The bundler fails with EEXIST on the public/ symlinks if an earlier bundle is still there. rm removes the links, not what they point to.
  fs.rmSync(bundleDir, { recursive: true, force: true });
  return bundle({ entryPoint: path.join(EDIT_DIR, 'src', 'index.ts'), outDir: bundleDir });
}

/**
 * Renders the given frames of the film from a bundle in one call (one browser) and returns each as a JPEG.
 * `env` reaches the page as process.env before the edit's code runs.
 * Frames far apart cost about a second each when the sources have long gaps between keyframes; neighbours cost far less.
 */
export async function renderStillsFrom(serveUrl: string, frames: number[], o: StillOptions = {}): Promise<Map<number, Buffer>> {
  const inputProps = { stamp: o.stamp ?? false, music: false };
  const envVariables = o.env ?? {};
  const got = new Map<number, Buffer>();
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({ serveUrl, id: 'Film', inputProps, envVariables, puppeteerInstance: browser });
    await renderFrames({
      composition,
      serveUrl,
      inputProps,
      envVariables,
      frames: [...new Set(frames)].sort((a, b) => a - b),
      imageFormat: 'jpeg',
      jpegQuality: o.quality ?? 90,
      scale: o.scale ?? 1,
      muted: true,
      outputDir: null,
      puppeteerInstance: browser,
      onStart: () => undefined,
      onFrameUpdate: () => undefined,
      onFrameBuffer: (buffer, frame) => {
        got.set(frame, buffer);
      },
    });
  } finally {
    await browser.close({ silent: true });
  }
  return got;
}

/** Bundles the edit and renders the given frames of the film (one bundle, one browser), each as a JPEG. */
export async function renderStills(frames: number[], o: StillOptions = {}): Promise<Map<number, Buffer>> {
  return renderStillsFrom(await makeBundle(), frames, o);
}
