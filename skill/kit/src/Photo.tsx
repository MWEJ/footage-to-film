import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { mediaAt } from './crop';
import { FPS } from './grid';
import { SOURCES, photoFor } from './sources';
import { theme } from './theme';
import type { PhotoLayer } from './types';

/** A still-photo layer. Lives inside a Sequence, so frame 0 is the photo's first frame. */
export const Photo: React.FC<{ layer: PhotoLayer }> = ({ layer }) => {
  const t = useCurrentFrame() / FPS;
  const file = photoFor(SOURCES.photos, layer.name);
  const { box, clipPath, opacity } = mediaAt(layer, t, file.w / file.h, theme.motion);
  const [x, y, w, h] = layer.rect;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', clipPath, opacity, borderRadius: layer.radius ?? 0 }}>
      <Img src={staticFile(`photos/${file.file}`)} style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }} />
    </div>
  );
};
