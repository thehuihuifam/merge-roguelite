import { BOARD } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { drawBallShape } from '@/render/BallRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export function drawHud(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  ctx.save();
  ctx.textBaseline = 'top';

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', 14, 12);
  ctx.fillText('BEST', 14, 52);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(snapshot.score.toLocaleString('en-US'), 14, 26);
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(snapshot.best.toLocaleString('en-US'), 14, 66);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('NEXT', BOARD.width - 14, 12);
  ctx.restore();

  const nextSpec = getTierSpec(snapshot.nextTier);
  const previewScale = Math.min(1, 18 / nextSpec.radius);
  ctx.save();
  ctx.translate(BOARD.width - 14 - 20, 48);
  ctx.scale(previewScale, previewScale);
  drawBallShape(ctx, 0, 0, snapshot.nextTier, 1, snapshot.nextSpecial);
  ctx.restore();

  if (snapshot.timeScale < 1) {
    ctx.save();
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`SLOW ×${snapshot.timeScale.toFixed(2)}`, BOARD.width / 2, 12);
    ctx.restore();
  }
}

export function drawHeldBall(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  spawnY: number,
): void {
  if (snapshot.held === null) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = PALETTE.guide;
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(snapshot.held.x, spawnY);
  ctx.lineTo(snapshot.held.x, BOARD.height);
  ctx.stroke();
  ctx.restore();
  drawBallShape(ctx, snapshot.held.x, spawnY, snapshot.held.tier, 1, snapshot.held.special);
}

export function drawGameOver(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  ctx.save();
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('RUN OVER', BOARD.width / 2, BOARD.height / 2 - 50);
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(
    `Score ${snapshot.score.toLocaleString('en-US')}`,
    BOARD.width / 2,
    BOARD.height / 2,
  );
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(
    `Best ${snapshot.best.toLocaleString('en-US')}`,
    BOARD.width / 2,
    BOARD.height / 2 + 32,
  );
  ctx.fillText('Click / tap or press R to restart', BOARD.width / 2, BOARD.height / 2 + 80);
  ctx.restore();
}

export function drawIdle(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText('MERGE ROGUELITE', BOARD.width / 2, BOARD.height / 2 - 30);
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('Click / tap to start', BOARD.width / 2, BOARD.height / 2 + 20);
  ctx.restore();
}
