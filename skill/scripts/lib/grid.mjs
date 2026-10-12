const FONT = '/System/Library/Fonts/Menlo.ttc';

/** The ffmpeg filter for a ten-by-ten grid over a picture: the lines are tenths of its width and height, so a point reads as a focus. */
export function gridFilter(label) {
  const text = (s, x, y) => `drawtext=fontfile=${FONT}:text='${s}':x=${x}:y=${y}:fontsize=h/36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=3`;
  const parts = ['drawgrid=w=iw/10:h=ih/10:t=1:c=white@0.45', 'drawbox=x=iw/2-1:y=0:w=2:h=ih:c=yellow@0.9:t=fill', 'drawbox=x=0:y=ih/2-1:w=iw:h=2:c=yellow@0.9:t=fill'];
  for (let i = 1; i <= 9; i++) parts.push(text(`.${i}`, `w*0.${i}+3`, '3'));
  for (let i = 1; i <= 9; i++) parts.push(text(`.${i}`, '3', `h*0.${i}+3`));
  // Only letters, digits, spaces, dots, dashes and underscores survive in the label: anything else could end the quoted text.
  parts.push(text(label.replace(/[^\p{L}\p{N} ._-]/gu, ''), '6', 'h-th-6'));
  return parts.join(',');
}
