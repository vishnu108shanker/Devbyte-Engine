import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const RepoTitle: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in over the first 1 second
  const opacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 150,
        width: '100%',
        textAlign: 'center',
        fontSize: 65,
        color: '#e7e7e7',
        fontFamily: "'Inter', sans-serif",
        fontWeight: 'bold',
        opacity,
        textShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#3794FF', marginRight: 20 }}>
        <svg width="60" height="60" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
        </svg>
      </span>
      {title}
    </div>
  );
};
