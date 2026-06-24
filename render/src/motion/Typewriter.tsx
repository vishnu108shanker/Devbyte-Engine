import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface TypewriterProps {
  text: string;
  from?: number;
  /** Frames per character */
  speed?: number;
  style?: React.CSSProperties;
}

/**
 * Typewriter — reveals text character by character.
 * Classic dev-tool aesthetic. Works inside any layout.
 */
export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  from = 0,
  speed = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const charsToShow = Math.floor(interpolate(
    frame - from,
    [0, text.length * speed],
    [0, text.length],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  ));

  const visible = text.slice(0, charsToShow);
  // Blinking cursor
  const cursorVisible = charsToShow < text.length || Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={style}>
      {visible}
      {cursorVisible && <span style={{ opacity: 0.8 }}>▋</span>}
    </span>
  );
};
