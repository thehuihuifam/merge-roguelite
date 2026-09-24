import {
  DANGER_LINE_Y,
  OVERFLOW_GRACE_MS,
  RESTING_SPEED_THRESHOLD,
  WARNING_ZONE_HEIGHT,
} from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import type { Ball, BallId, NearMissSample } from '@/core/types';

export interface OverflowReport {
  /** True when at least one ball rested above the danger line for the grace period. */
  readonly overflow: boolean;
  /** The ball closest to the danger line inside the warning zone, if any. */
  readonly nearMiss: NearMissSample | null;
  /** Ids currently resting above the danger line (grace timer running). */
  readonly ballsAboveLine: readonly BallId[];
}

export interface OverflowDetectorOptions {
  readonly dangerLineY?: number;
  readonly warningZoneHeight?: number;
  readonly graceMs?: number;
  readonly restingSpeed?: number;
}

/**
 * Pure danger-zone logic. Tracks how long each ball has been resting above the
 * danger line and produces the near-miss sample used by the juice hooks.
 */
export class OverflowDetector {
  private readonly dangerLineY: number;
  private readonly warningZoneHeight: number;
  private readonly graceMs: number;
  private readonly restingSpeed: number;
  private readonly timeAbove = new Map<BallId, number>();

  constructor(options: OverflowDetectorOptions = {}) {
    this.dangerLineY = options.dangerLineY ?? DANGER_LINE_Y;
    this.warningZoneHeight = options.warningZoneHeight ?? WARNING_ZONE_HEIGHT;
    this.graceMs = options.graceMs ?? OVERFLOW_GRACE_MS;
    this.restingSpeed = options.restingSpeed ?? RESTING_SPEED_THRESHOLD;
  }

  get lineY(): number {
    return this.dangerLineY;
  }

  update(balls: readonly Ball[], deltaMs: number): OverflowReport {
    const seen = new Set<BallId>();
    let overflow = false;
    let nearMiss: NearMissSample | null = null;
    const ballsAboveLine: BallId[] = [];

    for (const ball of balls) {
      seen.add(ball.id);
      const radius = getTierSpec(ball.tier).radius;
      const top = ball.position.y - radius;
      const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
      const resting = speed < this.restingSpeed;

      if (top < this.dangerLineY && resting) {
        const accumulated = (this.timeAbove.get(ball.id) ?? 0) + deltaMs;
        this.timeAbove.set(ball.id, accumulated);
        ballsAboveLine.push(ball.id);
        if (accumulated >= this.graceMs) {
          overflow = true;
        }
      } else {
        this.timeAbove.delete(ball.id);
      }

      if (resting) {
        const distance = top - this.dangerLineY;
        if (distance < this.warningZoneHeight) {
          const severity = clamp01(1 - distance / this.warningZoneHeight);
          if (nearMiss === null || severity > nearMiss.severity) {
            nearMiss = { severity, ballId: ball.id, distanceToLine: Math.max(0, distance) };
          }
        }
      }
    }

    for (const id of Array.from(this.timeAbove.keys())) {
      if (!seen.has(id)) {
        this.timeAbove.delete(id);
      }
    }

    return { overflow, nearMiss, ballsAboveLine };
  }

  reset(): void {
    this.timeAbove.clear();
  }
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
