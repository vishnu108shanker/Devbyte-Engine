import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const SubtitleBar: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const words = text.split(' ').filter(w => w.length > 0);
  const WORDS_PER_CHUNK = 4;
  const chunks = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(' '));
  }
  
  if (chunks.length === 0) return null;

  const framesPerChunk = durationInFrames / chunks.length;
  const currentChunkIndex = Math.min(
    Math.floor(frame / framesPerChunk),
    chunks.length - 1
  );
  
  const currentText = chunks[currentChunkIndex];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 150,
        left: 90,
        width: 900,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          backgroundColor: '#1e1e1e',
          border: '1px solid #3c3c3c',
          borderRadius: 12,
          padding: '20px 40px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ color: '#858585', fontSize: 24, fontFamily: "'Inter', sans-serif", marginBottom: 15 }}>
          TERMINAL
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#3794FF', fontSize: 45, marginRight: 20, fontFamily: "'Fira Code', monospace" }}>$</span>
          <span
            style={{
              color: '#d4d4d4', // VS Code default terminal text color
              fontSize: 50,
              fontFamily: "'Fira Code', monospace",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {currentText}
            {/* Blinking cursor effect based on frames */}
            <span style={{ opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0 }}>_</span>
          </span>
        </div>
      </div>
    </div>
  );
};
