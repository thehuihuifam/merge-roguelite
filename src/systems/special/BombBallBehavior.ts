import { SPECIAL_BALLS } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import type { EventBus } from '@/core/events/EventBus';
import type { GameEventMap } from '@/core/events/GameEvents';
import type { ISpecialBallBehavior } from '@/core/interfaces/ISpecialBall';
import type { Ball } from '@/core/types';

/**
 * Pure blast selection: the bomb itself, the ball it touched (even from
 * outside the radius), and every ball whose centre lies within `radius`.
 */
export function blastVictims(
  bomb: Ball,
  balls: readonly Ball[],
  radius: number,
  contact: Ball | null = null,
): Ball[] {
  const victims: Ball[] = [];
  for (const ball of balls) {
    const distance = Math.hypot(
      ball.position.x - bomb.position.x,
      ball.position.y - bomb.position.y,
    );
    const isContact = contact !== null && ball.id === contact.id;
    if (ball.id === bomb.id || isContact || distance <= radius) {
      victims.push(ball);
    }
  }
  return victims;
}

/**
 * Blast score (Task 2.14): the removed balls' tier values — the bomb's own
 * included — times `ratio`, rounded to whole points. Flat by design: no
 * chain bonus, no card multipliers, just compensation for cleared mass.
 */
export function blastScore(victims: readonly Ball[], ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < 0) {
    throw new RangeError(`blastScore ratio must be a finite number >= 0, got ${ratio}`);
  }
  const total = victims.reduce((sum, ball) => sum + getTierSpec(ball.tier).value, 0);
  return Math.round(total * ratio);
}

/**
 * Bomb special ball (Task 2.3): never merges — the first contact detonates it
 * and every neighbour inside `blastRadius` (see the interface field). The host
 * (`Game`) executes the blast and emits `ball:detonated`; this behavior owns
 * the bomb's life-cycle announcements (`bomb:spawned`, `bomb:contact`) so
 * juice systems can react independently.
 */
export class BombBallBehavior implements ISpecialBallBehavior {
  readonly kind = 'bomb' as const;
  readonly blastRadius: number;
  private readonly events: EventBus<GameEventMap>;

  constructor(events: EventBus<GameEventMap>, blastRadius: number = SPECIAL_BALLS.bombBlastRadius) {
    if (!Number.isFinite(blastRadius) || blastRadius <= 0) {
      throw new RangeError(`blastRadius must be positive, got ${blastRadius}`);
    }
    this.events = events;
    this.blastRadius = blastRadius;
  }

  /** Bombs never merge: the first contact detonates them instead. */
  canMergeWith(): boolean | null {
    return false;
  }

  /** A bomb entering the world is armed and announced. */
  onSpawn(self: Ball): void {
    this.events.emit('bomb:spawned', { bomb: self });
  }

  /** First contact: announce it, then the host detonates the bomb. */
  onCollide(self: Ball, other: Ball): void {
    this.events.emit('bomb:contact', { bomb: self, other });
  }

  /** Invariant guard: bombs detonate on first contact and never reach a merge. */
  onMerged(self: Ball): void {
    throw new Error(`Bomb ${self.id} cannot merge; it detonates on first contact`);
  }
}
