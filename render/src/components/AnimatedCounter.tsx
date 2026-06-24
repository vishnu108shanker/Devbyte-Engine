import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Theme } from '../design/theme';
import { GlassMorphism } from '../effects/GlassMorphism';

export interface AnimatedCounterProps {
  value: number;
  durationFrames?: number;
  from?: number;
  prefix?: string;
  suffix?: string;
}

/** Animated number counter. */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value, durationFrames = 30, from = 0, prefix = '', suffix = '',
}) => {
  const frame = useCurrentFrame();
  const current = interpolate(frame - from, [0, durationFrames], [0, value], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <GlassMorphism padding={Theme.spacing.sm} borderRadius={Theme.radius.md}>
      <span style={{
        fontFamily: Theme.font.mono,
        fontSize: Theme.size.title,
        fontWeight: Theme.weight.bold,
        color: Theme.colors.brand.blue,
      }}>
        {prefix}{Math.floor(current).toLocaleString()}{suffix}
      </span>
    </GlassMorphism>
  );
};
