import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST_FX } from '@/config/gameConfig';
import { PostProcessPipeline } from '@/render/PostProcessPipeline';
import type { PostEffectId } from '@/render/PostProcessPipeline';
import { createFakeWebGLContext, createHybridCanvas } from './helpers/fakeWebGLContext';
import type { FakeWebGLLog } from './helpers/fakeWebGLContext';

function makeSourceCanvas(width = 480, height = 720): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

function lastUniform(log: FakeWebGLLog, name: string): number | undefined {
  for (let index = log.uniformCalls.length - 1; index >= 0; index -= 1) {
    const call = log.uniformCalls[index];
    if (call !== undefined && call.name === name) {
      return call.values[0];
    }
  }
  return undefined;
}

function createPipeline(): {
  pipeline: PostProcessPipeline;
  log: FakeWebGLLog;
} {
  const { gl, log } = createFakeWebGLContext();
  const pipeline = PostProcessPipeline.create(createHybridCanvas(gl, null));
  return { pipeline, log };
}

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('PostProcessPipeline availability', () => {
  it('reports unsupported when there is no DOM (Node, WebGL-less embeds)', () => {
    // In the Node test environment there is no document at all, so the
    // WebGL probe can never run and the Canvas 2D fallback must be used.
    expect(typeof document === 'undefined').toBe(true);
    expect(PostProcessPipeline.isSupported()).toBe(false);
  });

  it('reports supported when a WebGL context can be created', () => {
    const { gl } = createFakeWebGLContext();
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(gl, null),
    });
    expect(PostProcessPipeline.isSupported()).toBe(true);
  });

  it('reports unsupported when WebGL contexts cannot be created', () => {
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(null, null),
    });
    expect(PostProcessPipeline.isSupported()).toBe(false);
  });

  it('reports unsupported for software rasterizers and prefers the 2D path', () => {
    // A SwiftShader-style renderer would run the shader on the CPU — the
    // Canvas 2D fallback is faster there, so it must not be "supported".
    const swiftshader = createFakeWebGLContext({
      unmaskedRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)',
    });
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(swiftshader.gl, null),
    });
    expect(PostProcessPipeline.isSupported()).toBe(false);

    const llvmpipe = createFakeWebGLContext({ unmaskedRenderer: 'llvmpipe (LLVM 15, software)' });
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(llvmpipe.gl, null),
    });
    expect(PostProcessPipeline.isSupported()).toBe(false);

    // Hardware-style renderers (no debug info, or a real GPU string) pass.
    const hardware = createFakeWebGLContext();
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(hardware.gl, null),
    });
    expect(PostProcessPipeline.isSupported()).toBe(true);

    const namedGpu = createFakeWebGLContext({
      unmaskedRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
    });
    vi.stubGlobal('document', {
      createElement: (): HTMLCanvasElement => createHybridCanvas(namedGpu.gl, null),
    });
    expect(PostProcessPipeline.isSupported()).toBe(true);
  });

  it('prefers WebGL2 and falls back to WebGL1', () => {
    const { gl } = createFakeWebGLContext();
    const webgl2Canvas = createHybridCanvas(gl, null);
    expect(PostProcessPipeline.create(webgl2Canvas)).toBeDefined();

    const webgl1OnlyCanvas = {
      width: 480,
      height: 720,
      getContext: (type: string): unknown => (type === 'webgl' ? gl : null),
      getBoundingClientRect: (): DOMRect =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 480,
          bottom: 720,
          width: 480,
          height: 720,
          toJSON: (): object => ({}),
        }) as DOMRect,
    } as unknown as HTMLCanvasElement;
    expect(PostProcessPipeline.create(webgl1OnlyCanvas)).toBeDefined();

    const noGlCanvas = createHybridCanvas(null, null);
    expect(() => PostProcessPipeline.create(noGlCanvas)).toThrow();
  });
});

