import type { Vec2 } from '@/core/types';

export type ParticleBurstKind = 'merge' | 'merge_max' | 'drop_dust' | 'danger_spark';

export interface ParticleBurstRequest {
  readonly kind: ParticleBurstKind;
  readonly position: Vec2;
  readonly color: string;
  /** 0..1 */
  readonly intensity: number;
}

export interface IParticleSystem {
  burst(request: ParticleBurstRequest): void;
  update(deltaMs: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  clear(): void;
}
