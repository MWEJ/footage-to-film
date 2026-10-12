export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const E = {
  lin: (t: number) => t,
  in2: (t: number) => t * t,
  out2: (t: number) => 1 - (1 - t) * (1 - t),
  in3: (t: number) => t * t * t,
  out3: (t: number) => 1 - Math.pow(1 - t, 3),
  out4: (t: number) => 1 - Math.pow(1 - t, 4),
  io2: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

/** Eased progress 0..1 of time t through the window [a, a + d]. */
export const prog = (t: number, a: number, d: number, ease: (t: number) => number = E.out3): number =>
  ease(clamp((t - a) / d));