describe('PostProcessPipeline single-pass composition', () => {
  it('composes every enabled effect into one fragment shader', () => {
    const { pipeline, log } = createPipeline();
    const composedFragment = log.shaderSources.find(
      (candidate) => candidate.includes('void main()') && candidate.includes('uScene'),
    );
    expect(composedFragment).toBeDefined();
    const fragment = pipeline.getFragmentSourceForTest();
    expect(fragment).toContain('applyChromaticAberration');
    expect(fragment).toContain('applyBloom');
    expect(fragment).toContain('applyVignette');
    expect(fragment).toContain('applyGrain');
    // One draw call per frame — never one pass per effect.
    const source = makeSourceCanvas();
    pipeline.render(source, 0);
    pipeline.render(source, 16);
    expect(log.drawCalls).toBe(2);
    expect(log.textureUploads).toHaveLength(2);
  });

  it('exposes every pass with enabled and intensity properties', () => {
    const { pipeline } = createPipeline();
    const passes = pipeline.getPasses();
    expect(passes.map((pass) => pass.id)).toEqual([
      'chromaticAberration',
      'bloom',
      'vignette',
      'grain',
    ]);
    for (const pass of passes) {
      expect(pass.enabled).toBe(true);
      expect(pass.intensity).toBeGreaterThanOrEqual(0);
    }
    expect(pipeline.getPass('bloom').intensity).toBe(POST_FX.bloom.intensity);
  });

  it('rejects invalid intensities and unknown effects', () => {
    const { pipeline } = createPipeline();
    expect(() => pipeline.setIntensity('bloom', Number.NaN)).toThrow(RangeError);
    expect(() => pipeline.setIntensity('bloom', -1)).toThrow(RangeError);
    expect(() => pipeline.setEnabled('nuclear' as PostEffectId, true)).toThrow(RangeError);
  });

  it('recompiles the shader when a pass is toggled and drops its uniforms', () => {
    const { pipeline, log } = createPipeline();
    const source = makeSourceCanvas();
    pipeline.render(source, 0);
    const linksBefore = log.linkQueries;
    const uniformsBefore = log.uniformCalls.length;

    pipeline.setEnabled('bloom', false);
    expect(pipeline.getFragmentSourceForTest()).not.toContain('applyBloom');
    pipeline.render(source, 16);

    expect(log.linkQueries).toBe(linksBefore + 1);
    const uniformsAfterToggle = log.uniformCalls.slice(uniformsBefore);
    expect(uniformsAfterToggle.some((call) => call.name === 'uBloomIntensity')).toBe(false);
    // Still a single draw call per frame.
    expect(log.drawCalls).toBe(2);

    pipeline.setEnabled('bloom', true);
    expect(pipeline.getFragmentSourceForTest()).toContain('applyBloom');
  });

  it('ignores render calls with a zero-sized source', () => {
    const { pipeline, log } = createPipeline();
    const source = makeSourceCanvas(0, 0);
    pipeline.render(source, 0);
    expect(log.drawCalls).toBe(0);
    expect(log.textureUploads).toHaveLength(0);
  });
});

describe('bloom shader', () => {
  it('compiles the bloom chunk into the pipeline program', () => {
    const { pipeline, log } = createPipeline();
    const fragment = pipeline.getFragmentSourceForTest();
    expect(fragment).toContain('uniform float uBloomIntensity');
    expect(fragment).toContain('uniform float uBloomThreshold');
    expect(fragment).toContain('uniform float uBloomRadius');
    expect(fragment).toContain('color += applyBloom(uScene, uv, uTexelSize);');
    // Compile + link both reported success (the fake never fails, but the
    // pipeline must have queried the statuses to accept them).
    expect(log.compileQueries).toBeGreaterThanOrEqual(2);
    expect(log.linkQueries).toBeGreaterThanOrEqual(1);
  });

  it('pushes intensity, threshold and radius uniforms each frame', () => {
    const { pipeline, log } = createPipeline();
    const bloom = pipeline.getPass('bloom');
    bloom.intensity = 0.8;
    bloom.params.threshold = 0.6;
    bloom.params.radiusTexels = 2.5;

    const source = makeSourceCanvas();
    pipeline.render(source, 0);

    expect(lastUniform(log, 'uBloomIntensity')).toBe(0.8);
    expect(lastUniform(log, 'uBloomThreshold')).toBe(0.6);
    expect(lastUniform(log, 'uBloomRadius')).toBe(2.5);
  });
});

