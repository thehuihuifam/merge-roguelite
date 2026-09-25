/**
 * Design-system palette (UI/graphics overhaul, session A).
 *
 * Role-based tokens: renderers reference these instead of literal colours.
 * Layers: `bg` (backgrounds) → `text` (typography hierarchy) → `accent`
 * (meaningful highlights) → component tokens (balls, cards, danger line,
 * near-miss vignette). The ball tier ramp is one consistent HSV walk so
 * adjacent tiers read as neighbours and the top tiers feel luminous.
 */
export const PALETTE = {
  /** Background layers, darkest first. */
  bg: {
    /** Page / letterbox behind everything. */
    deep: '#05060f',
    /** Play field. */
    board: '#0b0e1f',
    /** Raised surfaces: board frame, cards, panels. */
    panel: '#161a38',
  },

  /** Text hierarchy tuned for the dark backgrounds. */
  text: {
    /** Scores, titles, primary data. */
    primary: '#f2f4ff',
    /** Labels, hints, secondary data. */
    secondary: '#a6adcf',
    /** De-emphasised chrome only. */
    dim: '#5e6584',
  },

  /** Accents carry meaning, not decoration. */
  accent: {
    /** Brand violet — echoes the top-tier ball glow. */
    primary: '#8b5cf6',
    /** Bombs, spawn pressure, caution. */
    warning: '#ffb84d',
    /** Risk cards, danger line, near miss. */
    danger: '#ff4d6d',
    /** Round clears, positive outcomes. */
    success: '#3ddc97',
  },

  /**
   * Ball tier ramp, tier 0 (value 2) → tier 10 (2048): hue walks 48° → 288°
   * in 12° steps (golden amber → vermilion → crimson → magenta → electric
   * violet) while saturation (0.78 → 0.96) and value (0.72 → 0.96) rise, so
   * high tiers look saturated and "glowing" under the bloom pass.
   */
  ballTier: [
    '#b89b28',
    '#be8126',
    '#c46424',
    '#ca4322',
    '#d01f1f',
    '#d61c41',
    '#dc1967',
    '#e21590',
    '#e912be',
    '#ef0eef',
    '#c60af5',
  ],

  /** The overflow line. */
  dangerLine: '#ff4d6d',
  /** Near-miss vignette tint, as an "r, g, b" triple for rgba(). */
  nearMissVignetteRgb: '255, 77, 109',
  /** Aim guide line. */
  guide: 'rgba(255, 255, 255, 0.16)',
  /** Full-screen dimmer behind overlays (idle / game over / cards). */
  overlay: 'rgba(4, 6, 16, 0.82)',

  ballStroke: 'rgba(8, 6, 20, 0.55)',
  /** Numbers printed on the balls — dark on the bright tier ramp. */
  ballText: '#0d0d1c',

  bomb: {
    ring: '#ffb84d',
    spark: '#ffe66d',
  },

  card: {
    background: '#161a38',
    border: '#3d4370',
    /** Risk card frame and badge fill. */
    riskBorder: '#ff4d6d',
    riskText: '#ff9fb3',
    riskBadge: '#ff4d6d',
    /** Reward card frame and title. */
    rewardBorder: '#8b5cf6',
    rewardText: '#f2f4ff',
    /** Text printed on filled badges. */
    badgeText: '#0d0d1c',
  },
} as const;
