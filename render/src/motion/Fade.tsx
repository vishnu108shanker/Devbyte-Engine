import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface FadeProps {
  children: React.ReactNode;
  /** Frame to start fading in */
  from?: number;
  /** Duration of the fade-in in frames */
  duration?: number;
  /** If true, never fades out */
  inOnly?: boolean;
  /** Frame to start fading out (defaults to auto near end) */
  fadeOutAt?: number;
}

/**
 * Fade primitive — wraps children in a transparent container.
 * Uses a plain <div> with display:block so it NEVER collapses height.
 */
export const Fade: React.FC<FadeProps> = ({
  children,
  from = 0,
  duration = 12,
  inOnly = true,
  fadeOutAt,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [from, from + duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  let finalOpacity = opacity;
  if (!inOnly && fadeOutAt !== undefined) {
    const outOpacity = interpolate(
      frame,
      [fadeOutAt, fadeOutAt + duration],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    finalOpacity = Math.min(opacity, outOpacity);
  }

  return <div style={{ opacity: finalOpacity }}>{children}</div>;
};
