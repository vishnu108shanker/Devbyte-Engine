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
import { VideoProps } from '../Root';
import { calculateSceneAndBulletTimings } from '../utils/timing';

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

// ─── Hero Title (with color emphasis) ─────────────────────────────────────────

const HeroTitle: React.FC<{ text: string; highlight: string; from?: number }> = ({ text, highlight, from = 0 }) => {
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
        textAlign: 'center',
        width: '100%',
      }}
    >
      <EmphasizedText
        text={text}
        highlight={highlight}
        style={{ color: Theme.colors.text.primary }}
        accentColor={Theme.colors.brand.cyan}
      />
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

// ─── Attention-Grabbing Vector Bullet Badges ───────────────────────────────

const ZapIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ filter: `drop-shadow(0 0 10px ${color}aa)` }}>
    <path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      fill="url(#zapGrad)"
      stroke="#ffffff"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="zapGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00f2fe" />
        <stop offset="1" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
  </svg>
);

const BrainIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ filter: `drop-shadow(0 0 10px ${color}aa)` }}>
    <path
      d="M12 2C8.5 2 6 4.5 6 7.5C6 8.5 6.3 9.4 6.8 10.2C5.1 11.2 4 13 4 15C4 17.8 6.2 20 9 20C9.6 20 10.2 19.9 10.7 19.7C11.1 20.5 11.5 21 12 21C12.5 21 12.9 20.5 13.3 19.7C13.8 19.9 14.4 20 15 20C17.8 20 20 17.8 20 15C20 13 18.9 11.2 17.2 10.2C17.7 9.4 18 8.5 18 7.5C18 4.5 15.5 2 12 2Z"
      fill="url(#brainGrad)"
      stroke="#ffffff"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M12 6V18M9 9H15M8 14H16" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
    <defs>
      <linearGradient id="brainGrad" x1="4" y1="2" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ec4899" />
        <stop offset="1" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
  </svg>
);

const RocketIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ filter: `drop-shadow(0 0 10px ${color}aa)` }}>
    <path
      d="M4.5 16.5C3.5 17.5 3 19.5 3 21C4.5 21 6.5 20.5 7.5 19.5L10 17L7 14L4.5 16.5Z"
      fill="#ef4444"
    />
    <path
      d="M14.5 3.5C12 3.5 7 8 7 14L10 17C16 17 20.5 12 20.5 9.5C20.5 7 17 3.5 14.5 3.5Z"
      fill="url(#rocketGrad)"
      stroke="#ffffff"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="14.5" cy="9.5" r="2.2" fill="#ffffff" />
    <defs>
      <linearGradient id="rocketGrad" x1="7" y1="3.5" x2="20.5" y2="17" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f59e0b" />
        <stop offset="1" stopColor="#ef4444" />
      </linearGradient>
    </defs>
  </svg>
);

const SparkleIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ filter: `drop-shadow(0 0 10px ${color}aa)` }}>
    <path
      d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
      fill="url(#sparkleGrad)"
      stroke="#ffffff"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="sparkleGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10b981" />
        <stop offset="1" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
  </svg>
);

interface BulletBadgeTheme {
  renderIcon: (color: string) => React.ReactNode;
  primaryColor: string;
  gradStart: string;
  gradEnd: string;
  glowColor: string;
}

const BULLET_THEMES: BulletBadgeTheme[] = [
  {
    renderIcon: (c) => <ZapIcon color={c} />,
    primaryColor: '#00f2fe',
    gradStart: 'rgba(0, 242, 254, 0.28)',
    gradEnd: 'rgba(59, 130, 246, 0.16)',
    glowColor: '#00f2fe',
  },
  {
    renderIcon: (c) => <BrainIcon color={c} />,
    primaryColor: '#d946ef',
    gradStart: 'rgba(217, 70, 239, 0.28)',
    gradEnd: 'rgba(139, 92, 246, 0.16)',
    glowColor: '#d946ef',
  },
  {
    renderIcon: (c) => <RocketIcon color={c} />,
    primaryColor: '#f59e0b',
    gradStart: 'rgba(245, 158, 11, 0.28)',
    gradEnd: 'rgba(239, 68, 68, 0.16)',
    glowColor: '#f59e0b',
  },
  {
    renderIcon: (c) => <SparkleIcon color={c} />,
    primaryColor: '#10b981',
    gradStart: 'rgba(16, 185, 129, 0.28)',
    gradEnd: 'rgba(6, 182, 212, 0.16)',
    glowColor: '#10b981',
  },
];

