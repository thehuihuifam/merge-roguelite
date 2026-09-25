import { describe, expect, it } from 'vitest';
import { BALL_TIERS, DESIGN, MAX_TIER } from '@/config/gameConfig';
import { ballGlowBlur } from '@/render/BallRenderer';
import { PALETTE } from '@/render/palette';

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
  }
  if (h < 0) {
    h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function channel(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an opaque #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two opaque colours. */
function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function hueDistance(a: number, b: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, 360 - direct);
}

describe('palette role tokens', () => {
  it('defines valid hex colours for every background, text and accent role', () => {
    const roles: readonly string[] = [
      PALETTE.bg.deep,
      PALETTE.bg.board,
      PALETTE.bg.panel,
      PALETTE.text.primary,
      PALETTE.text.secondary,
      PALETTE.text.dim,
      PALETTE.accent.primary,
      PALETTE.accent.warning,
      PALETTE.accent.danger,
      PALETTE.accent.success,
      PALETTE.dangerLine,
      PALETTE.card.background,
      PALETTE.card.border,
      PALETTE.card.riskBorder,
      PALETTE.card.riskText,
      PALETTE.card.rewardBorder,
      PALETTE.card.rewardText,
      PALETTE.ballText,
      PALETTE.bomb.ring,
      PALETTE.bomb.spark,
    ];
    for (const color of roles) {
      expect(isHexColor(color)).toBe(true);
    }
  });

  it('layer backgrounds darken from panel to board to deep', () => {
    const panel = relativeLuminance(PALETTE.bg.panel);
    const board = relativeLuminance(PALETTE.bg.board);
    const deep = relativeLuminance(PALETTE.bg.deep);
    expect(panel).toBeGreaterThan(board);
    expect(board).toBeGreaterThan(deep);
  });

  it('keeps text legible on the board background', () => {
    expect(contrastRatio(PALETTE.text.primary, PALETTE.bg.board)).toBeGreaterThan(10);
    expect(contrastRatio(PALETTE.text.secondary, PALETTE.bg.board)).toBeGreaterThan(4.5);
    // `dim` is deliberately low-emphasis but still readable.
    expect(contrastRatio(PALETTE.text.dim, PALETTE.bg.board)).toBeGreaterThan(3);
  });
});

describe('ball tier ramp', () => {
  it('covers all 11 tiers and stays in sync with BALL_TIERS', () => {
    expect(PALETTE.ballTier).toHaveLength(11);
    expect(PALETTE.ballTier).toHaveLength(BALL_TIERS.length);
    for (const spec of BALL_TIERS) {
      expect(spec.color).toBe(PALETTE.ballTier[spec.tier]);
      expect(isHexColor(spec.color)).toBe(true);
    }
  });

  it('walks the hue wheel in small consistent steps', () => {
    const hues = PALETTE.ballTier.map((color) => hexToHsv(color).h);
    for (let tier = 1; tier < hues.length; tier += 1) {
      const step = hueDistance(hues[tier - 1] ?? 0, hues[tier] ?? 0);
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(15);
    }
  });

  it('rises in saturation and value toward the glowing top tiers', () => {
    const hsv = PALETTE.ballTier.map((color) => hexToHsv(color));
    for (let tier = 1; tier < hsv.length; tier += 1) {
      expect(hsv[tier]?.s).toBeGreaterThanOrEqual(hsv[tier - 1]?.s ?? 0);
      expect(hsv[tier]?.v).toBeGreaterThanOrEqual(hsv[tier - 1]?.v ?? 0);
    }
    const top = hsv[hsv.length - 1];
    expect(top).toBeDefined();
    if (top !== undefined) {
      expect(top.s).toBeGreaterThan(0.9);
      expect(top.v).toBeGreaterThan(0.85);
    }
  });

  it('keeps the ball numbers readable on every tier', () => {
    for (const color of PALETTE.ballTier) {
      // Large bold numerals — WCAG large-text threshold is 3:1; we hold 3.5:1.
      expect(contrastRatio(PALETTE.ballText, color)).toBeGreaterThan(3.5);
    }
  });
});

describe('DESIGN tokens', () => {
  it('defines a strictly ordered type scale', () => {
    const { fontSize } = DESIGN;
    expect(fontSize.display).toBeGreaterThan(fontSize.heading);
    expect(fontSize.heading).toBeGreaterThan(fontSize.body);
    expect(fontSize.body).toBeGreaterThan(fontSize.caption);
    for (const size of Object.values(fontSize)) {
      expect(Number.isInteger(size)).toBe(true);
      expect(size).toBeGreaterThan(0);
    }
  });

  it('defines an ascending spacing scale', () => {
    const { space } = DESIGN;
    expect(space.xs).toBeLessThan(space.sm);
    expect(space.sm).toBeLessThan(space.md);
    expect(space.md).toBeLessThan(space.lg);
    expect(space.lg).toBeLessThan(space.xl);
  });

  it('defines well-formed motion curves', () => {
    const curve =
      /^cubic-bezier\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)$/;
    for (const easing of Object.values(DESIGN.easing)) {
      expect(curve.test(easing)).toBe(true);
    }
    // The emphasis curve overshoots (a y control point > 1) for a springy feel.
    const points = [...DESIGN.easing.emphasis.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((match) =>
      Number(match[1]),
    );
    expect(points).toHaveLength(4);
    expect(Math.max(...points.slice(1, 3))).toBeGreaterThan(1);
  });

  it('defines positive shadow and glow presets within the tier range', () => {
    for (const blur of Object.values(DESIGN.shadow)) {
      expect(blur).toBeGreaterThan(0);
    }
    for (const blur of [DESIGN.glow.subtle, DESIGN.glow.medium, DESIGN.glow.strong]) {
      expect(blur).toBeGreaterThan(0);
    }
    expect(DESIGN.glow.subtle).toBeLessThan(DESIGN.glow.strong);
    expect(DESIGN.glow.ballFromTier).toBeGreaterThanOrEqual(0);
    expect(DESIGN.glow.ballFromTier).toBeLessThanOrEqual(MAX_TIER);
  });
});

describe('ball glow mapping', () => {
  it('glows only from the configured tier upward, peaking at the max tier', () => {
    for (let tier = 0; tier < DESIGN.glow.ballFromTier; tier += 1) {
      expect(ballGlowBlur(tier)).toBe(0);
    }
    expect(ballGlowBlur(DESIGN.glow.ballFromTier)).toBe(DESIGN.glow.subtle);
    expect(ballGlowBlur(MAX_TIER)).toBe(DESIGN.glow.strong);
    for (let tier = DESIGN.glow.ballFromTier + 1; tier <= MAX_TIER; tier += 1) {
      expect(ballGlowBlur(tier)).toBeGreaterThanOrEqual(ballGlowBlur(tier - 1));
    }
    expect(ballGlowBlur(-1)).toBe(0);
    expect(ballGlowBlur(MAX_TIER + 5)).toBe(DESIGN.glow.strong);
  });
});
