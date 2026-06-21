import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const CodePanel: React.FC<{ text: string, title?: string }> = ({ text, title = "script.ts" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Scroll up over the duration
  const translateY = interpolate(
    frame,
    [0, durationInFrames],
    [50, -600],
    { extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 350,
        left: 90,
        width: 900,
        height: 1000,
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
        border: '1px solid #3c3c3c',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* VS Code Tab Bar */}
      <div
        style={{
          height: 50,
          backgroundColor: '#252526',
          borderBottom: '1px solid #3c3c3c',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            backgroundColor: '#1e1e1e',
            color: '#e7e7e7',
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            padding: '10px 20px',
            borderTop: '2px solid #3794FF',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <span style={{ color: '#519aba', marginRight: 8 }}>{'{}'}</span>
          {title}
        </div>
      </div>
      
      {/* Code Container */}
      <div style={{ flex: 1, padding: 30, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `translateY(${translateY}px)` }}>
          <SyntaxHighlighter
            language="typescript"
            style={vscDarkPlus}
            customStyle={{ backgroundColor: 'transparent', margin: 0, padding: 0, fontSize: 30, lineHeight: 1.7, fontFamily: "'Fira Code', monospace" }}
            wrapLines={true}
            wrapLongLines={true}
          >
            {text}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};
