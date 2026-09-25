import type { BallTierSpec } from '@/core/types';

/** Logical board size in world units (pixels at 1x scale). */
export const BOARD = {
  width: 480,
  height: 720,
  wallThickness: 60,
} as const;

/** Vertical position (from top) of the danger line. Balls resting above it end the run. */
export const DANGER_LINE_Y = 120;

/** Height of the zone below the danger line where the near-miss hook starts firing. */
export const WARNING_ZONE_HEIGHT = 90;

/** How long a ball must rest above the danger line before the run ends. */
export const OVERFLOW_GRACE_MS = 1000;

/** Balls slower than this (px/step) count as "resting" for overflow purposes. */
export const RESTING_SPEED_THRESHOLD = 0.6;

/** Delay after a drop before the next ball can be dropped. */
export const DROP_COOLDOWN_MS = 550;

/** Vertical position at which held balls are shown and spawned. */
export const SPAWN_Y = 60;

/** Only the first N tiers can be spawned by the dispenser. */
export const SPAWNABLE_TIER_COUNT = 5;

/** Fixed physics step (60 Hz). */
export const PHYSICS_STEP_MS = 1000 / 60;

/** Maximum physics sub-steps per frame, to avoid spiral of death on slow tabs. */
export const MAX_SUBSTEPS_PER_FRAME = 5;

/** Slow-motion parameters used by the merge-moment extension point. */
export const SLOW_MOTION = {
  durationMs: 400,
  timeScale: 0.25,
  cardCount: 3,
  riskCardCount: 1,
} as const;

/**
 * Merge card deck tuning. Consumed by `src/systems/cards/`.
 * `severity` values only drive UI intensity (border colour, shake), 0..1.
 */
export const MERGE_CARDS = {
  /** Reward: ×2 on the next two merges. */
  doubleMultiplier: 2,
  doubleMultiplierUses: 2,
  /** Reward: ×3 on the next merge. */
  tripleMultiplier: 3,
  tripleMultiplierUses: 1,
  /** Risk: share of the current score removed immediately. */
  scoreLossRatio: 0.1,
  scoreLossSeverity: 0.7,
  /** Risk: upside handed out after the score loss. */
  scoreLossMultiplier: 4,
  scoreLossMultiplierUses: 1,
  /**
   * Risk: flat score removed by the danger-line card. v0.1.0 cannot move the
   * danger line yet (no `MergeCardContext` field for it), so the penalty is
   * score only until Task 2.x adds one.
   */
  dangerLineScoreCost: 50,
  dangerLineSeverity: 0.5,
} as const;

/** Score awarded when two max-tier balls merge and vanish. */
export const MAX_TIER_MERGE_BONUS = 10000;

/** Chain bonus: each consecutive merge within one drop adds this fraction to the multiplier. */
export const CHAIN_MULTIPLIER_STEP = 0.5;

/** Physical material properties shared by all balls. */
export const BALL_MATERIAL = {
  restitution: 0.15,
  friction: 0.08,
  frictionStatic: 0.4,
  frictionAir: 0.008,
  density: 0.0015,
} as const;

/** Gravity in Matter.js units. */
export const GRAVITY_Y = 1.15;

/** All ball tiers, ordered from smallest to largest. */
export const BALL_TIERS: readonly BallTierSpec[] = [
  { tier: 0, value: 2, radius: 16, color: '#f9c74f' },
  { tier: 1, value: 4, radius: 21, color: '#f8961e' },
  { tier: 2, value: 8, radius: 27, color: '#f3722c' },
  { tier: 3, value: 16, radius: 34, color: '#f94144' },
  { tier: 4, value: 32, radius: 42, color: '#e63946' },
  { tier: 5, value: 64, radius: 51, color: '#9d4edd' },
  { tier: 6, value: 128, radius: 61, color: '#7209b7' },
  { tier: 7, value: 256, radius: 72, color: '#4361ee' },
  { tier: 8, value: 512, radius: 84, color: '#4cc9f0' },
  { tier: 9, value: 1024, radius: 97, color: '#43aa8b' },
  { tier: 10, value: 2048, radius: 111, color: '#90be6d' },
];

export const MAX_TIER = BALL_TIERS.length - 1;
