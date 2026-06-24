/**
 * DevByte Engine V2 — Design System Tokens
 * Single source of truth. No magic numbers anywhere else.
 */

export const Theme = {
  colors: {
    bg: '#060608',            // Near-black canvas
    surface: '#111115',       // Elevated surface
    surfaceHigh: '#1c1c22',   // Higher elevation
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',

    text: {
      primary: '#f0f0f5',
      secondary: '#8e8ea0',
      muted: '#555568',
      inverse: '#0a0a0f',
    },

    brand: {
      blue: '#3b82f6',
      violet: '#8b5cf6',
      cyan: '#06b6d4',
      emerald: '#10b981',
      amber: '#f59e0b',
      rose: '#f43f5e',
    },

    gradient: {
      brand: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      warm:  'linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)',
      cool:  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
      dark:  'linear-gradient(180deg, #111115 0%, #060608 100%)',
    },
  },

  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, 'Fira Code', monospace",
  },

  weight: {
    regular: 400,
    medium:  500,
    semibold: 600,
    bold:    700,
    black:   900,
  },

  // px values — used as numbers, not strings
  size: {
    eyebrow:  30,
    body:     44,
    heading:  64,
    title:    96,
    hero:     120,
  },

  spacing: {
    xs:  24,
    sm:  48,
    md:  72,
    lg:  110,
    xl:  160,
  },

  radius: {
    sm:  12,
    md:  20,
    lg:  32,
    full: 9999,
  },
} as const;
