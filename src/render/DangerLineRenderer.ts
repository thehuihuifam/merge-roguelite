import { BOARD } from '@/config/gameConfig';
import { PALETTE } from '@/render/palette';

/**
 * Draws the danger line. Intensity (0..1) comes from the near-miss hook and
 * drives line opacity plus a red vignette – the v0.1.0 stand-in for the full
 * near-miss presentation.
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

  if (intensity > 0) {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      BOARD.width / 2,
      BOARD.height / 2,
      BOARD.height * 0.35,
      BOARD.width / 2,
      BOARD.height / 2,
      BOARD.height * 0.75,
    );
    gradient.addColorStop(0, 'rgba(255, 77, 109, 0)');
    gradient.addColorStop(1, `rgba(255, 77, 109, ${(0.45 * intensity).toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    ctx.restore();
  }
}
