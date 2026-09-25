import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST_FX } from '@/config/gameConfig';
import { CanvasRenderer } from '@/render/CanvasRenderer';
import { PostProcessPipeline } from '@/render/PostProcessPipeline';
import {
  createFakeWebGLContext,
  createHybridCanvas,
  createRecording2dContext,
} from './helpers/fakeWebGLContext';
import type { GameSnapshot } from '@/core/Game';

function baseSnapshot(): GameSnapshot {
  return {
    state: 'aiming',
    score: 1234,
    best: 5678,
    balls: [],
    held: { tier: 2, x: 240, special: null },
    nextTier: 3,
    dangerLineY: 120,
    nearMissIntensity: 0,
    timeScale: 1,
    pendingCards: [],
    seed: 1,
    chainIndex: 0,
    nextSpecial: null,
  };
}

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('CanvasRenderer post-processing fallback', () => {
  it('skips the pipeline and draws straight to the visible canvas without WebGL', () => {
    // Node environment: `document` is undefined, so PostProcessPipeline
    // .isSupported() is false and the Canvas 2D path must be used.
    expect(PostProcessPipeline.isSupported()).toBe(false);
    const scene = createRecording2dContext();
    const visible = createHybridCanvas(null, scene.ctx);
    vi.stubGlobal('window', { devicePixelRatio: 1 });

    const renderer = new CanvasRenderer(visible, () => 0);

    expect(renderer.postProcessingEnabled).toBe(false);
    renderer.render(baseSnapshot());

    // The scene was painted directly onto the original canvas — the game is
    // fully playable without WebGL.
    expect(scene.fillRectCount()).toBeGreaterThan(0);
    expect(scene.texts.length).toBeGreaterThan(0);
  });

  it('routes frames through the offscreen canvas and the WebGL pipeline', () => {
    const { gl, log } = createFakeWebGLContext();
    const offscreenScene = createRecording2dContext();
    const visibleScene = createRecording2dContext();
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(gl, offscreenScene.ctx),
    });
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    // The visible canvas serves its WebGL context; its 2D stub would only be
    // touched if the fallback path ran by mistake.
    const visible = createHybridCanvas(gl, visibleScene.ctx);

    const renderer = new CanvasRenderer(visible, () => 0);

    expect(renderer.postProcessingEnabled).toBe(true);
    renderer.render(baseSnapshot());

    // Scene drawn on the offscreen canvas...
    expect(offscreenScene.fillRectCount()).toBeGreaterThan(0);
    expect(visibleScene.fillRectCount()).toBe(0);
    // ...uploaded once as a texture and pushed through one shader pass.
    expect(log.textureUploads).toHaveLength(1);
    expect(log.textureUploads[0]?.width).toBe(480);
    expect(log.textureUploads[0]?.height).toBe(720);
    expect(log.drawCalls).toBe(1);
  });

  it('keeps the offscreen backing store in sync on resize', () => {
    const { gl } = createFakeWebGLContext();
    const offscreenScene = createRecording2dContext();
    const offscreenCanvases: HTMLCanvasElement[] = [];
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => {
        const canvas = createHybridCanvas(gl, offscreenScene.ctx);
        offscreenCanvases.push(canvas);
        return canvas;
      },
    });
    vi.stubGlobal('window', { devicePixelRatio: 2 });

    const visible = createHybridCanvas(gl, offscreenScene.ctx, 360, 540);
    const renderer = new CanvasRenderer(visible, () => 0);
    // Element 0 is the WebGL support probe; element 1 is the offscreen scene
    // canvas the renderer created, whose backing store must match the screen.
    const offscreen = offscreenCanvases[1];
    expect(offscreen).toBeDefined();
    expect(offscreen?.width).toBe(720);
    expect(offscreen?.height).toBe(1080);

    visible.getBoundingClientRect = (): DOMRect =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 240,
        bottom: 360,
        width: 240,
        height: 360,
        toJSON: (): object => ({}),
      }) as DOMRect;
    renderer.resize();
    expect(visible.width).toBe(480);
    expect(visible.height).toBe(720);
    expect(offscreen?.width).toBe(480);
    expect(offscreen?.height).toBe(720);
  });

  it('pulses chromatic aberration only on the WebGL path', () => {
    // Fallback path: the pulse is a harmless no-op.
    const scene = createRecording2dContext();
    const visible = createHybridCanvas(null, scene.ctx);
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const fallbackRenderer = new CanvasRenderer(visible, () => 0);
    expect(() => fallbackRenderer.triggerChromaticAberration(0.02)).not.toThrow();
    expect(fallbackRenderer.postProcessingEnabled).toBe(false);

    // WebGL path: the pulse lands in the shader's intensity uniform.
    const { gl, log } = createFakeWebGLContext();
    const offscreenScene = createRecording2dContext();
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(gl, offscreenScene.ctx),
    });
    const webglVisible = createHybridCanvas(gl, offscreenScene.ctx);
    const renderer = new CanvasRenderer(webglVisible, () => 0);
    renderer.render(baseSnapshot());
    renderer.triggerChromaticAberration(POST_FX.chromaticAberration.mergeSpike);
    renderer.render(baseSnapshot());

    const chromaticCalls = log.uniformCalls.filter((call) => call.name === 'uChromaticIntensity');
    expect(chromaticCalls.length).toBe(2);
    const afterPulse = chromaticCalls[1]?.values[0];
    expect(afterPulse).toBeDefined();
    if (afterPulse !== undefined) {
      expect(afterPulse).toBeCloseTo(
        POST_FX.chromaticAberration.baseIntensity + POST_FX.chromaticAberration.mergeSpike,
        8,
      );
    }
  });
});
