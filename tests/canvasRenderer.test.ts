import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD } from '@/config/gameConfig';
import { CanvasRenderer } from '@/render/CanvasRenderer';

interface CssRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

class FakeCanvas {
  width = 0;
  height = 0;

  constructor(public bounds: CssRect) {}

  getBoundingClientRect(): DOMRect {
    const { left, top, width, height } = this.bounds;
    return {
      x: left,
      y: top,
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: (): object => ({}),
    };
  }

  getContext(): CanvasRenderingContext2D {
    return {} as CanvasRenderingContext2D;
  }
}

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('CanvasRenderer responsive sizing', () => {
  it('updates the high-DPI backing store and touch coordinate mapping after resize', () => {
    const canvas = new FakeCanvas({ left: 14, top: 22, width: 360, height: 540 });
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, () => 0);

    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(1080);
    expect(renderer.toBoardX(14 + 180)).toBeCloseTo(BOARD.width / 2, 6);
    expect(renderer.toBoardY(22 + 270)).toBeCloseTo(BOARD.height / 2, 6);

    canvas.bounds = { left: 8, top: 30, width: 180, height: 320 };
    vi.stubGlobal('window', { devicePixelRatio: 3 });
    renderer.resize();

    expect(canvas.width).toBe(540);
    expect(canvas.height).toBe(960);
    // The board fills the narrow screen width and is vertically letterboxed.
    expect(renderer.toBoardX(8 + 90)).toBeCloseTo(BOARD.width / 2, 6);
    expect(renderer.toBoardY(30 + 25 + 135)).toBeCloseTo(BOARD.height / 2, 6);
    expect(renderer.toBoardY(30 + 25)).toBeCloseTo(0, 6);
  });

  it('keeps zero-sized pre-layout bounds finite until the first real resize', () => {
    const canvas = new FakeCanvas({ left: 0, top: 0, width: 0, height: 0 });
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, () => 0);

    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(2);
    expect(Number.isFinite(renderer.toBoardX(0))).toBe(true);
    expect(Number.isFinite(renderer.toBoardY(0))).toBe(true);

    canvas.bounds = { left: 0, top: 0, width: 240, height: 360 };
    renderer.resize();

    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(720);
    expect(renderer.toBoardX(120)).toBeCloseTo(BOARD.width / 2, 6);
    expect(renderer.toBoardY(180)).toBeCloseTo(BOARD.height / 2, 6);
  });
});
