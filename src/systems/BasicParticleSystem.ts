import { PARTICLES } from '@/config/gameConfig';
import type {
  IParticleSystem,
  ParticleBurstKind,
  ParticleBurstRequest,
} from '@/core/interfaces/IParticleSystem';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
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

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function countForKind(kind: ParticleBurstKind, intensity: number): number {
  const clamped = clamp01(intensity);
  switch (kind) {
    case 'merge':
      return Math.max(1, Math.round(PARTICLES.mergeCount * (0.5 + 0.5 * clamped)));
    case 'merge_max':
      return Math.max(1, Math.round(PARTICLES.mergeMaxCount * (0.5 + 0.5 * clamped)));
    case 'drop_dust':
      return Math.max(1, Math.round(PARTICLES.dropDustCount * (0.5 + 0.5 * clamped)));
    case 'danger_spark':
      return Math.max(1, Math.round(PARTICLES.dangerSparkCount * (0.5 + 0.5 * clamped)));
    default:
      return Math.max(1, Math.round(PARTICLES.mergeCount * clamped));
  }
}

/**
 * Basic particle system: bursts of colored dots that fade and fall.
 * Pure rendering — no physics engine, no DOM, safe for Node tests
 * (render is a no-op if ctx is missing).
 */
export class BasicParticleSystem implements IParticleSystem {
  private particles: Particle[] = [];

  get aliveCount(): number {
    return this.particles.length;
  }

  burst(request: ParticleBurstRequest): void {
    const intensity = clamp01(request.intensity);
    if (intensity <= 0) {
      return;
    }
    const count = countForKind(request.kind, intensity);
    const baseSpeed = PARTICLES.speed * (0.6 + 0.8 * intensity);
    const baseSize = PARTICLES.size * (0.7 + 0.6 * intensity);

    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= PARTICLES.maxAlive) {
        break;
      }
      const angle = randomRange(0, Math.PI * 2);
      // Bias upward for merge bursts, downward for drop dust.
      let biasedAngle = angle;
      if (request.kind === 'merge' || request.kind === 'merge_max') {
        // Slight upward bias: map angle to prefer upper half.
        if (Math.random() < 0.6) {
          biasedAngle = randomRange(-Math.PI * 0.85, -Math.PI * 0.15);
        }
      } else if (request.kind === 'drop_dust') {
        biasedAngle = randomRange(Math.PI * 0.1, Math.PI * 0.9);
      }
      const speedJitter = 1 - PARTICLES.speedJitter + Math.random() * PARTICLES.speedJitter * 2;
      const speed = baseSpeed * speedJitter * (0.5 + Math.random() * 0.5);
      const vx = Math.cos(biasedAngle) * speed;
      const vy = Math.sin(biasedAngle) * speed;

      const lifeJitter = 1 - PARTICLES.lifetimeJitter + Math.random() * PARTICLES.lifetimeJitter * 2;
      const maxLife = PARTICLES.lifetimeMs * lifeJitter * (0.7 + 0.6 * intensity);

      this.particles.push({
        x: request.position.x + randomRange(-2, 2),
        y: request.position.y + randomRange(-2, 2),
        vx,
        vy,
        life: maxLife,
        maxLife,
        size: baseSize * randomRange(0.6, 1.3),
        color: request.color,
      });
    }
  }

  update(deltaMs: number): void {
    if (deltaMs <= 0 || this.particles.length === 0) {
      return;
    }
    const gravity = PARTICLES.gravity * deltaMs;
    const dragFactor = Math.max(0, 1 - PARTICLES.drag * deltaMs);

    const next: Particle[] = [];
    for (const p of this.particles) {
      p.life -= deltaMs;
      if (p.life <= 0) {
        continue;
      }
      p.vx *= dragFactor;
      p.vy = p.vy * dragFactor + gravity;
      // Scale velocity by delta to keep ~60fps baseline.
      const scale = deltaMs / 16.6667;
      p.x += p.vx * scale;
      p.y += p.vy * scale;
      next.push(p);
    }
    this.particles = next;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) {
      return;
    }
    ctx.save();
    for (const p of this.particles) {
      const alpha = clamp01(p.life / p.maxLife);
      if (alpha <= 0) {
        continue;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    this.particles = [];
  }
}
