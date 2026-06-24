import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface LightSweepProps {
  children: React.ReactNode;
  duration?: number;
  from?: number;
}

/** Light sweep shimmer effect. */
export const LightSweep: React.FC<LightSweepProps> = ({
  children, duration = 30, from = 0,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - from, [0, duration], [-100, 200], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
      {children}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        transform: `translateX(${progress}%) skewX(-20deg)`,
        width: '50%',
        pointerEvents: 'none',
      }} />
    </div>
  );
};
