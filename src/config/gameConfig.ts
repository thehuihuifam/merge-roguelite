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

/**
 * Near-miss presentation (Task 2.1): red vignette fade and the heartbeat pulse
 * that speeds up as a resting ball nears the danger line. Consumed by
 * `src/render/NearMissVignetteRenderer.ts`.
 */
export const NEAR_MISS_FX = {
  /** Ms for the vignette to fade in to the current severity. */
  fadeInMs: 120,
  /** Ms for the vignette to fade out after the near miss ends (GDD 3.3). */
  fadeOutMs: 300,
  /** Heartbeat period (ms) at severity 0 — calm. */
  heartbeatPeriodAtSeverityZeroMs: 900,
  /** Heartbeat period (ms) at severity 1 — touching the danger line. */
  heartbeatPeriodAtSeverityOneMs: 450,
  /** How far the heartbeat pushes the vignette brightness, 0..1. */
  heartbeatPulseStrength: 0.35,
  /** Width of one heartbeat bump, as a fraction of the cycle ("lub"). */
  heartbeatBeatWidth: 0.1,
  /** Phase of the softer echo beat ("dub"), 0..1. */
  heartbeatEchoPhase: 0.22,
  /** Echo beat strength relative to the main beat, 0..1. */
  heartbeatEchoStrength: 0.55,
  /** Strongest vignette alpha (severity 1 with the heartbeat at its peak). */
  maxVignetteAlpha: 0.5,
} as const;

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
  /**
   * Minimum tier of the merged ball that opens the card choice (tier 2 = value
   * 8). Keeps the choice rare enough to stay exciting: roughly 2–4 per minute.
   */
  minResultTier: 2,
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

/**
 * Layout of the card choice overlay drawn during `slowmo_select`, in board
 * units. The rectangle helper is exported by `src/render/CardOverlayRenderer`
 * so pointer input can hit-test the very shapes that were drawn.
 */
export const CARD_OVERLAY = {
  cardWidth: 132,
  cardHeight: 180,
  gap: 14,
  /** Distance from the bottom of the board to the bottom of a card. */
  bottomMargin: 56,
  /** Distance from the top of the board to the "CHOOSE" header. */
  headerY: 148,
  cornerRadius: 12,
  padding: 12,
  borderWidth: 2,
  riskBorderWidth: 3,
  titleFontSize: 16,
  bodyFontSize: 12,
  bodyLineHeight: 15,
  badgeHeight: 18,
  badgeWidth: 46,
} as const;

/** Score awarded when two max-tier balls merge and vanish. */
export const MAX_TIER_MERGE_BONUS = 10000;

/**
 * Roguelite round structure (Task 2.2). Consumed by
 * `src/systems/BasicRoundSystem.ts` and `src/systems/cards/RoundClearRewardCard.ts`.
 */
export const ROUNDS = {
  /** Points to earn inside round 1 to clear it. */
  firstTargetScore: 150,
  /** Extra points required per subsequent round. */
  targetScoreStep: 100,
  /** Drops allotted to round 1 before the round is considered failed. */
  firstDropBudget: 15,
  /** Extra drops allotted per subsequent round. */
  dropBudgetStep: 3,
  /** Round-clear reward card bonus at round 1. */
  rewardBaseScore: 50,
  /** Reward card bonus growth per cleared round. */
  rewardScorePerRound: 25,
} as const;

/**
 * Special balls (Task 2.3). Spawn chance is rolled per dispenser ball;
 * blast tuning is consumed by `src/systems/special/BombBallBehavior.ts`.
 */
export const SPECIAL_BALLS = {
  /** Chance that a dispenser ball comes out as a bomb, 0..1. */
  bombSpawnChance: 0.05,
  /** Balls whose centre lies within this radius of a bomb are removed with it. */
  bombBlastRadius: 90,
} as const;

/** Persistent save (Task 2.4). Key and version for localStorage. */
export const SAVE = {
  storageKey: 'merge-roguelite:save',
  version: 1,
} as const;

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
