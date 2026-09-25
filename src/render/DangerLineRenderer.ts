import { BOARD } from '@/config/gameConfig';
import { PALETTE } from '@/render/palette';

/**
 * Draws the danger line. Intensity (0..1) comes from the near-miss hook and
 * drives the line opacity. The red vignette itself is animated separately by
 * `src/render/NearMissVignetteRenderer.ts` (Task 2.1).
 */
export function drawDangerLine(ctx: CanvasRenderingContext2D, y: number, intensity: number): void {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.35 + 0.65 * intensity;
  ctx.strokeStyle = PALETTE.dangerLine;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(BOARD.width, y);
  ctx.stroke();
  ctx.restore();
}
