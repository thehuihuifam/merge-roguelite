import type { Ball, BallId } from '@/core/types';

/** Authoritative collection of balls currently inside the board. */
export class BallRegistry {
  private readonly balls = new Map<BallId, Ball>();

  add(ball: Ball): void {
    if (this.balls.has(ball.id)) {
      throw new Error(`Ball ${ball.id} is already registered`);
    }
    this.balls.set(ball.id, ball);
  }

  remove(id: BallId): Ball | undefined {
    const ball = this.balls.get(id);
    this.balls.delete(id);
    return ball;
  }

  get(id: BallId): Ball | undefined {
    return this.balls.get(id);
  }

  has(id: BallId): boolean {
    return this.balls.has(id);
  }

  all(): Ball[] {
    return Array.from(this.balls.values());
  }

  get size(): number {
    return this.balls.size;
  }

  clear(): void {
    this.balls.clear();
  }
}
