import Matter from 'matter-js';
import { BALL_MATERIAL, BOARD } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import type { Ball } from '@/core/types';

export const BALL_LABEL_PREFIX = 'ball:';
export const WALL_LABEL = 'wall';

export function ballLabel(id: number): string {
  return `${BALL_LABEL_PREFIX}${id}`;
}

export function parseBallLabel(label: string): number | null {
  if (!label.startsWith(BALL_LABEL_PREFIX)) {
    return null;
  }
  const id = Number(label.slice(BALL_LABEL_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

export function createBallBody(ball: Ball): Matter.Body {
  const spec = getTierSpec(ball.tier);
  return Matter.Bodies.circle(ball.position.x, ball.position.y, spec.radius, {
    label: ballLabel(ball.id),
    restitution: BALL_MATERIAL.restitution,
    friction: BALL_MATERIAL.friction,
    frictionStatic: BALL_MATERIAL.frictionStatic,
    frictionAir: BALL_MATERIAL.frictionAir,
    density: BALL_MATERIAL.density,
  });
}

export function createWallBodies(): Matter.Body[] {
  const t = BOARD.wallThickness;
  const w = BOARD.width;
  const h = BOARD.height;
  const options: Matter.IChamferableBodyDefinition = {
    isStatic: true,
    label: WALL_LABEL,
    friction: 0.3,
    restitution: 0.05,
  };
  return [
    Matter.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, options),
    Matter.Bodies.rectangle(-t / 2, h / 2, t, h * 3, options),
    Matter.Bodies.rectangle(w + t / 2, h / 2, t, h * 3, options),
  ];
}
