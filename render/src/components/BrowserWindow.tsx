import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Theme } from '../design/theme';

export interface BrowserWindowProps {
  children: React.ReactNode;
  url?: string;
  width?: string | number;
}

/** Browser window chrome mockup. */
export const BrowserWindow: React.FC<BrowserWindowProps> = ({
  children, url = 'https://example.com', width = '100%',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });

  return (
    <div style={{
      width, transform: `scale(${scale})`,
      backgroundColor: Theme.colors.surfaceHigh,
      borderRadius: Theme.radius.lg,
      border: `1px solid ${Theme.colors.border}`,
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{ height: 44, backgroundColor: '#0a0a0d', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: `1px solid ${Theme.colors.border}`, gap: 12 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#ff5f56','#ffbd2e','#27c93f'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: c }} />
          ))}
        </div>
        <div style={{ flex: 1, height: 26, backgroundColor: '#16161a', borderRadius: Theme.radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: Theme.font.mono, fontSize: 14, color: Theme.colors.text.muted }}>
          {url}
        </div>
      </div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
};
