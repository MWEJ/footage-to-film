import React from 'react';
import { Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { FPS, toFrame } from './grid';
import { MixContext } from './mix';
import { Photo } from './Photo';
import { Shot } from './Shot';
import type { Layer, SfxLayer } from './types';

const label = (l: Layer): string =>
  l.kind === 'shot' ? `shot ${l.clip}` : l.kind === 'photo' ? `photo ${l.name}` : l.kind === 'sfx' ? `sfx ${l.name}` : (l.text?.[0] ?? 'element');

/** A sound effect: its whole file from the moment it starts, at its gain in decibels. Silent when the effects are off. */
const Sfx: React.FC<{ layer: SfxLayer }> = ({ layer }) => {
  const mix = React.useContext(MixContext);
  return mix.effects ? <Audio src={staticFile(`audio/sfx/${layer.name}.wav`)} volume={10 ** ((layer.gain ?? -12) / 20)} /> : null;
};

/** Turns the edit (an array of layers; later entries draw on top) into Remotion sequences. Starts and ends are rounded to whole frames. */
export const Layers: React.FC<{ layers: Layer[] }> = ({ layers }) => (
  <>
    {layers.map((l, i) => {
      if (l.kind === 'sfx') {
        // No length: the effect rings for as long as its file, past the nominal length that places it in a section.
        return (
          <Sequence key={i} name={label(l)} from={toFrame(l.a)} layout="none">
            <Sfx layer={l} />
          </Sequence>
        );
      }
      const from = toFrame(l.a);
      const duration = Math.max(1, toFrame(l.a + l.d) - from);
      return (
        <Sequence key={i} name={label(l)} from={from} durationInFrames={duration} premountFor={FPS}>
          {l.kind === 'shot' ? <Shot layer={l} /> : l.kind === 'photo' ? <Photo layer={l} /> : l.node}
        </Sequence>
      );
    })}
  </>
);
