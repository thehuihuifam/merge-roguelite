import { BOARD, SPAWN_Y } from '@/config/gameConfig';
import { drawBalls } from '@/render/BallRenderer';
import { drawDangerLine } from '@/render/DangerLineRenderer';
import { drawGameOver, drawHeldBall, drawHud, drawIdle } from '@/render/HudRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';

/**
 * Renders a GameSnapshot to a 2D canvas. Keeps the logical board size fixed
 * and scales to the element's CSS size with device-pixel-ratio awareness.
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private scale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('2D canvas context is not available');
    }
    this.ctx = ctx;
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
    drawHeldBall(ctx, snapshot, SPAWN_Y);
    ctx.restore();

    drawHud(ctx, snapshot);

    if (snapshot.state === 'idle') {
      drawIdle(ctx);
    } else if (snapshot.state === 'game_over') {
      drawGameOver(ctx, snapshot);
    }
  }
}
