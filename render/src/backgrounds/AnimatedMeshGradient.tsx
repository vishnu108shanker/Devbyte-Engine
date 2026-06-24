import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Theme } from '../design/theme';

export interface AnimatedMeshGradientProps {
  /** First orb color */
  color1?: string;
  /** Second orb color */
  color2?: string;
  speed?: number;
}

/**
 * Animated Mesh Gradient background.
 * Two radial orbs float around a dark base. Always moving — never static.
 */
export const AnimatedMeshGradient: React.FC<AnimatedMeshGradientProps> = ({
  color1 = Theme.colors.brand.blue,
  color2 = Theme.colors.brand.violet,
  speed = 1,
}) => {
  const frame = useCurrentFrame();

  const x1 = interpolate(Math.sin((frame * speed * 0.7) / 90), [-1, 1], [5, 75]);
  const y1 = interpolate(Math.cos((frame * speed * 0.5) / 90), [-1, 1], [5, 60]);
  const x2 = interpolate(Math.sin((frame * speed * 0.4) / 90 + 2), [-1, 1], [25, 95]);
  const y2 = interpolate(Math.cos((frame * speed * 0.6) / 90 + 1), [-1, 1], [40, 95]);

  return (
    <AbsoluteFill style={{ backgroundColor: Theme.colors.bg }}>
      {/* Orb 1 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at ${x1}% ${y1}%, ${color1}55 0%, transparent 70%)`,
        }}
      />
      {/* Orb 2 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 55% 45% at ${x2}% ${y2}%, ${color2}44 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
