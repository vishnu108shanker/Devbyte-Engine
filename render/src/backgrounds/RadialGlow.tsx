import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Theme } from '../design/theme';

/**
 * Radial Glow background — a centered glowing orb.
 * Perfect for hero beats, CTA moments.
 */
export const RadialGlow: React.FC<{
  color?: string;
  intensity?: number;
  from?: number;
  durationFrames?: number;
}> = ({
  color = Theme.colors.brand.blue,
  intensity = 0.3,
  from = 0,
  durationFrames = 30,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - from,
    [0, durationFrames],
    [0, intensity],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${color} 0%, transparent 70%)`,
        opacity,
      }}
    />
  );
};