const BulletBadge: React.FC<{ index: number; isActive?: boolean }> = ({ index, isActive = false }) => {
  const theme = BULLET_THEMES[index % BULLET_THEMES.length];
  const frame = useCurrentFrame();
  const pulse = isActive ? Math.sin((frame / 8) * Math.PI) * 0.06 + 1.04 : 1;

  return (
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: 22,
        background: `linear-gradient(135deg, ${theme.gradStart}, ${theme.gradEnd})`,
        border: isActive ? `2.5px solid ${theme.primaryColor}` : `1.5px solid ${theme.primaryColor}66`,
        boxShadow: isActive
          ? `0 0 36px ${theme.glowColor}99, inset 0 0 16px ${theme.glowColor}55`
          : `0 8px 24px rgba(0,0,0,0.5), 0 0 16px ${theme.glowColor}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transform: `scale(${pulse})`,
        transition: 'transform 0.15s ease',
      }}
    >
      {theme.renderIcon(theme.primaryColor)}
    </div>
  );
};

// ─── Feature Bullet (with sound sync & attention-grabbing badge) ───────────────

const FeatureBullet: React.FC<{
  index: number;
  text: string;
  highlight: string;
  from?: number;
  delay?: number;
  isActive?: boolean;
}> = ({ index, text, highlight, from = 0, delay = 0, isActive = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - (from + delay), fps, config: { damping: 14, stiffness: 100 } });
  const tx = interpolate(progress, [0, 1], [-80, 0]);

  const theme = BULLET_THEMES[index % BULLET_THEMES.length];

  return (
    <div
      style={{
        transform: `translateX(${tx}px) ${isActive ? 'scale(1.02)' : 'scale(1)'}`,
        opacity: progress,
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        backgroundColor: isActive ? `${theme.primaryColor}10` : Theme.colors.surface,
        border: isActive ? `2px solid ${theme.primaryColor}` : `2px solid ${Theme.colors.border}`,
        borderRadius: Theme.radius.lg,
        padding: '36px 42px',
        width: '100%',
        boxShadow: isActive
          ? `0 14px 48px rgba(0,0,0,0.5), 0 0 32px ${theme.glowColor}40`
          : `0 10px 40px rgba(0,0,0,0.3)`,
        position: 'relative',
        transition: 'border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease',
      }}
    >
      <BulletBadge index={index} isActive={isActive} />

      <div style={{ margin: 0, flex: 1 }}>
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
          accentColor={theme.primaryColor}
        />
      </div>

      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            right: 24,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: Theme.radius.full,
            backgroundColor: `${theme.primaryColor}22`,
            border: `1px solid ${theme.primaryColor}66`,
            boxShadow: `0 0 12px ${theme.glowColor}44`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: theme.primaryColor,
              boxShadow: `0 0 8px ${theme.primaryColor}`,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: Theme.font.mono,
              fontSize: 18,
              fontWeight: Theme.weight.bold,
              color: theme.primaryColor,
              letterSpacing: '0.08em',
            }}
          >
            POINT #{index + 1}
          </span>
        </div>
      )}
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
 * 3-scene sound-synchronized dynamic timeline:
 *   s1Start – s2Start → SCENE 1: Hook (Sentence 1) — Bold headline + category pill + animated divider
 *   s2Start – s3Start → SCENE 2: Feature Bullets (Body sentences) — Attention-grabbing vector badges synced with sound
 *   s3Start – END     → SCENE 3: CTA + Hashtags (Runs to completion)
 *
 * Persistent layers: Background, Floating Orbs, Progress Bar.
 * Strictly contiguous `<Sequence>` boundaries with frame-accurate audio alignment.
 */
export const FreeAlternative: React.FC<VideoProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  const currentFrame = useCurrentFrame();

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

  // Dynamically calculate 3-scene boundaries and sound-synced per-bullet delays
  const timeline = calculateSceneAndBulletTimings(
    props,
    sentences,
    durationInFrames,
    fps,
    currentFrame
  );

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
      {/* SCENE 1: Hook (Sentence 1)                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={timeline.s1Start} durationInFrames={timeline.s1Duration}>
        <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
          <ScenePop delay={0}>
            <Col gap={48} align="center" justify="center">

              {/* Radial glow burst on entry */}
              <RadialGlow color={Theme.colors.brand.blue} intensity={0.15} from={5} durationFrames={20} />

              {/* Category pill */}
              <Fade from={0} duration={10}>
                <Pill label={category} color={Theme.colors.brand.violet} from={0} />
              </Fade>

              {/* Hero headline — tool name highlighted */}
              <GlowPulse color={Theme.colors.brand.blue} minOpacity={0.1} maxOpacity={0.4} period={90}>
                <HeroTitle text={title} highlight={toolName} from={8} />
              </GlowPulse>

              {/* Divider */}
              <AnimatedDivider from={20} color={Theme.colors.brand.blue} />

              {/* Hook subtitle — tool name highlighted */}
              <Subtitle text={hook} highlight={toolName} from={24} />

            </Col>
          </ScenePop>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 2: Feature Bullets (Body sentences, synced with audio)        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={timeline.s2Start} durationInFrames={timeline.s2Duration}>
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

              {timeline.bullets.map((bullet) => (
                <FeatureBullet
                  key={bullet.index}
                  index={bullet.index}
                  text={bullet.sentence}
                  highlight={toolName}
                  from={0}
                  delay={bullet.delay}
                  isActive={bullet.isActive}
                />
              ))}

            </Col>
          </ScenePop>
        </AbsoluteFill>
      </Sequence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SCENE 3: CTA + Hashtags (runs to end)                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sequence from={timeline.s3Start} durationInFrames={timeline.s3Duration}>
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
