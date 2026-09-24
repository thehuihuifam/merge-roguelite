import { afterEach, describe, expect, it } from 'vitest';
import { BOARD } from '@/config/gameConfig';
import { getTierSpec } from '@/core/ball/BallFactory';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { Ball } from '@/core/types';

function ball(id: number, tier: number, x: number, y: number): Ball {
  return { id, tier, position: { x, y }, velocity: { x: 0, y: 0 }, spawnedAt: 0 };
}

describe('PhysicsWorld', () => {
  let world: PhysicsWorld;

  afterEach(() => {
    world.dispose();
  });

  it('lets a ball fall and come to rest on the floor', () => {
    world = new PhysicsWorld();
    const b = ball(1, 0, BOARD.width / 2, 60);
    world.addBall(b);
    for (let i = 0; i < 600; i += 1) {
      world.step(1000 / 60);
    }
    world.sync([b]);
    const radius = getTierSpec(0).radius;
    expect(b.position.y).toBeGreaterThan(BOARD.height - radius - 3);
    expect(b.position.y).toBeLessThan(BOARD.height);
    expect(world.maxSpeed()).toBeLessThan(0.6);
  });

  it('keeps balls inside the side walls', () => {
    world = new PhysicsWorld();
    const b = ball(1, 2, 30, 100);
    world.addBall(b, { x: -30, y: 0 });
    for (let i = 0; i < 200; i += 1) {
      world.step(1000 / 60);
    }
    world.sync([b]);
    const radius = getTierSpec(2).radius;
    expect(b.position.x).toBeGreaterThanOrEqual(radius - 2);
    expect(b.position.x).toBeLessThanOrEqual(BOARD.width - radius + 2);
  });

  it('reports collisions between two touching balls', () => {
    world = new PhysicsWorld();
    const a = ball(1, 1, 200, 600);
    const b = ball(2, 1, 200, 650);
    world.addBall(a);
    world.addBall(b);
    let pairs = world.drainCollisions();
    for (let i = 0; i < 60 && pairs.length === 0; i += 1) {
      world.step(1000 / 60);
      pairs = world.drainCollisions();
    }
    expect(pairs).toEqual([{ a: 1, b: 2 }]);
  });

  it('adds and removes bodies', () => {
    world = new PhysicsWorld();
    const b = ball(1, 0, 100, 100);
    world.addBall(b);
    expect(world.hasBall(1)).toBe(true);
    expect(world.ballCount).toBe(1);
    expect(() => world.addBall(b)).toThrow();
    expect(world.removeBall(1)).toBe(true);
    expect(world.removeBall(1)).toBe(false);
    expect(world.ballCount).toBe(0);
  });
});
