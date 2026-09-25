import { describe, expect, it } from 'vitest';
import { BOARD, NEAR_MISS_FX } from '@/config/gameConfig';
import {
  NearMissVignetteAnimator,
  drawNearMissVignette,
  heartbeatPeriodMs,
  heartbeatPulse,
} from '@/render/NearMissVignetteRenderer';
import { PALETTE } from '@/render/palette';

interface GradientStop {
  readonly offset: number;
  readonly color: string;
}

/**
 * Minimal CanvasRenderingContext2D stand-in that records the gradient stops
 * and fill calls the vignette draws, so the draw path runs in Node.
 */
function createStubContext(): {
  ctx: CanvasRenderingContext2D;
  stops: GradientStop[];
  fills: { x: number; y: number; width: number; height: number }[];
} {
  const stops: GradientStop[] = [];
  const fills: { x: number; y: number; width: number; height: number }[] = [];
  const noop = (): void => {
    return;
  };
  const stub = {
    fillStyle: '',
    save: noop,
    restore: noop,
    createRadialGradient: (): { addColorStop: (offset: number, color: string) => void } => ({
      addColorStop: (offset: number, color: string): void => {
        stops.push({ offset, color });
      },
    }),
    fillRect: (x: number, y: number, width: number, height: number): void => {
      fills.push({ x, y, width, height });
    },
  };
  return { ctx: stub as unknown as CanvasRenderingContext2D, stops, fills };
}

describe('heartbeat math', () => {
  it('slows the heartbeat as severity drops and clamps outside 0..1', () => {
    expect(heartbeatPeriodMs(0)).toBe(NEAR_MISS_FX.heartbeatPeriodAtSeverityZeroMs);
    expect(heartbeatPeriodMs(1)).toBe(NEAR_MISS_FX.heartbeatPeriodAtSeverityOneMs);
    expect(heartbeatPeriodMs(0.5)).toBe(
      (NEAR_MISS_FX.heartbeatPeriodAtSeverityZeroMs + NEAR_MISS_FX.heartbeatPeriodAtSeverityOneMs) /
        2,
    );
    expect(heartbeatPeriodMs(-3)).toBe(NEAR_MISS_FX.heartbeatPeriodAtSeverityZeroMs);
    expect(heartbeatPeriodMs(7)).toBe(NEAR_MISS_FX.heartbeatPeriodAtSeverityOneMs);
  });

  it('keeps the pulse in 0..1 and wraps the cycle', () => {
    for (let phase = -1; phase <= 2; phase += 0.01) {
      const pulse = heartbeatPulse(phase);
      expect(pulse).toBeGreaterThanOrEqual(0);
      expect(pulse).toBeLessThanOrEqual(1);
    }
    expect(heartbeatPulse(0)).toBe(1);
    expect(heartbeatPulse(1)).toBe(heartbeatPulse(0));
    expect(heartbeatPulse(-0.5)).toBe(heartbeatPulse(0.5));
  });

  it('plays a strong "lub" at phase 0 and a softer "dub" at the echo phase', () => {
    expect(heartbeatPulse(0)).toBe(1);
    expect(heartbeatPulse(NEAR_MISS_FX.heartbeatEchoPhase)).toBeCloseTo(
      NEAR_MISS_FX.heartbeatEchoStrength,
      6,
    );
    expect(heartbeatPulse(NEAR_MISS_FX.heartbeatEchoPhase)).toBeLessThan(heartbeatPulse(0));
    expect(heartbeatPulse(0.5)).toBe(0);
  });
});

describe('NearMissVignetteAnimator', () => {
  it('fades the vignette in toward the current severity', () => {
    const animator = new NearMissVignetteAnimator();
    animator.update(0.8, 0);
    expect(animator.getAlpha()).toBe(0);
    animator.update(0.8, NEAR_MISS_FX.fadeInMs / 2);
    expect(animator.getAlpha()).toBeCloseTo(0.5, 6);
    animator.update(0.8, NEAR_MISS_FX.fadeInMs);
    expect(animator.getAlpha()).toBe(0.8);
  });

  it('fades out over 300ms once the near miss ends', () => {
    const animator = new NearMissVignetteAnimator();
    animator.update(1, NEAR_MISS_FX.fadeInMs);
    expect(animator.getAlpha()).toBe(1);
    animator.update(0, NEAR_MISS_FX.fadeOutMs / 2);
    expect(animator.getAlpha()).toBeCloseTo(0.5, 6);
    animator.update(0, NEAR_MISS_FX.fadeOutMs / 2);
    expect(animator.getAlpha()).toBe(0);
  });

  it('freezes the presentation while held (game over keeps the vignette up)', () => {
    const animator = new NearMissVignetteAnimator();
    animator.update(1, NEAR_MISS_FX.fadeInMs);
    const before = animator.getAlpha();
    animator.update(0, 5000, true);
    expect(animator.getAlpha()).toBe(before);
  });

  it('runs the heartbeat faster at severity 1 than at severity 0.2', () => {
    const intense = new NearMissVignetteAnimator();
    intense.update(1, 0);
    intense.update(1, heartbeatPeriodMs(1));
    expect(intense.getPulse()).toBeCloseTo(1, 6);
    intense.update(1, heartbeatPeriodMs(1) / 2);
    expect(intense.getPulse()).toBe(0);

    const calm = new NearMissVignetteAnimator();
    calm.update(0.2, 0);
    calm.update(0.2, heartbeatPeriodMs(1));
    expect(calm.getPulse()).toBeLessThan(0.5);
    calm.update(0.2, heartbeatPeriodMs(0.2) - heartbeatPeriodMs(1));
    expect(calm.getPulse()).toBeCloseTo(1, 6);
  });

  it('keeps the beat running while the vignette fades out', () => {
    const animator = new NearMissVignetteAnimator();
    animator.update(1, 0);
    animator.update(1, heartbeatPeriodMs(1));
    animator.update(0, heartbeatPeriodMs(1) / 2);
    expect(animator.getAlpha()).toBeCloseTo(0.25, 6);
    expect(animator.getPulse()).toBe(0);
    animator.update(0, NEAR_MISS_FX.fadeOutMs);
    expect(animator.getAlpha()).toBe(0);
  });
});

describe('near-miss vignette drawing', () => {
  it('paints a red radial vignette sized to its edge alpha', () => {
    const { ctx, stops, fills } = createStubContext();

    drawNearMissVignette(ctx, 1, 1);

    expect(stops).toHaveLength(2);
    expect(stops[0]?.color).toBe(`rgba(${PALETTE.nearMissVignetteRgb}, 0)`);
    expect(stops[1]?.color).toBe(
      `rgba(${PALETTE.nearMissVignetteRgb}, ${NEAR_MISS_FX.maxVignetteAlpha.toFixed(3)})`,
    );
    expect(fills).toEqual([{ x: 0, y: 0, width: BOARD.width, height: BOARD.height }]);
  });

  it('dims the edge with the heartbeat pulse', () => {
    const { ctx, stops } = createStubContext();
    drawNearMissVignette(ctx, 1, 0);
    expect(stops[1]?.color).toBe(
      `rgba(${PALETTE.nearMissVignetteRgb}, ${(
        NEAR_MISS_FX.maxVignetteAlpha *
        (1 - NEAR_MISS_FX.heartbeatPulseStrength)
      ).toFixed(3)})`,
    );
  });

  it('draws nothing once the vignette has faded out', () => {
    const { ctx, stops, fills } = createStubContext();
    drawNearMissVignette(ctx, 0, 1);
    expect(stops).toHaveLength(0);
    expect(fills).toHaveLength(0);
  });
});