describe('vignette shader', () => {
  it('compiles the vignette chunk into the pipeline program', () => {
    const { pipeline } = createPipeline();
    const fragment = pipeline.getFragmentSourceForTest();
    expect(fragment).toContain('uniform float uVignetteIntensity');
    expect(fragment).toContain('color = applyVignette(color, uv);');
  });

  it('raises the vignette intensity with the live near-miss severity', () => {
    const { pipeline, log } = createPipeline();
    const source = makeSourceCanvas();

    pipeline.setNearMissIntensity(0);
    pipeline.render(source, 0);
    expect(lastUniform(log, 'uVignetteIntensity')).toBeCloseTo(POST_FX.vignette.baseIntensity, 6);

    pipeline.setNearMissIntensity(0.6);
    pipeline.render(source, 16);
    expect(lastUniform(log, 'uVignetteIntensity')).toBeCloseTo(
      POST_FX.vignette.baseIntensity + 0.6 * POST_FX.vignette.nearMissBoost,
      6,
    );

    // Custom base intensity is honoured too.
    pipeline.setIntensity('vignette', 0.4);
    pipeline.render(source, 32);
    expect(lastUniform(log, 'uVignetteIntensity')).toBeCloseTo(
      0.4 + 0.6 * POST_FX.vignette.nearMissBoost,
      6,
    );
  });
});

describe('chromatic aberration shader', () => {
  it('compiles the chromatic aberration chunk into the pipeline program', () => {
    const { pipeline } = createPipeline();
    const fragment = pipeline.getFragmentSourceForTest();
    expect(fragment).toContain('uniform float uChromaticIntensity');
    expect(fragment).toContain('color = applyChromaticAberration(uScene, uv);');
  });

  it('spikes on pulses and decays exponentially over time', () => {
    const { pipeline, log } = createPipeline();
    const source = makeSourceCanvas();

    pipeline.render(source, 0);
    expect(lastUniform(log, 'uChromaticIntensity')).toBeCloseTo(
      POST_FX.chromaticAberration.baseIntensity,
      8,
    );

    pipeline.pulseChromaticAberration(0.03);
    pipeline.render(source, 0);
    expect(lastUniform(log, 'uChromaticIntensity')).toBeCloseTo(
      POST_FX.chromaticAberration.baseIntensity + 0.03,
      8,
    );

    // One decay time constant later the spike has faded but not vanished.
    pipeline.render(source, POST_FX.chromaticAberration.spikeDecayMs);
    const decayed = lastUniform(log, 'uChromaticIntensity');
    expect(decayed).toBeDefined();
    if (decayed !== undefined) {
      expect(decayed).toBeGreaterThan(POST_FX.chromaticAberration.baseIntensity);
      expect(decayed).toBeLessThan(POST_FX.chromaticAberration.baseIntensity + 0.03);
    }
  });

  it('ignores invalid pulses', () => {
    const { pipeline } = createPipeline();
    expect(() => pipeline.pulseChromaticAberration(Number.NaN)).not.toThrow();
    expect(() => pipeline.pulseChromaticAberration(-1)).not.toThrow();
  });
});

describe('grain shader', () => {
  it('compiles the grain chunk into the pipeline program', () => {
    const { pipeline } = createPipeline();
    const fragment = pipeline.getFragmentSourceForTest();
    expect(fragment).toContain('uniform float uGrainIntensity');
    expect(fragment).toContain('color += applyGrain(uv, uTime);');
  });

  it('pushes the grain intensity and the animation time uniform', () => {
    const { pipeline, log } = createPipeline();
    pipeline.setIntensity('grain', 0.09);
    const source = makeSourceCanvas();

    pipeline.render(source, 1250);

    expect(lastUniform(log, 'uGrainIntensity')).toBe(0.09);
    expect(lastUniform(log, 'uTime')).toBeCloseTo(1.25, 6);
  });
});

describe('PostProcessPipeline disposal', () => {
  it('releases the GL objects', () => {
    const { pipeline, log } = createPipeline();
    pipeline.dispose();
    expect(log.deleted).toBeGreaterThanOrEqual(4);
  });
});
