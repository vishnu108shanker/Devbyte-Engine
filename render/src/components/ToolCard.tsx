import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Theme } from '../design/theme';

export interface ToolCardProps {
  name: string;
  category: string;
  pricing: string;
}

/** ToolCard — updated for new theme. */
export const ToolCard: React.FC<ToolCardProps> = ({ name, category, pricing }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const ty = (1 - progress) * 50;

  return (
    <div style={{
      transform: `translateY(${ty}px)`,
      opacity: progress,
      backgroundColor: Theme.colors.surface,
      border: `1px solid ${Theme.colors.border}`,
      borderRadius: Theme.radius.md,
      padding: Theme.spacing.sm,
    }}>
      <div style={{ fontFamily: Theme.font.sans, fontSize: Theme.size.heading, fontWeight: Theme.weight.bold, color: Theme.colors.text.primary }}>
        {name}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <span style={{ fontFamily: Theme.font.mono, fontSize: Theme.size.eyebrow, color: Theme.colors.brand.violet, backgroundColor: `${Theme.colors.brand.violet}18`, padding: '4px 12px', borderRadius: Theme.radius.full }}>
          {category}
        </span>
        <span style={{ fontFamily: Theme.font.mono, fontSize: Theme.size.eyebrow, color: pricing === 'free' ? Theme.colors.brand.emerald : Theme.colors.brand.amber, backgroundColor: `rgba(255,255,255,0.05)`, padding: '4px 12px', borderRadius: Theme.radius.full }}>
          {pricing.toUpperCase()}
        </span>
      </div>
    </div>
  );
};
