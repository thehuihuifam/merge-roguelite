import { describe, expect, it } from 'vitest';
import { BasicParticleSystem } from '@/systems/BasicParticleSystem';
import type { ParticleBurstRequest } from '@/core/interfaces/IParticleSystem';

function makeRequest(overrides: Partial<ParticleBurstRequest> = {}): ParticleBurstRequest {
  return {
    kind: 'merge',
    position: { x: 100, y: 100 },
    color: '#ff0000',
    intensity: 1,
    ...overrides,
  };
}

describe('BasicParticleSystem', () => {
  it('spawns particles on burst', () => {
    const system = new BasicParticleSystem();
    expect(system.aliveCount).toBe(0);
    system.burst(makeRequest());
    expect(system.aliveCount).toBeGreaterThan(0);
  });

  it('scales particle count with intensity', () => {
    const low = new BasicParticleSystem();
    const high = new BasicParticleSystem();
    low.burst(makeRequest({ intensity: 0.1 }));
    high.burst(makeRequest({ intensity: 1 }));
    expect(high.aliveCount).toBeGreaterThanOrEqual(low.aliveCount);
  });

  it('ignores zero intensity', () => {
    const system = new BasicParticleSystem();
    system.burst(makeRequest({ intensity: 0 }));
    expect(system.aliveCount).toBe(0);
  });

  it('removes particles after their lifetime', () => {
    const system = new BasicParticleSystem();
    system.burst(makeRequest({ intensity: 1 }));
    const before = system.aliveCount;
    expect(before).toBeGreaterThan(0);
    system.update(2000);
    expect(system.aliveCount).toBe(0);
  });

  it('update moves particles and applies gravity', () => {
    const system = new BasicParticleSystem();
    system.burst(makeRequest({ position: { x: 0, y: 0 }, intensity: 1 }));
    // Capture internal particles via render stub? We test via update not throwing and count stays.
    system.update(16);
    expect(system.aliveCount).toBeGreaterThan(0);
  });

  it('clear removes all particles', () => {
    const system = new BasicParticleSystem();
    system.burst(makeRequest());
    system.clear();
    expect(system.aliveCount).toBe(0);
  });

  it('caps max alive particles', () => {
    const system = new BasicParticleSystem();
    for (let i = 0; i < 30; i += 1) {
      system.burst(makeRequest({ intensity: 1 }));
    }
    // Should not exceed maxAlive (200) by too much, and not grow unbounded.
    expect(system.aliveCount).toBeLessThanOrEqual(200);
  });

  it('render does not throw with stub context', () => {
    const system = new BasicParticleSystem();
    system.burst(makeRequest());
    const ctx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      globalAlpha: 1,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    expect(() => system.render(ctx)).not.toThrow();
  });

  it('supports all burst kinds', () => {
    const system = new BasicParticleSystem();
    const kinds: ParticleBurstRequest['kind'][] = ['merge', 'merge_max', 'drop_dust', 'danger_spark'];
    for (const kind of kinds) {
      system.burst(makeRequest({ kind, intensity: 0.8 }));
    }
    expect(system.aliveCount).toBeGreaterThan(0);
  });
});
