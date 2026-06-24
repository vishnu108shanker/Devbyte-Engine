import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Theme } from '../design/theme';
import { AnimatedMeshGradient } from '../backgrounds/AnimatedMeshGradient';
import { Grid } from '../backgrounds/Grid';
import { RadialGlow } from '../backgrounds/RadialGlow';
import { Fade } from '../motion/Fade';
import { Slide } from '../motion/Slide';
import { Scale } from '../motion/Scale';
import { GlowPulse } from '../motion/GlowPulse';
import { Typewriter } from '../motion/Typewriter';
import { CountUp } from '../motion/CountUp';
import { VideoProps } from '../Root';

// ─── Shared Layout Helpers ────────────────────────────────────────────────────

const Row: React.FC<{ children: React.ReactNode; gap?: number; justify?: string; align?: string; width?: string }> = ({
  children, gap = 24, justify = 'flex-start', align = 'center', width = '100%'
}) => (
  <div style={{ display: 'flex', flexDirection: 'row', gap, justifyContent: justify, alignItems: align, width }}>
    {children}
  </div>
);

const Col: React.FC<{ children: React.ReactNode; gap?: number; justify?: string; align?: string; width?: string; height?: string }> = ({
  children, gap = 24, justify = 'flex-start', align = 'flex-start', width = '100%', height = 'auto'
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, justifyContent: justify, alignItems: align, width, height }}>
    {children}
  </div>
);

// ─── Persistent Background ────────────────────────────────────────────────────

const Background: React.FC<{ color1?: string; color2?: string }> = ({ color1, color2 }) => (
  <AbsoluteFill>
    <AnimatedMeshGradient color1={color1} color2={color2} speed={0.8} />
    <Grid size={100} opacity={0.1} />
  </AbsoluteFill>
);

// ─── Pill / Badge ─────────────────────────────────────────────────────────────

const Pill: React.FC<{ label: string; color?: string; bgAlpha?: string; from?: number }> = ({
  label, color = Theme.colors.brand.blue, bgAlpha = '22', from = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: frame - from, fps, config: { damping: 12, stiffness: 120 } });
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: `${color}${bgAlpha}`,
        border: `2px solid ${color}44`,
        borderRadius: Theme.radius.full,
        padding: '12px 32px',
        fontFamily: Theme.font.mono,
        fontSize: Theme.size.body,
        fontWeight: Theme.weight.medium,
        color,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
      {label}
    </div>
  );
};

// ─── Hero Title ───────────────────────────────────────────────────────────────

const HeroTitle: React.FC<{ text: string; from?: number }> = ({ text, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - from, fps, config: { damping: 16, stiffness: 70, mass: 0.8 } });
  const translateY = interpolate(progress, [0, 1], [60, 0]);

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: progress,
        fontFamily: Theme.font.sans,
        fontSize: Theme.size.hero,
        fontWeight: Theme.weight.black,
        lineHeight: 1.05,
        letterSpacing: '-0.03em',
        color: Theme.colors.text.primary,
        textAlign: 'center',
        width: '100%',
      }}
    >
      {text}
    </div>
  );
};

// ─── Subtitle ─────────────────────────────────────────────────────────────────

const Subtitle: React.FC<{ text: string; from?: number }> = ({ text, from = 0 }) => (
  <Fade from={from} duration={18}>
    <Slide from={from + 4} direction="up" distance={40}>
      <p
        style={{
          fontFamily: Theme.font.sans,
          fontSize: Theme.size.heading,
          fontWeight: Theme.weight.regular,
          color: Theme.colors.text.secondary,
          textAlign: 'center',
          lineHeight: 1.5,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {text}
      </p>
    </Slide>
  </Fade>
);

// ─── Divider ──────────────────────────────────────────────────────────────────

const AnimatedDivider: React.FC<{ from?: number; color?: string }> = ({
  from = 0, color = Theme.colors.brand.blue,
}) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame - from, [0, 25], [0, 400], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, width: '100%' }}>
      <div style={{ height: 4, width, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, borderRadius: 4 }} />
    </div>
  );
};

