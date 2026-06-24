import React from 'react';
import { Theme } from '../design/theme';

export interface GlassMorphismProps {
  children: React.ReactNode;
  padding?: number;
  borderRadius?: number;
}

/** Glass morphism container — updated for new theme. */
export const GlassMorphism: React.FC<GlassMorphismProps> = ({
  children,
  padding = Theme.spacing.md,
  borderRadius = Theme.radius.lg,
}) => (
  <div
    style={{
      padding,
      borderRadius,
      backgroundColor: `${Theme.colors.surface}CC`,
      backdropFilter: 'blur(32px)',
      border: `1px solid ${Theme.colors.border}`,
    }}
  >
    {children}
  </div>
);
