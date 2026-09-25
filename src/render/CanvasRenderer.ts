import { BOARD, FX, SPAWN_Y } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { drawBalls, pruneBallFx, triggerMergePop, updateBallFx } from '@/render/BallRenderer';
import { drawCardOverlay } from '@/render/CardOverlayRenderer';
import { drawDangerLine } from '@/render/DangerLineRenderer';
import {
  HudProgressionAnimator,
  drawGameOver,
  drawHeldBall,
  drawHud,
  drawIdle,
} from '@/render/HudRenderer';
import { NearMissVignetteAnimator, drawNearMissVignette } from '@/render/NearMissVignetteRenderer';
import { drawSpawnPenaltyHud } from '@/render/SpawnPenaltyHudRenderer';
import { PostProcessPipeline } from '@/render/PostProcessPipeline';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';
import type { IParticleSystem } from '@/core/interfaces/IParticleSystem';

/** Wall-clock source driving the vignette animation between frames. */
export type Clock = () => number;

function defaultClock(): number {
  return performance.now();
}

export interface CanvasRendererOptions {
  readonly clock?: Clock;
  readonly particles?: IParticleSystem | undefined;
}

/**
 * Renders a GameSnapshot to a 2D canvas. Keeps the logical board size fixed
 * and scales to the element's CSS size with device-pixel-ratio awareness.
 * Includes FX: flash, shake, ball squash-stretch and merge pop.
 *
 * Two coexisting paths:
 * - WebGL (default when available): the scene is drawn to an offscreen 2D
 *   canvas, then `PostProcessPipeline` uploads it as a texture and runs the
 *   single-pass bloom/vignette/chromatic/grain shader onto the visible canvas.
 * - Canvas 2D fallback: when WebGL cannot be created, the scene is drawn
 *   straight to the visible canvas exactly as before.
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pipeline: PostProcessPipeline | null;
  private readonly offscreen: HTMLCanvasElement | null;
  private readonly vignette = new NearMissVignetteAnimator();
  private readonly hudProgression = new HudProgressionAnimator();
  private readonly clock: Clock;
  private readonly particles: IParticleSystem | undefined;
  private lastFrameMs: number | null = null;
  private scale = 1;

  // FX state
  private flashRemainingMs = 0;
  private flashColor: string = FX.flashColor;
  private flashAlpha: number = FX.flashAlpha;
  private shakeRemainingMs = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;
  private shakeIntensityFactor = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    clockOrOptions: Clock | CanvasRendererOptions = defaultClock,
  ) {
    // WebGL post-processing when supported, direct Canvas 2D otherwise.
    let pipeline: PostProcessPipeline | null = null;
    let offscreen: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    if (PostProcessPipeline.isSupported()) {
      try {
        pipeline = PostProcessPipeline.create(canvas);
        offscreen = document.createElement('canvas');
        ctx = offscreen.getContext('2d');
        if (ctx === null) {
          pipeline.dispose();
          pipeline = null;
          offscreen = null;
        }
      } catch (error) {
        console.warn('WebGL post-processing unavailable; using direct Canvas 2D.', error);
        pipeline = null;
        offscreen = null;
        ctx = null;
      }
    }
    if (ctx === null) {
      ctx = canvas.getContext('2d');
    }
    if (ctx === null) {
      throw new Error('2D canvas context is not available');
    }
    this.ctx = ctx;
    this.pipeline = pipeline;
    this.offscreen = offscreen;
    if (typeof clockOrOptions === 'function') {
      this.clock = clockOrOptions;
      this.particles = undefined;
    } else {
      this.clock = clockOrOptions.clock ?? defaultClock;
      this.particles = clockOrOptions.particles ?? undefined;
    }
    this.resize();
  }

  /** Fits the board inside the canvas' CSS box, preserving aspect ratio. */
  resize(): void {
    const dpr =
      (typeof window !== 'undefined'
        ? (window as { devicePixelRatio?: number }).devicePixelRatio
        : 1) || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    this.canvas.width = Math.floor(cssWidth * dpr);
    this.canvas.height = Math.floor(cssHeight * dpr);
    if (this.offscreen !== null) {
      this.offscreen.width = this.canvas.width;
      this.offscreen.height = this.canvas.height;
    }
    this.scale = Math.min(cssWidth / BOARD.width, cssHeight / BOARD.height);
  }

  /** Converts a client-space point into board coordinates. */
  toBoardX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const offsetX = (rect.width - BOARD.width * this.scale) / 2;
    return (clientX - rect.left - offsetX) / this.scale;
  }

  /** Converts a client-space point into board coordinates. */
  toBoardY(clientY: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const offsetY = (rect.height - BOARD.height * this.scale) / 2;
    return (clientY - rect.top - offsetY) / this.scale;
  }

  /** True when frames run through the WebGL post-process pipeline. */
  get postProcessingEnabled(): boolean {
    return this.pipeline !== null;
  }

  /**
   * Pulses chromatic aberration (merge / bomb detonation moments). No-op on
   * the Canvas 2D fallback path.
   */
  triggerChromaticAberration(strength: number): void {
    this.pipeline?.pulseChromaticAberration(strength);
  }

  /** Trigger screen flash for big merges / bomb. */
  triggerFlash(color: string = FX.flashColor, alpha: number = FX.flashAlpha): void {
    this.flashRemainingMs = FX.flashDurationMs;
    this.flashColor = color;
    this.flashAlpha = alpha;
  }

  /** Trigger flash based on tier (white for bomb/max, tier color otherwise). */
  triggerFlashForTier(tier: number | null): void {
    if (tier === null) {
      this.triggerFlash(FX.flashColor, FX.flashAlpha);
      return;
    }
    if (tier >= FX.flashTierThreshold) {
      const spec = getTierSpec(tier);
      this.triggerFlash(spec.color, FX.flashAlpha);
    }
  }

  /** Trigger camera shake. intensityFactor scales base intensity. */
  triggerShake(intensityFactor = 1): void {
    this.shakeRemainingMs = FX.shakeDurationMs;
    this.shakeIntensityFactor = intensityFactor;
  }

  /** For tests: current shake offset */
  getShakeOffsetForTest(): { x: number; y: number; remainingMs: number } {
    return {
      x: this.shakeOffsetX,
      y: this.shakeOffsetY,
      remainingMs: this.shakeRemainingMs,
    };
  }

  /** For tests: current flash alpha */
  getFlashAlphaForTest(): number {
    if (this.flashRemainingMs <= 0) {
      return 0;
    }
    return (this.flashRemainingMs / FX.flashDurationMs) * this.flashAlpha;
  }

  /** For tests: advance FX timers without rendering */
  advanceFxForTest(deltaMs: number): void {
    this.updateFx(deltaMs);
  }

  private updateFx(deltaMs: number): void {
    if (this.flashRemainingMs > 0) {
      this.flashRemainingMs = Math.max(0, this.flashRemainingMs - deltaMs);
    }
    if (this.shakeRemainingMs > 0) {
      this.shakeRemainingMs = Math.max(0, this.shakeRemainingMs - deltaMs);
      if (this.shakeRemainingMs === 0) {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      } else {
        const progress = this.shakeRemainingMs / FX.shakeDurationMs;
        const currentIntensity = FX.shakeIntensity * progress * this.shakeIntensityFactor;
        this.shakeOffsetX = (Math.random() * 2 - 1) * currentIntensity;
        this.shakeOffsetY = (Math.random() * 2 - 1) * currentIntensity;
      }
    }
    updateBallFx(deltaMs);
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    const dpr =
      (typeof window !== 'undefined'
        ? (window as { devicePixelRatio?: number }).devicePixelRatio
        : 1) || 1;
    const cssWidth = this.canvas.width / dpr;
    const cssHeight = this.canvas.height / dpr;

    const frameMs = this.clock();
    const deltaMs = this.lastFrameMs === null ? 0 : Math.max(0, frameMs - this.lastFrameMs);
    this.lastFrameMs = frameMs;

    this.updateFx(deltaMs);
    this.hudProgression.update(snapshot, deltaMs);
    const activeIds = new Set<number>(snapshot.balls.map((b) => b.id));
    pruneBallFx(activeIds);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.bg.deep;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const offsetX = (cssWidth - BOARD.width * this.scale) / 2;
    const offsetY = (cssHeight - BOARD.height * this.scale) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(this.scale, this.scale);

    if (this.shakeRemainingMs > 0) {
      ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    ctx.fillStyle = PALETTE.bg.board;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    ctx.strokeStyle = PALETTE.bg.panel;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, BOARD.width - 2, BOARD.height - 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, BOARD.width, BOARD.height);
    ctx.clip();
    drawDangerLine(ctx, snapshot.dangerLineY, snapshot.nearMissIntensity);
    drawBalls(ctx, snapshot.balls);
    if (this.particles !== undefined) {
      this.particles.render(ctx);
    }
    drawHeldBall(ctx, snapshot, SPAWN_Y);
    this.vignette.update(snapshot.nearMissIntensity, deltaMs, snapshot.state === 'game_over');
    drawNearMissVignette(ctx, this.vignette.getAlpha(), this.vignette.getPulse());

    if (this.flashRemainingMs > 0) {
      const alpha = (this.flashRemainingMs / FX.flashDurationMs) * this.flashAlpha;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, BOARD.width, BOARD.height);
      ctx.restore();
    }

    ctx.restore();

    if (snapshot.state === 'slowmo_select') {
      drawCardOverlay(ctx, snapshot.pendingCards);
    }

    drawHud(ctx, snapshot, this.hudProgression);
    drawSpawnPenaltyHud(ctx, snapshot);

    if (snapshot.state === 'idle') {
      drawIdle(ctx);
    } else if (snapshot.state === 'game_over') {
      drawGameOver(ctx, snapshot);
    }

    // WebGL path: the scene above landed on the offscreen canvas — upload it
    // as a texture and run the composed post-process shader onto the screen.
    if (this.pipeline !== null && this.offscreen !== null) {
      this.pipeline.setNearMissIntensity(snapshot.nearMissIntensity);
      this.pipeline.render(this.offscreen, frameMs);
    }
  }
}

/** Helper for createApp to trigger merge pop when a merge creates a new ball. */
export function handleMergePopForSnapshot(
  renderer: CanvasRenderer,
  newTier: number | null,
  newBallId?: number,
): void {
  if (newTier === null || (newTier !== null && newTier >= FX.flashTierThreshold)) {
    renderer.triggerFlashForTier(newTier);
    const intensity = newTier === null ? 1.5 : 0.5 + newTier * 0.15;
    renderer.triggerShake(intensity);
  }
  if (newBallId !== undefined) {
    triggerMergePop(newBallId);
  }
  void renderer;
}
