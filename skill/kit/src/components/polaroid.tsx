import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { mediaBox, region, type Focus3 } from '../crop';
import { E, prog } from '../ease';
import { FPS, U } from '../grid';
import { el } from '../layers';
import { SOURCES, photoFor, type PhotoFile } from '../sources';
import { theme } from '../theme';
import type { Focus, Layer } from '../types';

export type PolaroidOptions = { a: number; d: number; name: string; x: number; y: number; w: number; rotate?: number; caption?: string; focus?: Focus };

const Polaroid: React.FC<PolaroidOptions & { file: PhotoFile }> = ({ file, x, y, w, rotate = -4, caption, focus }) => {
  const t = useCurrentFrame() / FPS;
  const pad = w * 0.06;
  const side = w - 2 * pad; // the picture is square
  const h = pad + side + w * 0.2;
  const f: Focus3 = [focus?.[0] ?? 0.5, focus?.[1] ?? 0.5, focus?.[2] ?? 1];
  const box = mediaBox([0, 0, side, side], region([0, 0, side, side], f, file.w / file.h));
  const p = prog(t, 0, 0.35, E.out4);
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, background: '#FBFAF6', boxShadow: `0 ${10 * U}px ${40 * U}px rgba(0,0,0,0.35)`, transform: `rotate(${rotate}deg) scale(${0.9 + 0.1 * p})`, opacity: p }}>
      <div style={{ position: 'absolute', left: pad, top: pad, width: side, height: side, overflow: 'hidden' }}>
        <Img src={staticFile(`photos/${file.file}`)} style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }} />
      </div>
      {caption ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: w * 0.035, textAlign: 'center', fontFamily: theme.font.hand, fontWeight: theme.handWeight, fontSize: w * 0.1, lineHeight: 1.1, color: '#2A2622' }}>{caption}</div>
      ) : null}
    </div>
  );
};

/** A photo in a white instant-film frame, slightly turned, with an optional handwritten caption. x and y are its centre. */
export function polaroid(o: PolaroidOptions): Layer[] {
  const file = photoFor(SOURCES.photos, o.name); // fails here, when the edit is loaded, if the photo does not exist
  return [el({ a: o.a, d: o.d, tag: o.caption ? 'text' : undefined, text: o.caption ? [o.caption] : undefined, node: <Polaroid {...o} file={file} /> })];
}
