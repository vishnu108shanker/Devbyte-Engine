import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface PopProps {
  children: React.ReactNode;
  delay?: number;
}

/**
 * Reusable Pop (overshoot scale) animation primitive.
 */
export const Pop: React.FC<PopProps> = ({ 
  children, 
  delay = 0
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 10,  // Lower damping = more bouncy overshoot
      stiffness: 150,
      mass: 0.6,
    },
  });

  return (
    <div style={{ transform: `scale(${scale})`, display: 'flex', width: '100%', height: '100%', flexDirection: 'column' }}>
      {children}
    </div>
  );
};
