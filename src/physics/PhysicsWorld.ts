import Matter from 'matter-js';
import { GRAVITY_Y } from '@/config/gameConfig';
import { CollisionCollector } from '@/physics/CollisionCollector';
import { createBallBody, createWallBodies } from '@/physics/BodyFactory';
import type { Ball, BallId, CollisionPair, Vec2 } from '@/core/types';

/**
 * Thin wrapper around Matter.js. Owns the engine, walls and the mapping from
 * ball ids to bodies. Nothing outside src/physics imports Matter directly.
 */
export class PhysicsWorld {
  private readonly engine: Matter.Engine;
  private readonly bodies = new Map<BallId, Matter.Body>();
  private readonly collisions = new CollisionCollector();
  private readonly detachCollisions: () => void;

  constructor() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: GRAVITY_Y, scale: 0.001 },
      positionIterations: 8,
      velocityIterations: 6,
    });
    Matter.Composite.add(this.engine.world, createWallBodies());
    this.detachCollisions = this.collisions.attach(this.engine);
  }

  addBall(ball: Ball, initialVelocity: Vec2 = { x: 0, y: 0 }): void {
    if (this.bodies.has(ball.id)) {
      throw new Error(`Body for ball ${ball.id} already exists`);
    }
    const body = createBallBody(ball);
    Matter.Body.setVelocity(body, { x: initialVelocity.x, y: initialVelocity.y });
    Matter.Composite.add(this.engine.world, body);
    this.bodies.set(ball.id, body);
  }

  removeBall(id: BallId): boolean {
    const body = this.bodies.get(id);
    if (body === undefined) {
      return false;
    }
    Matter.Composite.remove(this.engine.world, body);
    this.bodies.delete(id);
    return true;
  }

  hasBall(id: BallId): boolean {
    return this.bodies.has(id);
  }

  get ballCount(): number {
    return this.bodies.size;
  }

  step(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    Matter.Engine.update(this.engine, deltaMs);
  }

  /** Copies body transforms back into the domain balls. */
  sync(balls: Iterable<Ball>): void {
    for (const ball of balls) {
      const body = this.bodies.get(ball.id);
      if (body === undefined) {
        continue;
      }
      ball.position = { x: body.position.x, y: body.position.y };
      ball.velocity = { x: body.velocity.x, y: body.velocity.y };
    }
  }

  drainCollisions(): CollisionPair[] {
    return this.collisions.drain();
  }

  /** Largest speed among all ball bodies; used to decide when the board has settled. */
  maxSpeed(): number {
    let max = 0;
    for (const body of this.bodies.values()) {
      max = Math.max(max, body.speed);
    }
    return max;
  }

  clearBalls(): void {
    for (const body of this.bodies.values()) {
      Matter.Composite.remove(this.engine.world, body);
    }
    this.bodies.clear();
    this.collisions.clear();
  }

  dispose(): void {
    this.detachCollisions();
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.bodies.clear();
  }
}
