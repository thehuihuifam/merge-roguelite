import Matter from 'matter-js';
import { parseBallLabel } from '@/physics/BodyFactory';
import type { CollisionPair } from '@/core/types';

/**
 * Buffers ball-vs-ball collision starts emitted by Matter.js during a step so
 * the merge resolver can process them after the step finishes.
 */
export class CollisionCollector {
  private buffer: CollisionPair[] = [];

  attach(engine: Matter.Engine): () => void {
    const handler = (event: Matter.IEventCollision<Matter.Engine>): void => {
      for (const pair of event.pairs) {
        const a = parseBallLabel(pair.bodyA.label);
        const b = parseBallLabel(pair.bodyB.label);
        if (a === null || b === null) {
          continue;
        }
        this.buffer.push(a < b ? { a, b } : { a: b, b: a });
      }
    };
    Matter.Events.on(engine, 'collisionStart', handler);
    Matter.Events.on(engine, 'collisionActive', handler);
    return (): void => {
      Matter.Events.off(engine, 'collisionStart', handler);
      Matter.Events.off(engine, 'collisionActive', handler);
    };
  }

  /** Returns and clears buffered pairs, de-duplicated and sorted for determinism. */
  drain(): CollisionPair[] {
    const unique = new Map<string, CollisionPair>();
    for (const pair of this.buffer) {
      unique.set(`${pair.a}:${pair.b}`, pair);
    }
    this.buffer = [];
    return Array.from(unique.values()).sort((p, q) => p.a - q.a || p.b - q.b);
  }

  clear(): void {
    this.buffer = [];
  }
}
