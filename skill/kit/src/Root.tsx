import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { loadThemeFonts } from './fonts';
import { FPS, FRAMES, H, W } from './grid';
import { Probe, measureFonts, type Measured } from './Probe';
import { theme } from './theme';

loadThemeFonts(theme);

// `npm run fonts` sets this to the families to measure ("A|B", or "" for all); Studio and renders never see the probe.
const PROBE = typeof process !== 'undefined' && process.env ? process.env.REMOTION_PROBE : undefined;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Film" component={Film} fps={FPS} width={W} height={H} durationInFrames={FRAMES} defaultProps={{ music: true, stamp: false }} />
    {PROBE !== undefined ? (
      <Composition
        id="Probe"
        component={Probe}
        fps={30}
        width={320}
        height={180}
        durationInFrames={1}
        defaultProps={{ fonts: {} as Measured }}
        calculateMetadata={async () => ({ props: { fonts: await measureFonts(PROBE.split('|').filter(Boolean)) } })}
      />
    ) : null}
  </>
);
