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
import { KineticText3D } from '../motion/KineticText3D';
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

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: 6,
      backgroundColor: 'rgba(255,255,255,0.06)', zIndex: 100,
    }}>
      <div style={{
        width: `${progress}%`, height: '100%',
        background: `linear-gradient(90deg, ${Theme.colors.brand.blue}, ${Theme.colors.brand.violet}, ${Theme.colors.brand.cyan})`,
        borderRadius: '0 3px 3px 0',
        boxShadow: `0 0 12px ${Theme.colors.brand.blue}88`,
      }} />
    </div>
  );
};

// ─── Spring Scale Pop Wrapper ─────────────────────────────────────────────────

/** Wraps children in a spring scale animation on scene entry. */
const ScenePop: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: frame - delay, fps,
    config: { damping: 14, stiffness: 120, mass: 0.6 },
  });
  const scale = interpolate(pop, [0, 1], [0.88, 1]);
  const opacity = interpolate(pop, [0, 1], [0, 1]);

  return (
    <div style={{ transform: `scale(${scale})`, opacity, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      {children}
    </div>
  );
};

// ─── Color Emphasis Helper ────────────────────────────────────────────────────

/** Highlights occurrences of `highlight` word within `text` with a vibrant accent color. */
const EmphasizedText: React.FC<{
  text: string;
  highlight: string;
  style: React.CSSProperties;
  accentColor?: string;
}> = ({ text, highlight, style, accentColor = Theme.colors.brand.cyan }) => {
  if (!highlight || highlight.length < 2) {
    return <span style={style}>{text}</span>;
  }

  // Case-insensitive split around highlight word
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span style={style}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}66` }}>{part}</span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
};

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

// ─── Subtitle ─────────────────────────────────────────────────────────────────

const Subtitle: React.FC<{ text: string; highlight: string; from?: number }> = ({ text, highlight, from = 0 }) => (
  <Fade from={from} duration={18}>
    <Slide from={from + 4} direction="up" distance={40}>
      <div
        style={{
          fontFamily: Theme.font.sans,
          fontSize: Theme.size.heading,
          fontWeight: Theme.weight.regular,
          textAlign: 'center',
          lineHeight: 1.5,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <EmphasizedText
          text={text}
          highlight={highlight}
          style={{ color: Theme.colors.text.secondary }}
          accentColor={Theme.colors.brand.blue}
        />
      </div>
    </Slide>
  </Fade>
);

// ─── Feature Bullet (with color emphasis) ─────────────────────────────────────

const FeatureBullet: React.FC<{ icon: string; text: string; highlight: string; from?: number; delay?: number }> = ({
  icon, text, highlight, from = 0, delay = 0,
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
      <div style={{ margin: 0 }}>
        <EmphasizedText
          text={text}
          highlight={highlight}
          style={{
            fontFamily: Theme.font.sans,
            fontSize: Theme.size.body,
            fontWeight: Theme.weight.medium,
            color: Theme.colors.text.primary,
            lineHeight: 1.4,
          }}
          accentColor={Theme.colors.brand.cyan}
        />
      </div>
    </div>
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
 * Scene layout (3 scenes, fills the FULL audio duration):
 *   0    – S2   →  SCENE 1: Hook — 3D Kinetic Title + category pill + hook subtitle
 *   S2   – S3   →  SCENE 2: Feature bullets — 3 animated bullets from validated_script body
 *   S3   – END  →  SCENE 3: CTA + Hashtags
 *
 *  Persistent layers: Background, Floating Orbs, Progress Bar.
 *  Uses strictly contiguous `<Sequence>` boundaries (no overlap!).
 */
export const FreeAlternative: React.FC<VideoProps> = (props) => {
  const { durationInFrames } = useVideoConfig();

  const toolName   = props.source_title  || 'New AI Tool';
  const hook       = props.hook          || 'This changes everything.';
  const body       = props.body          || 'Amazing AI tool that helps developers.';
  const cta        = props.cta           || 'Try it FREE — link in bio!';
  const category   = (props.category     || 'free_alternative').replace(/_/g, ' ');
  const hashtags   = props.hashtags      || ['#AITools', '#Free', '#Dev'];

  // Split body into up to 3 feature sentences
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3);

  const SCENE_ICONS = ['⚡', '🧠', '🚀'];

  // 3-scene timeline (contiguous, dynamic to audio length)
  const S1_START = 0;
  const S2_START = Math.floor(durationInFrames * 0.25);  // Hook: 25%
  const S3_START = Math.floor(durationInFrames * 0.75);  // Features: 50%

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

      {/* ── Progress Bar (always visible) ──────────────────────────────────── */}
      <ProgressBar />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 1: Hook                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S1_START} durationInFrames={S2_START - S1_START}>

        {/* 3D Kinetic Title — full-bleed WebGL canvas behind the 2D overlay */}
        <KineticText3D text={toolName} highlight={toolName} from={8} />

        {/* 2D overlay: pill on top, hook subtitle at bottom */}
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '100px 80px 140px 80px', pointerEvents: 'none' }}>

          {/* Top: Category pill */}
          <Fade from={0} duration={10}>
            <Pill label={category} color={Theme.colors.brand.violet} from={0} />
          </Fade>

          {/* Bottom: Hook subtitle */}
          <Fade from={18} duration={15}>
            <Subtitle text={hook} highlight={toolName} from={18} />
          </Fade>

        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 2: Feature Bullets                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S2_START} durationInFrames={S3_START - S2_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <ScenePop delay={0}>
            <Col gap={40} align="stretch" justify="center">

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
                  highlight={toolName}
                  from={0}
                  delay={i * 18}
                />
              ))}

            </Col>
          </ScenePop>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 3: CTA + Hashtags (runs to end)                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={S3_START} durationInFrames={durationInFrames - S3_START}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <ScenePop delay={0}>
            <Col gap={56} align="stretch" justify="center">

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
          </ScenePop>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
