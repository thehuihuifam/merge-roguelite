import { BOARD, SPAWN_Y } from '@/config/gameConfig';
import { drawBalls } from '@/render/BallRenderer';
import { drawCardOverlay } from '@/render/CardOverlayRenderer';
import { drawDangerLine } from '@/render/DangerLineRenderer';
import { drawGameOver, drawHeldBall, drawHud, drawIdle } from '@/render/HudRenderer';
import { NearMissVignetteAnimator, drawNearMissVignette } from '@/render/NearMissVignetteRenderer';
import { drawSpawnPenaltyHud } from '@/render/SpawnPenaltyHudRenderer';
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
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly vignette = new NearMissVignetteAnimator();
  private readonly clock: Clock;
  private readonly particles: IParticleSystem | undefined;
  private lastFrameMs: number | null = null;
  private scale = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    clockOrOptions: Clock | CanvasRendererOptions = defaultClock,
  ) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('2D canvas context is not available');
    }
    this.ctx = ctx;
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
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    this.canvas.width = Math.floor(cssWidth * dpr);
    this.canvas.height = Math.floor(cssHeight * dpr);
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

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = this.canvas.width / dpr;
    const cssHeight = this.canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const offsetX = (cssWidth - BOARD.width * this.scale) / 2;
    const offsetY = (cssHeight - BOARD.height * this.scale) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(this.scale, this.scale);

    ctx.fillStyle = PALETTE.board;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    ctx.strokeStyle = PALETTE.boardBorder;
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
    const frameMs = this.clock();
    const deltaMs = this.lastFrameMs === null ? 0 : Math.max(0, frameMs - this.lastFrameMs);
    this.lastFrameMs = frameMs;
    this.vignette.update(snapshot.nearMissIntensity, deltaMs, snapshot.state === 'game_over');
    drawNearMissVignette(ctx, this.vignette.getAlpha(), this.vignette.getPulse());
    ctx.restore();

    if (snapshot.state === 'slowmo_select') {
      drawCardOverlay(ctx, snapshot.pendingCards);
    }

    drawHud(ctx, snapshot);
    if (snapshot.spawnPenalty !== undefined) {
      drawSpawnPenaltyHud(ctx, snapshot.spawnPenalty);
    }

    if (snapshot.state === 'idle') {
      drawIdle(ctx);
    } else if (snapshot.state === 'game_over') {
      drawGameOver(ctx, snapshot);
    }
  }
}