// ─── Feature Bullet ───────────────────────────────────────────────────────────

const FeatureBullet: React.FC<{ icon: string; text: string; from?: number; delay?: number }> = ({
  icon, text, from = 0, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - (from + delay), fps, config: { damping: 14, stiffness: 100 } });
  const tx = interpolate(progress, [0, 1], [-80, 0]);

  return (
    <div
      style={{
        transform: `translateX(${tx}px)`,
        opacity: progress,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 32,
        backgroundColor: Theme.colors.surface,
        border: `2px solid ${Theme.colors.border}`,
        borderRadius: Theme.radius.lg,
        padding: '36px 42px',
        width: '100%',
        boxShadow: `0 10px 40px rgba(0,0,0,0.3)`,
      }}
    >
      <span style={{ fontSize: 60, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <p style={{
        fontFamily: Theme.font.sans,
        fontSize: Theme.size.body,
        fontWeight: Theme.weight.medium,
        color: Theme.colors.text.primary,
        lineHeight: 1.4,
        margin: 0,
      }}>{text}</p>
    </div>
  );
};

// ─── Comparison Bar ───────────────────────────────────────────────────────────

const ComparisonBar: React.FC<{
  label: string; paid: number; free: number; unit: string; from?: number;
}> = ({ label, paid, free, unit, from = 0 }) => {
  const frame = useCurrentFrame();
  const paidWidth = interpolate(frame - from, [0, 40], [0, paid], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const freeWidth = interpolate(frame - (from + 8), [0, 40], [0, free], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Col gap={16} align="stretch" width="100%">
      <Row justify="space-between" width="100%">
        <span style={{ fontFamily: Theme.font.sans, fontSize: Theme.size.body, fontWeight: Theme.weight.medium, color: Theme.colors.text.secondary }}>{label}</span>
      </Row>
      {/* Paid bar */}
      <Row gap={16} align="center" width="100%">
        <span style={{ fontFamily: Theme.font.mono, fontSize: Theme.size.body, color: Theme.colors.brand.rose, width: 140 }}>PAID</span>
        <div style={{ flex: 1, height: 20, backgroundColor: Theme.colors.surfaceHigh, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ width: `${paidWidth}%`, height: '100%', backgroundColor: Theme.colors.brand.rose, borderRadius: 10 }} />
        </div>
        <span style={{ fontFamily: Theme.font.mono, fontSize: Theme.size.body, color: Theme.colors.text.primary, width: 120, textAlign: 'right' }}>
          <CountUp to={paid} startFrame={from} durationFrames={40} suffix={unit} style={{ color: Theme.colors.brand.rose }} />
        </span>
      </Row>
      {/* Free bar */}
      <Row gap={16} align="center" width="100%">
        <span style={{ fontFamily: Theme.font.mono, fontSize: Theme.size.body, color: Theme.colors.brand.emerald, width: 140 }}>FREE</span>
        <div style={{ flex: 1, height: 20, backgroundColor: Theme.colors.surfaceHigh, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ width: `${freeWidth}%`, height: '100%', backgroundColor: Theme.colors.brand.emerald, borderRadius: 10 }} />
        </div>
        <span style={{ fontFamily: Theme.font.mono, fontSize: Theme.size.body, color: Theme.colors.text.primary, width: 120, textAlign: 'right' }}>
          <CountUp to={free} startFrame={from + 8} durationFrames={40} suffix={unit} style={{ color: Theme.colors.brand.emerald }} />
        </span>
      </Row>
    </Col>
  );
};

// ─── CTA Card ─────────────────────────────────────────────────────────────────

const CTACard: React.FC<{ cta: string; from?: number }> = ({ cta, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - from, fps, config: { damping: 12, stiffness: 100 } });
  const scale = interpolate(progress, [0, 1], [0.9, 1]);
  const pulse = Math.sin((frame / 30) * Math.PI * 2);
  const glowOpacity = interpolate(pulse, [-1, 1], [0.4, 0.9]);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity: progress,
        backgroundColor: Theme.colors.brand.blue,
        background: Theme.colors.gradient.brand,
        borderRadius: Theme.radius.lg,
        padding: '60px 80px',
        textAlign: 'center',
        width: '100%',
        boxShadow: `0 0 80px rgba(59,130,246,${glowOpacity * 0.5})`,
      }}
    >
      <p style={{
        fontFamily: Theme.font.sans,
        fontSize: Theme.size.heading,
        fontWeight: Theme.weight.bold,
        color: '#ffffff',
        lineHeight: 1.2,
        margin: 0,
      }}>
        {cta}
      </p>
    </div>
  );
};

