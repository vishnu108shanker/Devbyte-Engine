import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface SlideProps {
  children: React.ReactNode;
  from?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  damping?: number;
  stiffness?: number;
}

/**
 * Slide primitive — spring-animated translate, no opacity side-effects.
 * Does NOT set width/height so it never collapses parent layouts.
 */
export const Slide: React.FC<SlideProps> = ({
  children,
  from = 0,
  direction = 'up',
  distance = 80,
  damping = 14,
  stiffness = 90,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - from,
    fps,
    config: { damping, stiffness, mass: 0.6 },
  });

  const offset = distance * (1 - progress);

  const translateMap = {
    up:    `translateY(${offset}px)`,
    down:  `translateY(${-offset}px)`,
    left:  `translateX(${offset}px)`,
    right: `translateX(${-offset}px)`,
  };

  return (
    <div style={{ transform: translateMap[direction] }}>
      {children}
    </div>
  );
};
