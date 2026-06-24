import React from 'react';
import { Theme } from '../design/theme';
import { Scale } from '../motion/Scale';

export interface FeatureChipProps {
  label: string;
  icon?: React.ReactNode;
  from?: number;
}

/** Feature chip badge. */
export const FeatureChip: React.FC<FeatureChipProps> = ({ label, icon, from = 0 }) => (
  <Scale from={from} initialScale={0.8}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 24px',
      backgroundColor: Theme.colors.surfaceHigh,
      border: `1px solid ${Theme.colors.border}`,
      borderRadius: Theme.radius.full,
      color: Theme.colors.text.primary,
      fontFamily: Theme.font.sans,
      fontSize: Theme.size.body,
      fontWeight: Theme.weight.medium,
    }}>
      {icon && <span style={{ color: Theme.colors.brand.blue }}>{icon}</span>}
      <span>{label}</span>
    </div>
  </Scale>
);