// ─── Hashtag Row ──────────────────────────────────────────────────────────────

const HashtagRow: React.FC<{ tags: string[]; from?: number }> = ({ tags, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', width: '100%' }}>
      {tags.slice(0, 5).map((tag, i) => {
        const progress = spring({ frame: frame - (from + i * 4), fps, config: { damping: 14, stiffness: 120 } });
        const ty = interpolate(progress, [0, 1], [30, 0]);
        return (
          <div
            key={tag}
            style={{
              transform: `translateY(${ty}px)`,
              opacity: progress,
              fontFamily: Theme.font.mono,
              fontSize: Theme.size.body,
              fontWeight: Theme.weight.medium,
              color: Theme.colors.brand.violet,
              backgroundColor: `${Theme.colors.brand.violet}18`,
              border: `2px solid ${Theme.colors.brand.violet}33`,
              borderRadius: Theme.radius.full,
              padding: '12px 24px',
            }}
          >
            {tag}
          </div>
        );
      })}
    </div>
  );
};

// ─── Floating Orb Decoration ──────────────────────────────────────────────────

const FloatingOrb: React.FC<{ size: number; x: string; y: string; color: string }> = ({
  size, x, y, color,
}) => {
  const frame = useCurrentFrame();
  const offset = Math.sin((frame / 80) * Math.PI * 2) * 20;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        transform: `translateY(${offset}px)`,
        filter: `blur(${size * 0.15}px)`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── Main Composition: FreeAlternative ────────────────────────────────────────

/**
 * FreeAlternative — complete production template.
 *
 * Scene layout (frame-based, fills the FULL audio duration):
 *   0  – S2   →  SCENE 1: Hook — Bold headline + category pill + animated divider
 *   S2 – S3   →  SCENE 2: Feature bullets — 3 animated bullets from validated_script body
 *   S3 – S4   →  SCENE 3: Comparison — Visual "Paid vs Free" bar chart
 *   S4 – S5   →  SCENE 4: Typewriter — highlights the key quote from body
 *   S5 – END  →  SCENE 5: CTA + Hashtags
 *
 *  Background & ambient animations run for the full duration.
 *  Uses strictly contiguous `<Sequence>` boundaries (no overlap!) to prevent text collisions.
 */
export const FreeAlternative: React.FC<VideoProps> = (props) => {
  const { durationInFrames } = useVideoConfig();

  const toolName   = props.source_title  || 'New AI Tool';
  const hook       = props.hook          || 'This changes everything.';
  const body       = props.body          || 'Amazing AI tool that helps developers.';
  const cta        = props.cta           || 'Try it FREE — link in bio!';
  const category   = (props.category     || 'free_alternative').replace(/_/g, ' ');
  const hashtags   = props.hashtags      || ['#AITools', '#Free', '#Dev'];
  const title      = props.title         || toolName;

  // Split body into up to 3 feature sentences
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3);

  const SCENE_ICONS = ['⚡', '🧠', '🚀'];

  // Scene timing (in frames) - perfectly contiguous and dynamic to audio length
  const S1_START = 0;
  const S2_START = Math.floor(durationInFrames * 0.22); // Hook takes 22% of video (Increased)
  const S3_START = Math.floor(durationInFrames * 0.47); // Features takes 25%
  const S4_START = Math.floor(durationInFrames * 0.72); // Comparison takes 25%
  const S5_START = Math.floor(durationInFrames * 0.85); // Typewriter takes only 13% (Decreased), CTA gets 15%

  return (
    <AbsoluteFill style={{ backgroundColor: Theme.colors.bg, overflow: 'hidden' }}>

      {/* ── Audio ──────────────────────────────────────────────────────────── */}
      {props.audio_url && <Audio src={staticFile(props.audio_url)} />}

      {/* ── Persistent Background ─────────────────────────────────────────── */}
      <Background color1={Theme.colors.brand.blue} color2={Theme.colors.brand.violet} />

      {/* ── Floating Orbs (always visible) ────────────────────────────────── */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <FloatingOrb size={500} x="60%" y="-10%" color={Theme.colors.brand.blue} />
        <FloatingOrb size={450} x="-20%" y="50%" color={Theme.colors.brand.violet} />
        <FloatingOrb size={350} x="50%" y="70%" color={Theme.colors.brand.cyan} />
      </AbsoluteFill>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 1: Hook                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S1_START} durationInFrames={S2_START - S1_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <Col gap={48} align="center" justify="center" height="100%">

            {/* Radial glow burst on entry */}
            <RadialGlow color={Theme.colors.brand.blue} intensity={0.15} from={5} durationFrames={20} />

            {/* Category pill */}
            <Fade from={S1_START} duration={10}>
              <Pill label={category} color={Theme.colors.brand.violet} from={S1_START} />
            </Fade>

            {/* Hero headline */}
            <GlowPulse color={Theme.colors.brand.blue} minOpacity={0.1} maxOpacity={0.4} period={90}>
              <HeroTitle text={title} from={S1_START + 8} />
            </GlowPulse>

            {/* Divider */}
            <AnimatedDivider from={S1_START + 20} color={Theme.colors.brand.blue} />

            {/* Hook subtitle */}
            <Subtitle text={hook} from={S1_START + 24} />

          </Col>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 2: Feature Bullets                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S2_START} durationInFrames={S3_START - S2_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <Col gap={40} align="stretch" justify="center" height="100%">

            <Fade from={0} duration={12}>
              <div style={{
                fontFamily: Theme.font.sans,
                fontSize: Theme.size.title,
                fontWeight: Theme.weight.bold,
                color: Theme.colors.text.primary,
                textAlign: 'center',
                letterSpacing: '-0.02em',
                width: '100%',
              }}>
                Why switch?
              </div>
            </Fade>

            {sentences.map((sentence, i) => (
              <FeatureBullet
                key={i}
                icon={SCENE_ICONS[i] || '✨'}
                text={sentence}
                from={0}
                delay={i * 18}
              />
            ))}

          </Col>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 3: Comparison Chart                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S3_START} durationInFrames={S4_START - S3_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <Col gap={56} align="stretch" justify="center" height="100%">

            <Fade from={0} duration={12}>
              <Col gap={16} align="center" width="100%">
                <div style={{
                  fontFamily: Theme.font.sans,
                  fontSize: Theme.size.title,
                  fontWeight: Theme.weight.bold,
                  color: Theme.colors.text.primary,
                  textAlign: 'center',
                  letterSpacing: '-0.02em',
                }}>
                  The Real Cost
                </div>
                <div style={{
                  fontFamily: Theme.font.sans,
                  fontSize: Theme.size.heading,
                  color: Theme.colors.text.secondary,
                  textAlign: 'center',
                }}>
                  Paid alternatives vs FREE
                </div>
                <AnimatedDivider from={8} color={Theme.colors.brand.emerald} />
              </Col>
            </Fade>

            <div style={{
              backgroundColor: Theme.colors.surface,
              border: `2px solid ${Theme.colors.border}`,
              borderRadius: Theme.radius.lg,
              padding: '60px 56px',
              width: '100%',
              boxShadow: `0 10px 40px rgba(0,0,0,0.3)`,
            }}>
              <Col gap={48} align="stretch" width="100%">
                <ComparisonBar label="Monthly Cost" paid={100} free={0} unit="%" from={10} />
                <div style={{ height: 2, backgroundColor: Theme.colors.border, width: '100%' }} />
                <ComparisonBar label="Features" paid={80} free={90} unit="%" from={15} />
                <div style={{ height: 2, backgroundColor: Theme.colors.border, width: '100%' }} />
                <ComparisonBar label="Time to Start" paid={60} free={95} unit="%" from={20} />
              </Col>
            </div>

            <Fade from={50} duration={12}>
              <Row justify="center" gap={20} width="100%">
                <div style={{
                  backgroundColor: `${Theme.colors.brand.emerald}20`,
                  border: `2px solid ${Theme.colors.brand.emerald}44`,
                  borderRadius: Theme.radius.md,
                  padding: '24px 40px',
                  fontFamily: Theme.font.mono,
                  fontSize: Theme.size.body,
                  fontWeight: Theme.weight.bold,
                  color: Theme.colors.brand.emerald,
                }}>
                  FREE wins. Always.
                </div>
              </Row>
            </Fade>

          </Col>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 4: Typewriter Quote                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S4_START} durationInFrames={S5_START - S4_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <Col gap={56} align="center" justify="center" height="100%">

            <Fade from={0} duration={10}>
              <span style={{
                fontFamily: Theme.font.mono,
                fontSize: Theme.size.body,
                color: Theme.colors.brand.cyan,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
              }}>
                // WHAT THEY SAY
              </span>
            </Fade>

            <div style={{
              backgroundColor: Theme.colors.surface,
              border: `2px solid ${Theme.colors.brand.blue}33`,
              borderLeft: `8px solid ${Theme.colors.brand.blue}`,
              borderRadius: Theme.radius.md,
              padding: '60px 56px',
              width: '100%',
              boxShadow: `0 10px 40px rgba(0,0,0,0.3)`,
            }}>
              <Typewriter
                text={`"${hook}"`}
                from={8}
                speed={2}
                style={{
                  fontFamily: Theme.font.sans,
                  fontSize: Theme.size.title,
                  fontWeight: Theme.weight.semibold,
                  color: Theme.colors.text.primary,
                  lineHeight: 1.35,
                  display: 'block',
                }}
              />
            </div>

            <Fade from={60} duration={12}>
              <div style={{
                fontFamily: Theme.font.mono,
                fontSize: Theme.size.body,
                color: Theme.colors.text.muted,
              }}>
                — {toolName}
              </div>
            </Fade>

          </Col>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 5: CTA + Hashtags (runs to end)                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S5_START} durationInFrames={durationInFrames - S5_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <Col gap={56} align="stretch" justify="center" height="100%">

            {/* Radial glow for CTA energy */}
            <RadialGlow color={Theme.colors.brand.violet} intensity={0.2} from={0} durationFrames={20} />

            <Fade from={0} duration={15}>
              <CTACard cta={cta} from={0} />
            </Fade>

            <Fade from={30} duration={15}>
              <HashtagRow tags={hashtags} from={30} />
            </Fade>

            <Fade from={50} duration={12}>
              <Row justify="center" width="100%">
                <Scale from={50} initialScale={0.85}>
                  <div style={{
                    fontFamily: Theme.font.mono,
                    fontSize: Theme.size.body,
                    color: Theme.colors.text.muted,
                    letterSpacing: '0.05em',
                  }}>
                    DEVBYTE — AI Tools for Developers
                  </div>
                </Scale>
              </Row>
            </Fade>

          </Col>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
