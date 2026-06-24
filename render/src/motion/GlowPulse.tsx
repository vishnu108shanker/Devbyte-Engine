import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface GlowPulseProps {
  children: React.ReactNode;
  color?: string;
  minOpacity?: number;
  maxOpacity?: number;
  /** Full pulse cycle in frames */
  period?: number;
}

/**
 * GlowPulse — continuously pulsates a box-shadow glow.
 * Keeps the screen alive. Never static.
 */
export const GlowPulse: React.FC<GlowPulseProps> = ({
  children,
  color = '#3b82f6',
  minOpacity = 0.2,
  maxOpacity = 0.7,
  period = 60,
}) => {
  const frame = useCurrentFrame();

  // Smooth sinusoidal pulse using sin
  const sine = Math.sin((frame / period) * Math.PI * 2);
  const opacity = interpolate(sine, [-1, 1], [minOpacity, maxOpacity]);

  return (
    <div style={{ filter: `drop-shadow(0 0 40px ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')})` }}>
      {children}
    </div>
  );
};
