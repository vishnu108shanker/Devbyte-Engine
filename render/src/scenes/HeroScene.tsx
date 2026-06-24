import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Theme } from '../design/theme';
import { AnimatedMeshGradient } from '../backgrounds/AnimatedMeshGradient';
import { Grid } from '../backgrounds/Grid';
import { Fade } from '../motion/Fade';
import { Slide } from '../motion/Slide';

export interface HeroSceneProps {
  title: string;
  subtitle: string;
  category: string;
}

/**
 * HeroScene — legacy scene. Kept for compatibility.
 * The new FreeAlternative template does not use this directly.
 */
export const HeroScene: React.FC<HeroSceneProps> = ({ title, subtitle, category }) => {
  return (
    <AbsoluteFill>
      <AnimatedMeshGradient />
      <Grid />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.lg }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Theme.spacing.md }}>
          <Fade from={0} duration={12}>
            <div style={{
              fontFamily: Theme.font.mono,
              fontSize: Theme.size.eyebrow,
              color: Theme.colors.brand.violet,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}>
              {category.replace(/_/g, ' ')}
            </div>
          </Fade>
          <Fade from={8} duration={15}>
            <Slide from={8} direction="up" distance={60}>
              <h1 style={{
                fontFamily: Theme.font.sans,
                fontSize: Theme.size.hero,
                fontWeight: Theme.weight.black,
                color: Theme.colors.text.primary,
                textAlign: 'center',
                lineHeight: 1.1,
                margin: 0,
              }}>
                {title}
              </h1>
            </Slide>
          </Fade>
          <Fade from={20} duration={12}>
            <p style={{
              fontFamily: Theme.font.sans,
              fontSize: Theme.size.body,
              color: Theme.colors.text.secondary,
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.4,
            }}>
              {subtitle}
            </p>
          </Fade>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
