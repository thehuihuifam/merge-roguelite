import { PALETTE } from '@/render/palette';
import type { BallTierSpec } from '@/core/types';

/**
 * Design-system tokens (UI/graphics overhaul session A): one type scale,
 * one spacing scale, shared motion curves and shadow/glow presets. Renderers
 * reference these instead of hardcoded sizes and margins.
 */
export const DESIGN = {
  /** Type scale, px. display: titles · heading: big numbers · body: data · caption: labels/hints. */
  fontSize: {
    display: 40,
    heading: 26,
    body: 16,
    caption: 12,
  },
  /** Canvas font weights used across the HUD and overlays. */
  fontWeight: {
    medium: 600,
    bold: 700,
    black: 800,
  },
  /** Spacing scale, board units. */
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  /** Motion curves (CSS cubic-bezier strings, for DOM + future UI sessions). */
  easing: {
    /** Default UI transitions. */
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Springy emphasis — rewards, pops. */
    emphasis: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** Entering elements decelerate to rest. */
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  /** Drop shadow blur radii, board units. */
  shadow: {
    subtle: 4,
    medium: 10,
    strong: 20,
  },
  /** Glow (shadowBlur) radii, board units. High-tier balls glow from `ballFromTier` up. */
  glow: {
    subtle: 6,
    medium: 14,
    strong: 26,
    ballFromTier: 5,
  },
} as const;

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

/**
 * Slow-motion parameters used by the merge-moment extension point.
 */
export const SLOW_MOTION = {
  /**
   * Length of the slow-motion visual effect (0.25x time scale), in real-time
   * ms. Unrelated to how long the card choice waits: the choice itself has
   * no time limit.
   */
  durationMs: 400,
  /**
   * Auto-select timer for the card choice, in real-time ms — or `null` to
   * disable the timeout entirely. `null` means the choice window stays open
   * until the player picks a card; the game never chooses for them (an
   * auto-closing choice window ruined the decision moment).
   */
  choiceTimeoutMs: null as number | null,
  timeScale: 0.25,
  cardCount: 3,
  riskCardCount: 1,
  /**
   * Minimum tier of an ordinary merged ball that opens the card choice
   * (tier 2 = value 8). Max-tier annihilations have no result tier and qualify
   * independently of this threshold.
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
  /** Risk: flat score removed by the danger-line card. */
  dangerLineScoreCost: 50,
  /** Risk: move the danger line toward the balls, in board units. */
  dangerLineShiftPx: 30,
  /** Risk: multiplier granted after paying the danger-line penalty. */
  dangerLineMultiplier: 4,
  dangerLineMultiplierUses: 1,
  dangerLineSeverity: 0.5,
  /**
   * Risk: force the next dispenser issuances up to at least this tier
   * (`spawn_larger_balls`, Task 2.18) — board pressure in exchange for a
   * one-shot merge multiplier.
   */
  spawnLargerFloorTier: 3,
  spawnLargerSpawns: 3,
  spawnLargerMultiplier: 4,
  spawnLargerMultiplierUses: 1,
  spawnLargerSeverity: 0.6,
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
  bodyLineHeight: 15,
  badgeHeight: 18,
  badgeWidth: 46,
  /**
   * Animation (UX overhaul session B, Task 4). Entrance springs in with the
   * canvas counterpart of `DESIGN.easing.emphasis` (`easeOutBack`), exits
   * decelerate with `easeOutCubic` — see `src/render/motion.ts`.
   */
  /** Entrance: scale-in + fade-in when the hand appears, ms. */
  entranceMs: 200,
  /** Scale the hand springs up from during the entrance. */
  entranceScaleFrom: 0.86,
  /** Exit: the chosen card scales up slightly as the hand fades, ms. */
  exitMs: 150,
  /** Scale the chosen card grows to while exiting. */
  exitScaleTo: 1.08,
  /** How far a hovered card lifts under the mouse, board units. */
  hoverLiftPx: DESIGN.space.sm,
  /** Alpha of the risk blush at the top edge of a risk card's background. */
  riskGradientAlpha: 0.16,
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
  /**
   * Share of the removed balls' tier values paid out as blast score
   * (Task 2.14): `round(sum(values) * blastScoreRatio)`, flat — no chain or
   * card multipliers. Clearing big balls should feel rewarding, not wasteful.
   */
  blastScoreRatio: 0.5,
} as const;

/** Persistent save (Task 2.4). Key and version for localStorage. */
export const SAVE = {
  storageKey: 'merge-roguelite:save',
  version: 1,
} as const;

/**
 * Spawn-penalty HUD placement (Task 2.19). Right-aligned under the NEXT
 * preview and above the danger line, clear of the ROUND column and NEXT.
 */
export const SPAWN_PENALTY_HUD = {
  /** Right text edge, board units. */
  x: BOARD.width - 14,
  /** Top of the label line, board units. */
  y: 92,
} as const;

/**
 * HUD layout (UX overhaul session B, Task 1). Every HUD coordinate, size and
 * margin lives here, derived from the session-A DESIGN tokens — renderers hold
 * no layout numbers of their own.
 *
 * Information hierarchy (progressive disclosure):
 * - primary   → SCORE, top centre, always, biggest and brightest;
 * - secondary → BEST (top-left) and NEXT (top-right corner), always, caption;
 * - tertiary  → round progress, drops left, SLOW badge, spawn penalty:
 *                each rendered only while it matters.
 */
export const HUD_LAYOUT = {
  /** Shared left/right gutter for the corner blocks, board units. */
  margin: DESIGN.space.lg,
  /** Primary: current score — top centre, `fontSize.display`. */
  score: {
    labelY: DESIGN.space.sm,
    valueY: DESIGN.space.sm + DESIGN.fontSize.caption + DESIGN.space.xs,
  },
  /** Secondary: best score — top-left corner, `fontSize.caption`. */
  best: {
    labelY: DESIGN.space.sm,
    valueY: DESIGN.space.sm + DESIGN.fontSize.caption + DESIGN.space.xs,
  },
  /**
   * Secondary: next-ball preview — diegetic placement (session B, Task 2):
   * beside the actual spawn point (board top centre, `SPAWN_Y`) instead of a
   * fixed screen corner, so the player reads it together with the aim guide.
   */
  next: {
    /** Horizontal offset of the preview centre from the spawn column. */
    offsetX: 56,
    /** Preview centre height — the spawn height. */
    previewY: SPAWN_Y,
    /** Preview balls are scaled down to at most this radius. */
    previewRadius: 18,
    /** Caption label sits this far under the preview ball. */
    labelGap: DESIGN.space.xs,
  },
  /** Tertiary: round block — left column below BEST. */
  round: {
    /** Round readout (body size) during the emphasis window. */
    emphasizedY: 44,
    /** Target-progress line under the emphasized readout. */
    progressY: 64,
    /** Compact round label (caption) after the emphasis window. */
    quietY: 44,
    /** Target-progress line while quiet. */
    quietProgressY: 58,
    /** Low-drops warning line while quiet. */
    dropsY: 72,
    /** How long a round's readout stays emphasized after it starts, ms. */
    emphasisMs: 3000,
    /** Drops left at or below this count switch to the warning emphasis. */
    lowDropsThreshold: 5,
    /** Slight scale-up applied to the low-drops warning line. */
    lowDropsScale: 1.1,
  },
  /** Tertiary: slow-motion badge — centred under SCORE, only while slowed. */
  slowBadge: {
    /** One spacing step under the score value block. */
    y:
      DESIGN.space.sm +
      DESIGN.fontSize.caption +
      DESIGN.space.xs +
      DESIGN.fontSize.display +
      DESIGN.space.sm,
  },
  /**
   * Diegetic round-progress gauge (session B, Task 2): a thin strip embedded
   * in the board's bottom frame that fills with the round's score progress.
   */
  roundGauge: {
    /** Gauge thickness, board units — a hairline in the frame, not a bar. */
    thickness: 4,
    /** Brief glow when the gauge reaches 100%, ms. */
    glowMs: 600,
    /** Peak glow radius (shadowBlur) at the moment of completion. */
    glowBlur: DESIGN.glow.medium,
  },
  /**
   * Diegetic danger tint (session B, Task 2): the board background itself
   * blushes red when a ball rests close to the danger line. Driven by the
   * existing `nearMissIntensity` (0 at the warning-zone floor, 1 at the line).
   */
  dangerTint: {
    /** Tint starts once a ball is within this distance of the danger line. */
    thresholdPx: 30,
    /** Strongest tint alpha — subtle, the vignette carries the real alarm. */
    maxAlpha: 0.1,
  },
} as const;

/**
 * Game-over screen (UX overhaul session B, Task 3). Consumed by
 * `src/render/GameOverRenderer.ts`: count-up timing, the NEW BEST celebration
 * and every layout slot. Sizes derive from the session-A DESIGN tokens.
 */
export const GAME_OVER = {
  /** Score count-up (0 → final) duration, ms — eased with `easeOutCubic`. */
  countUpMs: 800,
  /** The final score is the biggest number in the game: display ×1.5. */
  scoreFontSize: Math.round(DESIGN.fontSize.display * 1.5),
  /** NEW BEST celebration. */
  newBest: {
    /** Chromatic-aberration pulse strength fired while the badge shows. */
    aberration: 0.014,
    /** Period of the badge heartbeat and the aberration pulses, ms. */
    pulsePeriodMs: 900,
    /** Number of aberration pulses — the celebration has an end. */
    pulseCount: 4,
    /** Badge heartbeat scale range: 1 → this value. */
    badgeScaleMax: 1.06,
    badgeWidth: 132,
    badgeHeight: 30,
  },
  /** Vertical layout slots (text baseline centres), board units. */
  layout: {
    titleY: 176,
    badgeY: 236,
    scoreLabelY: 288,
    scoreY: 330,
    bestY: 398,
    roundY: 428,
    buttonY: 500,
    buttonWidth: 208,
    buttonHeight: 52,
    buttonRadius: CARD_OVERLAY.cornerRadius,
    hintY: 592,
  },
} as const;

/** Audio tuning (Task 2.6). Consumed by WebAudioSystem. */
export const AUDIO = {
  /** Base frequency for tier 0 merge, Hz. */
  mergeBaseFreq: 220,
  /** Semitone steps per tier (1 = one semitone). */
  mergeFreqSemitonePerTier: 2,
  /** Extra pitch per chain index, in semitones. */
  mergeChainSemitone: 0.8,
  /** Master volume 0..1. */
  masterVolume: 0.35,
  /** Duration of short SFX in ms. */
  shortDurationMs: 180,
  /** Duration of big merge / game over in ms. */
  longDurationMs: 600,
} as const;

/** Particle burst tuning (Task 2.5). Consumed by BasicParticleSystem. */
export const PARTICLES = {
  /** How many particles a normal merge spawns at intensity 1. */
  mergeCount: 14,
  /** How many particles the max-tier vanish spawns. */
  mergeMaxCount: 24,
  /** Drop dust puff count. */
  dropDustCount: 8,
  /** Sparks near the danger line. */
  dangerSparkCount: 6,
  /** Base lifetime in ms. */
  lifetimeMs: 500,
  /** Lifetime jitter 0..1. */
  lifetimeJitter: 0.35,
  /** Initial speed in board units per 16ms step. */
  speed: 3.5,
  /** Speed jitter. */
  speedJitter: 0.6,
  /** Gravity applied to particles (board units per ms^2). */
  gravity: 0.012,
  /** Drag per ms (0..1). */
  drag: 0.002,
  /** Base size in board units. */
  size: 3.2,
  /** Max particle count to keep on screen (safety cap). */
  maxAlive: 200,
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

/**
 * All ball tiers, ordered from smallest to largest. Colours come from the
 * design-system ball ramp (`PALETTE.ballTier`, UX session A) so the board and
 * the palette can never drift apart.
 */
export const BALL_TIERS: readonly BallTierSpec[] = [
  { tier: 0, value: 2, radius: 16, color: PALETTE.ballTier[0] },
  { tier: 1, value: 4, radius: 21, color: PALETTE.ballTier[1] },
  { tier: 2, value: 8, radius: 27, color: PALETTE.ballTier[2] },
  { tier: 3, value: 16, radius: 34, color: PALETTE.ballTier[3] },
  { tier: 4, value: 32, radius: 42, color: PALETTE.ballTier[4] },
  { tier: 5, value: 64, radius: 51, color: PALETTE.ballTier[5] },
  { tier: 6, value: 128, radius: 61, color: PALETTE.ballTier[6] },
  { tier: 7, value: 256, radius: 72, color: PALETTE.ballTier[7] },
  { tier: 8, value: 512, radius: 84, color: PALETTE.ballTier[8] },
  { tier: 9, value: 1024, radius: 97, color: PALETTE.ballTier[9] },
  { tier: 10, value: 2048, radius: 111, color: PALETTE.ballTier[10] },
];

export const MAX_TIER = BALL_TIERS.length - 1;

/** Korean font stack for Canvas text rendering. */
export const FONT_STACK =
  'Pretendard, -apple-system, BlinkMacSystemFont, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

/**
 * Centralized Korean UI strings (i18n).
 * All user-visible text should be referenced from here.
 */
export const TEXT = {
  // HUD labels
  scoreLabel: '점수',
  bestLabel: '최고',
  nextLabel: '다음',
  roundLabel: '라운드',
  dropsUnit: '개 남음',
  slowMotionBadge: '슬로우 ×0.25',
  // Card overlay
  chooseHeader: '카드를 선택하세요',
  riskBadge: '위험',
  spawnPenalty: '큰 공 스폰',
  lastSpawn: '마지막 발급',
  // Game over / idle
  runOverTitle: '런 종료',
  restartHint: '클릭/터치 또는 R키로 재시작',
  /** NEW BEST badge (session B game-over redesign). */
  newBestBadge: 'NEW BEST',
  /** Restart button label (session B game-over redesign). */
  restartButton: '다시 시작',
  /** Round reached line, e.g. "라운드 4 도달". */
  roundReached: (round: number): string => `라운드 ${round} 도달`,
  gameTitle: '머지 로그라이트',
  startHint: '클릭/터치로 시작',
  // Dynamic templates — functions return Korean strings
  slowMotionBadgeDynamic: (scaleText: string): string => `슬로우 ×${scaleText}`,
  roundStatus: (index: number, dropsLeft: number): string =>
    `라운드 ${index} · ${dropsLeft}개 남음`,
  /** Quiet-mode round label (session B hierarchy): the round number alone. */
  roundIndexLabel: (index: number): string => `라운드 ${index}`,
  /** Low-drops warning line (session B hierarchy). */
  dropsRemaining: (dropsLeft: number): string => `${dropsLeft}개 남음`,
  scoreProgress: (progress: number, target: number): string =>
    `${progress.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`,
  /** Card overlay hint: the choice has no time limit. */
  chooseSubtext: '카드를 터치하세요 — 시간 제한 없음',
  spawnPenaltyDetail: (minTier: number, remaining: number): string =>
    `스폰 ≥${minTier} · ${remaining}개 남음`,
  scoreSummary: (score: string): string => `점수 ${score}`,
  bestSummary: (best: string): string => `최고 ${best}`,
  // Cards
  bonusScoreTitle: (points: number): string => `+${points} 점`,
  bonusScoreDesc: '이번 머지 점수를 한 번 더 획득합니다.',
  doubleMultiplierTitle: '점수 ×2',
  doubleMultiplierDesc: (uses: number): string => `다음 ${uses}번 머지 점수 2배.`,
  tripleMultiplierTitle: '점수 ×3',
  tripleMultiplierDesc: '다음 머지 점수 3배.',
  gambleTitle: (mult: number): string => `도박 ×${mult}`,
  gambleDesc: (percent: number, mult: number): string =>
    `지금 점수의 ${percent}%를 잃지만 다음 머지 ×${mult}`,
  pressureTitle: '압박',
  pressureDesc: (cost: number, shift: number, mult: number): string =>
    `${cost}점을 내고 위험선을 ${shift}px 내립니다; 다음 머지 ×${mult}.`,
  heavyLoadTitle: '무거운 하중',
  heavyLoadDesc: (spawns: number, tier: number, mult: number): string =>
    `다음 ${spawns}개 스폰이 최소 ${tier}티어 이상; 다음 머지 ×${mult}.`,
  roundClearTitle: (round: number): string => `라운드 ${round} 클리어`,
  roundClearDesc: (points: number): string => `라운드 보너스: +${points}점.`,
};

/**
 * Post-processing tuning (UX overhaul session A). Consumed by
 * `src/render/PostProcessPipeline.ts` and the four shader chunks in
 * `src/render/shaders/`. All four effects are composed into ONE full-screen
 * fragment-shader pass — never four separate passes (mobile frame budget).
 */
export const POST_FX = {
  bloom: {
    /** Master bloom strength. */
    intensity: 0.65,
    /** Luma threshold above which a pixel bleeds light into neighbours. */
    threshold: 0.55,
    /** Blur radius in texels for the bloom ring taps. */
    radiusTexels: 1.7,
  },
  vignette: {
    /** Always-on edge darkening for mood and focus. */
    baseIntensity: 0.22,
    /** Extra vignette added by near-miss pressure (severity 1). */
    nearMissBoost: 0.5,
  },
  chromaticAberration: {
    /** Always-on channel split, in UV units at the screen edge. */
    baseIntensity: 0.0012,
    /** Spike added when a big merge lands. */
    mergeSpike: 0.01,
    /** Spike added on bomb detonations and max-tier annihilations. */
    detonationSpike: 0.028,
    /** Exponential decay time constant of a spike, in ms. */
    spikeDecayMs: 260,
  },
  grain: {
    /** Always-on film grain for texture (subtle). */
    intensity: 0.045,
  },
} as const;

/**
 * Visual FX tuning (merge flash, camera shake, squash-stretch, merge pop).
 * All magic numbers for polish effects live here.
 */
export const FX = {
  /** Screen flash fill when a big tier merges or a bomb explodes. */
  flashColor: '#ffffff',
  /** Screen flash when a big tier merges or bomb explodes */
  flashDurationMs: 100,
  flashAlpha: 0.35,
  /** Minimum result tier that triggers flash (tier 4 = value 32) */
  flashTierThreshold: 4,
  /** Camera shake */
  shakeIntensity: 12,
  shakeDurationMs: 250,
  shakeDecay: 0.9,
  /** Squash & stretch on collision/landing */
  squashStretchScale: 1.1,
  squashStretchDurationMs: 120,
  /** Merge pop: new ball scales 1.3 -> 1.0 */
  mergePopScale: 1.3,
  mergePopDurationMs: 150,
} as const;
