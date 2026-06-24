import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface DarkNoiseProps {
  opacity?: number;
  baseColor?: string;
}

/**
 * Reusable dark noise overlay for texture.
 */
export const DarkNoise: React.FC<DarkNoiseProps> = ({
  opacity = 0.05,
  baseColor = '#09090b',
}) => {
  const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

  return (
    <AbsoluteFill style={{ backgroundColor: baseColor }}>
      <AbsoluteFill
        style={{
          opacity,
          backgroundImage: noiseSvg,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
