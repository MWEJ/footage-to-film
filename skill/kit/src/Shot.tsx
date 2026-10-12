import React from 'react';
import { staticFile, useCurrentFrame } from 'remotion';
import { Audio } from '@remotion/media';
import { mediaAt } from './crop';
import { FPS } from './grid';
import { MixContext } from './mix';
import { fileFor } from './sources';
import { speechFileFor } from './speech';
import { theme } from './theme';
import type { ShotLayer } from './types';
import { VideoEl } from './VideoEl';

/** A video layer. Lives inside a Sequence, so frame 0 is the shot's first frame. */
export const Shot: React.FC<{ layer: ShotLayer }> = ({ layer }) => {
  const t = useCurrentFrame() / FPS;
  const file = fileFor(layer);
  const { box, clipPath, opacity } = mediaAt(layer, t, file.w / file.h, theme.motion);
  const [x, y, w, h] = layer.rect;
  // A speech shot belongs to the dialogue, a shot with natural sound to the natural sound. Either is muted when its group is off.
  const mix = React.useContext(MixContext);
  const audio = layer.audio ?? 'off';
  const sounds = audio !== 'off' && file.audio && mix[audio === 'speech' ? 'dialogue' : 'natural'];
  // A spoken shot that npm run speech has cleaned plays that file in place of its clip's own sound. It was cut at the same in-point.
  const cleaned = audio === 'speech' ? speechFileFor(layer) : null;
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, overflow: 'hidden', clipPath, opacity, borderRadius: layer.radius ?? 0 }}>
        <VideoEl
          src={staticFile(`mezz/${file.file}`)}
          // Picture and sound start at the same in-point, so lip sync holds by construction. In-points between frames are passed through.
          trimBefore={(layer.in - file.a) * FPS}
          rate={layer.speed ?? 1}
          muted={!sounds || cleaned !== null}
          volume={layer.gain ?? 1}
          style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      </div>
      {sounds && cleaned ? <Audio src={staticFile(`speech/${cleaned}`)} volume={layer.gain ?? 1} /> : null}
    </>
  );
};
