import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface ScaleProps {
  children: React.ReactNode;
  from?: number;
  initialScale?: number;
  damping?: number;
  stiffness?: number;
}

/** Spring-animated scale — never affects layout. */
export const Scale: React.FC<ScaleProps> = ({
  children,
  from = 0,
  initialScale = 0.85,
  damping = 12,
  stiffness = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - from,
    fps,
    config: { damping, stiffness, mass: 0.5 },
  });

  const scale = initialScale + progress * (1 - initialScale);

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {children}
    </div>
  );
};
