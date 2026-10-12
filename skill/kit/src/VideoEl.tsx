import React from 'react';
import { OffthreadVideo, getRemotionEnvironment } from 'remotion';
import { Video } from '@remotion/media';

/**
 * One video element.
 * Renders use <Video> from @remotion/media: the same frames as <OffthreadVideo>, 2.4 times faster (measured when the kit was built).
 * Studio uses <OffthreadVideo>, which is a plain HTML5 video element there; its sound plays more cleanly in the live preview.
 * Studio is for judging timing and sound, not frame accuracy or colour.
 */
export const VideoEl: React.FC<{ src: string; trimBefore: number; rate: number; muted: boolean; volume: number; style: React.CSSProperties }> = ({ src, trimBefore, rate, muted, volume, style }) => {
  if (getRemotionEnvironment().isRendering) {
    return <Video src={src} trimBefore={trimBefore} playbackRate={rate} muted={muted} volume={volume} objectFit="fill" style={style} />;
  }
  return <OffthreadVideo src={src} trimBefore={trimBefore} playbackRate={rate} muted={muted} volume={volume} style={{ ...style, objectFit: 'fill' }} />;
};
