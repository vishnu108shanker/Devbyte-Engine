import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface GridProps {
  size?: number;
  opacity?: number;
  color?: string;
}

/**
 * Static grid overlay — gives depth and developer aesthetic.
 * Uses inline SVG data URI for maximum compatibility.
 */
export const Grid: React.FC<GridProps> = ({
  size = 72,
  opacity = 0.12,
  color = '255,255,255',
}) => {
  // Build SVG as a string safely
  const strokeColor = `rgba(${color},${opacity})`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<path d="M ${size} 0 L 0 0 0 ${size}" fill="none" stroke="${strokeColor}" stroke-width="0.5"/>`,
    `</svg>`,
  ].join('');

  const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;

  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${encoded}")`,
        backgroundSize: `${size}px ${size}px`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
};
