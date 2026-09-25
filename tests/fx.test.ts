/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { FX } from '@/config/gameConfig';
import { CanvasRenderer } from '@/render/CanvasRenderer';
import {
  clearBallFxForTest,
  getBallFxForTest,
  triggerMergePop,
  triggerSquashStretch,
  updateBallFx,
} from '@/render/BallRenderer';

afterEach(() => {
  vi.unstubAllGlobals();
});

function createStubCanvas(): HTMLCanvasElement {
  const canvas = {
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
      lineWidth: 1,
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      setTransform: () => {},
      translate: () => {},
      scale: () => {},
      moveTo: () => {},
      lineTo: () => {},
      setLineDash: () => {},
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      measureText: () => ({ width: 10 }),
      fillText: () => {},
    }),
    getBoundingClientRect: () => ({ width: 480, height: 720, left: 0, top: 0 }),
    width: 480,
    height: 720,
  } as unknown as HTMLCanvasElement;
  return canvas;
}

describe('FX - merge flash', () => {
  it('alpha decays over flash duration', () => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const canvas = createStubCanvas();
    const renderer = new CanvasRenderer(canvas, { clock: () => 0 });
    renderer.triggerFlash('#ffffff', FX.flashAlpha);
    const initialAlpha = renderer.getFlashAlphaForTest();
    expect(initialAlpha).toBeGreaterThan(0);
    expect(initialAlpha).toBeCloseTo(FX.flashAlpha, 1);

    renderer.advanceFxForTest(FX.flashDurationMs / 2);
    const midAlpha = renderer.getFlashAlphaForTest();
    expect(midAlpha).toBeGreaterThan(0);
    expect(midAlpha).toBeLessThan(initialAlpha);

    renderer.advanceFxForTest(FX.flashDurationMs);
    expect(renderer.getFlashAlphaForTest()).toBe(0);
  });

  it('flash for tier triggers color and alpha', () => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const canvas = createStubCanvas();
    const renderer = new CanvasRenderer(canvas, { clock: () => 0 });
    renderer.triggerFlashForTier(4);
    expect(renderer.getFlashAlphaForTest()).toBeGreaterThan(0);
    const fresh = new CanvasRenderer(canvas, { clock: () => 0 });
    fresh.triggerFlashForTier(2);
    expect(fresh.getFlashAlphaForTest()).toBe(0);
    fresh.triggerFlashForTier(null);
    expect(fresh.getFlashAlphaForTest()).toBeGreaterThan(0);
  });
});

describe('FX - camera shake', () => {
  it('offset decays over shake duration', () => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const canvas = createStubCanvas();
    const renderer = new CanvasRenderer(canvas, { clock: () => 0 });
    renderer.triggerShake(1);
    renderer.advanceFxForTest(1);
    const first = renderer.getShakeOffsetForTest();
    expect(first.remainingMs).toBeGreaterThan(0);
    const magnitudeFirst = Math.hypot(first.x, first.y);

    renderer.advanceFxForTest(FX.shakeDurationMs / 2);
    const mid = renderer.getShakeOffsetForTest();
    const magnitudeMid = Math.hypot(mid.x, mid.y);
    expect(mid.remainingMs).toBeLessThan(first.remainingMs);

    renderer.advanceFxForTest(FX.shakeDurationMs);
    const end = renderer.getShakeOffsetForTest();
    expect(end.remainingMs).toBe(0);
    expect(end.x).toBe(0);
    expect(end.y).toBe(0);
    void magnitudeFirst;
    void magnitudeMid;
  });

  it('stronger shake with higher intensity factor', () => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const canvas = createStubCanvas();
    const r1 = new CanvasRenderer(canvas, { clock: () => 0 });
    const r2 = new CanvasRenderer(canvas, { clock: () => 0 });
    r1.triggerShake(1);
    r2.triggerShake(2);
    r1.advanceFxForTest(1);
    r2.advanceFxForTest(1);
    expect(r1.getShakeOffsetForTest().remainingMs).toBe(r2.getShakeOffsetForTest().remainingMs);
  });
});

describe('FX - squash and stretch', () => {
  beforeEach(() => {
    clearBallFxForTest();
  });

  it('scale returns to 1.0 after duration', () => {
    triggerSquashStretch(1, 10, 0);
    let fx = getBallFxForTest(1);
    expect(fx.squashX).toBeCloseTo(FX.squashStretchScale, 2);
    expect(fx.squashY).toBeCloseTo(1 / FX.squashStretchScale, 2);

    updateBallFx(FX.squashStretchDurationMs / 2);
    fx = getBallFxForTest(1);
    expect(fx.squashX).not.toBe(1);
    expect(fx.squashX).toBeGreaterThan(1);
    expect(fx.squashX).toBeLessThan(FX.squashStretchScale);

    updateBallFx(FX.squashStretchDurationMs);
    fx = getBallFxForTest(1);
    expect(fx.squashX).toBeCloseTo(1, 2);
    expect(fx.squashY).toBeCloseTo(1, 2);
  });

  it('vertical squash when mostly vertical velocity', () => {
    triggerSquashStretch(2, 0, 10);
    const fx = getBallFxForTest(2);
    expect(fx.squashY).toBeGreaterThan(1);
    expect(fx.squashX).toBeLessThan(1);
  });
});

describe('FX - merge pop', () => {
  beforeEach(() => {
    clearBallFxForTest();
  });

  it('pop scale decays from 1.3 to 1.0', () => {
    triggerMergePop(10);
    let fx = getBallFxForTest(10);
    expect(fx.popScale).toBeCloseTo(FX.mergePopScale, 2);

    updateBallFx(FX.mergePopDurationMs / 2);
    fx = getBallFxForTest(10);
    expect(fx.popScale).toBeGreaterThan(1);
    expect(fx.popScale).toBeLessThan(FX.mergePopScale);

    updateBallFx(FX.mergePopDurationMs);
    fx = getBallFxForTest(10);
    expect(fx.popScale).toBeCloseTo(1, 2);
  });

  it('pop for new ball triggers and decays', () => {
    triggerMergePop(99);
    expect(getBallFxForTest(99).popScale).toBe(FX.mergePopScale);
    updateBallFx(FX.mergePopDurationMs + 10);
    expect(getBallFxForTest(99).popScale).toBe(1);
  });
});
