import { FONT_STACK, FX } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { PALETTE } from '@/render/palette';
import type { Ball } from '@/core/types';
import type { SpecialBallKind } from '@/core/interfaces/ISpecialBall';

const FONT = FONT_STACK;

/**
 * Per-ball animation state for squash-stretch and merge pop.
 * Kept local to the renderer — physics is untouched.
 */
export interface BallFxState {
  /** Squash-stretch: scale X/Y, 1 = normal */
  squashX: number;
  squashY: number;
  squashTimeMs: number;
  /** Merge pop: scale multiplier */
  popScale: number;
  popTimeMs: number;
}

const ballFx = new Map<number, BallFxState>();

function getFxState(id: number): BallFxState {
  let state = ballFx.get(id);
  if (state === undefined) {
    state = {
      squashX: 1,
      squashY: 1,
      squashTimeMs: 0,
      popScale: 1,
      popTimeMs: 0,
    };
    ballFx.set(id, state);
  }
  return state;
}

/**
 * Trigger squash-stretch for a ball (landing / collision).
 * Direction is inferred from velocity — stretched along motion.
 */
export function triggerSquashStretch(id: number, vx: number, vy: number): void {
  const state = getFxState(id);
  const speed = Math.hypot(vx, vy);
  if (speed < 0.1) {
    state.squashX = FX.squashStretchScale;
    state.squashY = 1 / FX.squashStretchScale;
  } else {
    if (Math.abs(vx) > Math.abs(vy)) {
      state.squashX = FX.squashStretchScale;
      state.squashY = 1 / FX.squashStretchScale;
    } else {
      state.squashX = 1 / FX.squashStretchScale;
      state.squashY = FX.squashStretchScale;
    }
  }
  state.squashTimeMs = FX.squashStretchDurationMs;
}

/** Trigger merge pop for a newly created ball. */
export function triggerMergePop(id: number): void {
  const state = getFxState(id);
  state.popScale = FX.mergePopScale;
  state.popTimeMs = FX.mergePopDurationMs;
}

/** Advance all FX timers by deltaMs and decay toward identity. */
export function updateBallFx(deltaMs: number): void {
  for (const [id, state] of ballFx) {
    if (state.squashTimeMs > 0) {
      state.squashTimeMs = Math.max(0, state.squashTimeMs - deltaMs);
      const t = state.squashTimeMs / FX.squashStretchDurationMs;
      const eased = 1 - Math.pow(1 - t, 3);
      if (state.squashX > 1) {
        state.squashX = 1 + (FX.squashStretchScale - 1) * eased;
      } else if (state.squashX < 1) {
        state.squashX = 1 + (1 / FX.squashStretchScale - 1) * eased;
      }
      if (state.squashY > 1) {
        state.squashY = 1 + (FX.squashStretchScale - 1) * eased;
      } else if (state.squashY < 1) {
        state.squashY = 1 + (1 / FX.squashStretchScale - 1) * eased;
      }
      if (state.squashTimeMs === 0) {
        state.squashX = 1;
        state.squashY = 1;
      }
    }
    if (state.popTimeMs > 0) {
      state.popTimeMs = Math.max(0, state.popTimeMs - deltaMs);
      const t = state.popTimeMs / FX.mergePopDurationMs;
      const eased = 1 - Math.pow(1 - t, 3);
      state.popScale = 1 + (FX.mergePopScale - 1) * eased;
      if (state.popTimeMs === 0) {
        state.popScale = 1;
      }
    }
    void id;
  }
}

/** Remove FX state for balls that no longer exist. */
export function pruneBallFx(activeIds: Set<number>): void {
  for (const id of ballFx.keys()) {
    if (!activeIds.has(id)) {
      ballFx.delete(id);
    }
  }
}

/** For tests: get current scale for a ball, or identity if none. */
export function getBallFxForTest(id: number): { squashX: number; squashY: number; popScale: number } {
  const s = ballFx.get(id);
  if (s === undefined) {
    return { squashX: 1, squashY: 1, popScale: 1 };
  }
  return { squashX: s.squashX, squashY: s.squashY, popScale: s.popScale };
}

/** For tests: clear all FX state. */
export function clearBallFxForTest(): void {
  ballFx.clear();
}

export function drawBallShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: number,
  alpha = 1,
  special: SpecialBallKind | null = null,
  fxState?: BallFxState,
): void {
  const spec = getTierSpec(tier);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (fxState !== undefined) {
    const sx = fxState.squashX * fxState.popScale;
    const sy = fxState.squashY * fxState.popScale;
    ctx.scale(sx, sy);
  }
  ctx.beginPath();
  ctx.arc(0, 0, spec.radius, 0, Math.PI * 2);
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
  ctx.fillText(String(spec.value), 0, 1);

  if (special === 'bomb') {
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.bombRing;
    ctx.beginPath();
    ctx.arc(0, 0, spec.radius - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.bombSpark;
    ctx.font = `700 ${Math.max(10, Math.floor(spec.radius * 0.55))}px ${FONT}`;
    ctx.fillText('✹', spec.radius * 0.55, -spec.radius * 0.55);
  }
  ctx.restore();
}

export function drawBalls(ctx: CanvasRenderingContext2D, balls: readonly Ball[]): void {
  for (const ball of balls) {
    const fx = ballFx.get(ball.id);
    drawBallShape(ctx, ball.position.x, ball.position.y, ball.tier, 1, ball.special ?? null, fx);
  }
}
