import React from 'react';
import { Theme } from '../design/theme';

export interface TerminalWindowProps {
  children: React.ReactNode;
  title?: string;
  width?: string | number;
}

/** Terminal window chrome. */
export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  children, title = 'bash', width = '100%',
}) => (
  <div style={{
    width,
    backgroundColor: '#000',
    borderRadius: Theme.radius.lg,
    border: `1px solid ${Theme.colors.border}`,
    overflow: 'hidden',
    fontFamily: Theme.font.mono,
  }}>
    <div style={{ height: 38, backgroundColor: '#111', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: `1px solid rgba(255,255,255,0.05)`, position: 'relative' }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {['#ff5f56','#ffbd2e','#27c93f'].map((c, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: c }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: Theme.font.mono, fontSize: 13, color: Theme.colors.text.muted }}>
        {title}
      </div>
    </div>
    <div style={{ padding: Theme.spacing.md, color: Theme.colors.text.primary, fontSize: 20, lineHeight: 1.5 }}>
      {children}
    </div>
  </div>
);
