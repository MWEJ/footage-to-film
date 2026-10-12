import React from 'react';
import { useCurrentFrame } from 'remotion';
import { BEAT, FPS, U } from './grid';

/** Time and bar.beat in the top-left corner, for contact sheets. Large, so it stays readable at a quarter of the size. */
export const Stamp: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const beats = Math.floor(t / BEAT + 1e-6);
  return (
    <div
      style={{
        position: 'absolute',
        right: 24 * U, // the top-right corner: chapter tags and most labels sit on the left
        top: 24 * U,
        padding: `${8 * U}px ${22 * U}px`,
        borderRadius: 12 * U,
        background: 'rgba(0,0,0,0.78)',
        color: '#fff',
        font: `600 ${64 * U}px Menlo, monospace`,
      }}
    >
      {t.toFixed(2)} s · {Math.floor(beats / 4) + 1}.{(beats % 4) + 1}
    </div>
  );
};
