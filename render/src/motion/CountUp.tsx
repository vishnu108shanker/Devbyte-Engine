import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface CountUpProps {
  to: number;
  from?: number;
  startFrame?: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
  decimals?: number;
}

/**
 * CountUp — animates a number from `from` to `to`.
 * Keeps the screen alive and communicates metrics visually.
 */
export const CountUp: React.FC<CountUpProps> = ({
  to,
  from: startVal = 0,
  startFrame = 0,
  durationFrames = 45,
  prefix = '',
  suffix = '',
  style,
  decimals = 0,
}) => {
  const frame = useCurrentFrame();

  const value = interpolate(
    frame - startFrame,
    [0, durationFrames],
    [startVal, to],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <span style={style}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  );
};
