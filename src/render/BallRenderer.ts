import { FONT_STACK } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { PALETTE } from '@/render/palette';
import type { Ball } from '@/core/types';
import type { SpecialBallKind } from '@/core/interfaces/ISpecialBall';

const FONT = FONT_STACK;

export function drawBallShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: number,
  alpha = 1,
  special: SpecialBallKind | null = null,
): void {
  const spec = getTierSpec(tier);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, spec.radius, 0, Math.PI * 2);
  ctx.fillStyle = spec.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ballStroke;
  ctx.stroke();

  const fontSize = Math.max(10, Math.floor(spec.radius * (spec.value >= 1000 ? 0.62 : 0.8)));
  ctx.fillStyle = PALETTE.ballText;
  ctx.font = `700 ${fontSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(spec.value), x, y + 1);

  if (special === 'bomb') {
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.bombRing;
    ctx.beginPath();
    ctx.arc(x, y, spec.radius - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.bombSpark;
    ctx.font = `700 ${Math.max(10, Math.floor(spec.radius * 0.55))}px ${FONT}`;
    ctx.fillText('✹', x + spec.radius * 0.55, y - spec.radius * 0.55);
  }
  ctx.restore();
}

export function drawBalls(ctx: CanvasRenderingContext2D, balls: readonly Ball[]): void {
  for (const ball of balls) {
    drawBallShape(ctx, ball.position.x, ball.position.y, ball.tier, 1, ball.special ?? null);
  }
}
