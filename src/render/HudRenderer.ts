import { BOARD, DESIGN, FONT_STACK, TEXT } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { drawBallShape } from '@/render/BallRenderer';
import { PALETTE } from '@/render/palette';
import type { GameSnapshot } from '@/core/Game';

const FONT = FONT_STACK;

export function drawHud(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  const { caption, body, heading } = DESIGN.fontSize;
  const { medium, bold, black } = DESIGN.fontWeight;
  const space = DESIGN.space;

  ctx.save();
  ctx.textBaseline = 'top';

  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(TEXT.scoreLabel, space.lg, space.md);
  ctx.fillText(TEXT.bestLabel, space.lg, 52);

  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${black} ${heading}px ${FONT}`;
  ctx.fillText(snapshot.score.toLocaleString('ko-KR'), space.lg, 26);
  ctx.font = `${bold} ${body}px ${FONT}`;
  ctx.fillText(snapshot.best.toLocaleString('ko-KR'), space.lg, 66);

  if (snapshot.round !== undefined) {
    const dropsLeft = Math.max(0, snapshot.round.dropBudget - snapshot.round.dropsUsed);
    ctx.fillStyle = PALETTE.text.secondary;
    ctx.font = `${medium} ${caption}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(TEXT.roundStatus(snapshot.round.index, dropsLeft), space.lg, 88);
    ctx.fillStyle = PALETTE.text.primary;
    ctx.font = `${bold} ${body}px ${FONT}`;
    ctx.fillText(
      TEXT.scoreProgress(snapshot.round.scoreProgress, snapshot.round.targetScore),
      space.lg,
      102,
    );
  }

  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(TEXT.nextLabel, BOARD.width - space.lg, space.md);
  ctx.restore();

  const nextSpec = getTierSpec(snapshot.nextTier);
  const previewScale = Math.min(1, 18 / nextSpec.radius);
  ctx.save();
  ctx.translate(BOARD.width - space.lg - 20, 48);
  ctx.scale(previewScale, previewScale);
  drawBallShape(ctx, 0, 0, snapshot.nextTier, 1, snapshot.nextSpecial);
  ctx.restore();

  if (snapshot.timeScale < 1) {
    ctx.save();
    ctx.fillStyle = PALETTE.text.secondary;
    ctx.font = `${medium} ${caption}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      TEXT.slowMotionBadgeDynamic(snapshot.timeScale.toFixed(2)),
      BOARD.width / 2,
      space.md,
    );
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
  ctx.setLineDash([DESIGN.space.xs, DESIGN.space.xs + DESIGN.space.sm]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(snapshot.held.x, spawnY);
  ctx.lineTo(snapshot.held.x, BOARD.height);
  ctx.stroke();
  ctx.restore();
  drawBallShape(ctx, snapshot.held.x, spawnY, snapshot.held.tier, 1, snapshot.held.special);
}

export function drawGameOver(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  const { display, heading, body, caption } = DESIGN.fontSize;
  const { medium, bold, black } = DESIGN.fontWeight;
  ctx.save();
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${black} ${display}px ${FONT}`;
  ctx.fillText(TEXT.runOverTitle, BOARD.width / 2, BOARD.height / 2 - 50);
  ctx.font = `${bold} ${heading}px ${FONT}`;
  ctx.fillText(
    TEXT.scoreSummary(snapshot.score.toLocaleString('ko-KR')),
    BOARD.width / 2,
    BOARD.height / 2,
  );
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${body}px ${FONT}`;
  ctx.fillText(
    TEXT.bestSummary(snapshot.best.toLocaleString('ko-KR')),
    BOARD.width / 2,
    BOARD.height / 2 + 32,
  );
  ctx.fillStyle = PALETTE.text.dim;
  ctx.font = `${medium} ${caption}px ${FONT}`;
  ctx.fillText(TEXT.restartHint, BOARD.width / 2, BOARD.height / 2 + 80);
  ctx.restore();
}

export function drawIdle(ctx: CanvasRenderingContext2D): void {
  const { display, body } = DESIGN.fontSize;
  const { medium, black } = DESIGN.fontWeight;
  ctx.save();
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text.primary;
  ctx.font = `${black} ${display}px ${FONT}`;
  ctx.fillText(TEXT.gameTitle, BOARD.width / 2, BOARD.height / 2 - 30);
  ctx.fillStyle = PALETTE.text.secondary;
  ctx.font = `${medium} ${body}px ${FONT}`;
  ctx.fillText(TEXT.startHint, BOARD.width / 2, BOARD.height / 2 + 20);
  ctx.restore();
}
