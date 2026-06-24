import React from 'react';
import { Theme } from '../design/theme';

export interface GlowProps {
  children: React.ReactNode;
  color?: string;
  size?: number;
  opacity?: number;
}

/** Glow effect wrapper. */
export const Glow: React.FC<GlowProps> = ({
  children,
  color = Theme.colors.brand.blue,
  size = 80,
  opacity = 0.3,
}) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <div
      style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', height: '100%',
        backgroundColor: color,
        filter: `blur(${size}px)`,
        opacity,
        zIndex: -1,
      }}
    />
    <div style={{ position: 'relative' }}>{children}</div>
  </div>
);
