import { POST_FX } from '@/config/gameConfig';
import { BLOOM_SHADER } from '@/render/shaders/bloom';
import { CHROMATIC_ABERRATION_SHADER } from '@/render/shaders/chromaticAberration';
import { GRAIN_SHADER } from '@/render/shaders/grain';
import { VIGNETTE_SHADER } from '@/render/shaders/vignette';

/** Effect identifiers, in default pass-chain order. */
export type PostEffectId = 'chromaticAberration' | 'bloom' | 'vignette' | 'grain';

/**
 * One link of the pass chain. `enabled` decides whether the effect's GLSL is
 * composed into the (single) fragment shader; `intensity` is its master
 * multiplier, pushed as a uniform every frame.
 */
export interface PostEffectPass {
  readonly id: PostEffectId;
  enabled: boolean;
  /** Master intensity for the effect, 0..1+ (chromatic uses small UV units). */
  intensity: number;
  /** Effect-specific tuning. */
  params: {
    /** Luma threshold above which bloom collects light (bloom only). */
    threshold: number;
    /** Bloom ring radius in texels (bloom only). */
    radiusTexels: number;
  };
}

/** GLSL chunk contract every effect shader file in `src/render/shaders/` fulfils. */
export interface PostEffectShader {
  readonly id: PostEffectId;
  readonly uniforms: string;
  readonly glsl: string;
  readonly apply: string;
}

/** Full-screen quad as a triangle strip, positions in clip space. */
const QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const VERTEX_SHADER_SOURCE = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}` as const;

const FRAGMENT_PREAMBLE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uTexelSize;
uniform float uTime;` as const;

const FRAGMENT_MAIN_START = `
void main() {
  vec2 uv = vUv;
  vec3 color = texture2D(uScene, uv).rgb;` as const;

const FRAGMENT_MAIN_END = `
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}` as const;

/**
 * Substrings that identify software rasterizers in the unmasked GL renderer
 * string (SwiftShader in headless/VM Chrome, llvmpipe/softpipe on Linux).
 */
const SOFTWARE_RENDERER_HINTS: readonly string[] = [
  'swiftshader',
  'llvmpipe',
  'softpipe',
  'software',
];

/** Effects in pass-chain order; composition order is fixed at construction. */
const EFFECT_CHAIN: readonly PostEffectShader[] = [
  CHROMATIC_ABERRATION_SHADER,
  BLOOM_SHADER,
  VIGNETTE_SHADER,
  GRAIN_SHADER,
];

function createDefaultPasses(): PostEffectPass[] {
  return [
    {
      id: 'chromaticAberration',
      enabled: true,
      intensity: POST_FX.chromaticAberration.baseIntensity,
      params: { threshold: POST_FX.bloom.threshold, radiusTexels: POST_FX.bloom.radiusTexels },
    },
    {
      id: 'bloom',
      enabled: true,
      intensity: POST_FX.bloom.intensity,
      params: { threshold: POST_FX.bloom.threshold, radiusTexels: POST_FX.bloom.radiusTexels },
    },
    {
      id: 'vignette',
      enabled: true,
      intensity: POST_FX.vignette.baseIntensity,
      params: { threshold: POST_FX.bloom.threshold, radiusTexels: POST_FX.bloom.radiusTexels },
    },
    {
      id: 'grain',
      enabled: true,
      intensity: POST_FX.grain.intensity,
      params: { threshold: POST_FX.bloom.threshold, radiusTexels: POST_FX.bloom.radiusTexels },
    },
  ];
}

/**
 * WebGL post-processing layer for the Canvas 2D renderer.
 *
 * Architecture: the scene is drawn to an offscreen 2D canvas (by
 * `CanvasRenderer`), uploaded as a WebGL texture here each frame, and pushed
 * through ONE full-screen fragment shader that composes every enabled effect
 * (chromatic aberration → bloom → vignette → grain) in a single pass — four
 * separate passes would tank the frame rate on mobile. Uses WebGL2 with a
 * WebGL1 fallback; both speak GLSL ES 1.00, so one shader source serves both.
 */
export class PostProcessPipeline {
  private readonly gl: WebGLRenderingContext;
  private readonly vertexShader: WebGLShader;
  private program: WebGLProgram | null = null;
  private readonly texture: WebGLTexture;
  private readonly quadBuffer: WebGLBuffer;
  private readonly passes: PostEffectPass[] = createDefaultPasses();
  private programSignature = '';
  private fragmentSource = '';
  private nearMissIntensity = 0;
  private chromaticSpike = 0;
  private lastTimeMs: number | null = null;

  private constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.vertexShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    this.rebuildProgram();
    this.texture = gl.createTexture();
    if (this.texture === null) {
      throw new Error('PostProcessPipeline: createTexture returned null');
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.quadBuffer = gl.createBuffer();
    if (this.quadBuffer === null) {
      throw new Error('PostProcessPipeline: createBuffer returned null');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  /**
   * True when a hardware WebGL context (WebGL2 or WebGL1) can be created.
   * Software rasterizers (SwiftShader in VMs/headless Chrome, llvmpipe on
   * Linux) report a working WebGL context but run the shader on the CPU —
   * slower than skipping post-processing entirely — so they count as
   * unsupported and the Canvas 2D fallback is used instead.
   */
  static isSupported(): boolean {
    try {
      if (typeof document === 'undefined') {
        return false;
      }
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
      if (gl === null) {
        return false;
      }
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as {
        readonly UNMASKED_RENDERER_WEBGL: number;
      } | null;
      if (debugInfo !== null) {
        const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase();
        if (SOFTWARE_RENDERER_HINTS.some((hint) => renderer.includes(hint))) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates the pipeline on `canvas`, claiming its WebGL context. Prefers
   * WebGL2 and falls back to WebGL1. Throws when neither is available —
   * callers fall back to drawing directly with Canvas 2D in that case.
   */
  static create(canvas: HTMLCanvasElement): PostProcessPipeline {
    const options: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    };
    const gl =
      (canvas.getContext('webgl2', options) as WebGLRenderingContext | null) ??
      canvas.getContext('webgl', options);
    if (gl === null) {
      throw new Error('PostProcessPipeline: WebGL is not available on this canvas');
    }
    return new PostProcessPipeline(gl);
  }

  /** Pass chain in composition order. */
  getPasses(): readonly PostEffectPass[] {
    return this.passes;
  }

  /** The pass for `id`; throws for unknown ids so config typos fail loudly. */
  getPass(id: PostEffectId): PostEffectPass {
    const pass = this.passes.find((candidate) => candidate.id === id);
    if (pass === undefined) {
      throw new RangeError(`Unknown post-process effect: ${id}`);
    }
    return pass;
  }

  /** Toggles a pass; the composed fragment shader is rebuilt on change. */
  setEnabled(id: PostEffectId, enabled: boolean): void {
    this.getPass(id).enabled = enabled;
    this.rebuildProgram();
  }

  /** Sets a pass's master intensity (pushed as a uniform on the next frame). */
  setIntensity(id: PostEffectId, intensity: number): void {
    if (!Number.isFinite(intensity) || intensity < 0) {
      throw new RangeError(`Intensity must be a non-negative number, got ${intensity}`);
    }
    this.getPass(id).intensity = intensity;
  }

  /**
   * Feeds the live near-miss severity (0..1): the vignette tightens as a ball
   * rests near the danger line, on top of the existing red 2D vignette.
   */
  setNearMissIntensity(value: number): void {
    this.nearMissIntensity = Math.min(1, Math.max(0, value));
  }

  /**
   * Raises the chromatic aberration spike (merge / bomb detonation moments).
   * The spike decays exponentially with each rendered frame.
   */
  pulseChromaticAberration(strength: number): void {
    if (!Number.isFinite(strength) || strength <= 0) {
      return;
    }
    this.chromaticSpike = Math.max(this.chromaticSpike, strength);
  }

  /**
   * Uploads `source` as a texture and runs the composed single-pass shader
   * onto the pipeline's canvas. `timeMs` drives grain animation and spike
   * decay (wall-clock ms, e.g. `performance.now()`).
   */
  render(source: HTMLCanvasElement, timeMs: number): void {
    const width = source.width;
    const height = source.height;
    if (width <= 0 || height <= 0) {
      return;
    }
    const gl = this.gl;
    const program = this.program;
    if (program === null) {
      return;
    }
    const deltaMs = this.lastTimeMs === null ? 0 : Math.max(0, timeMs - this.lastTimeMs);
    this.lastTimeMs = timeMs;
    this.chromaticSpike *= Math.exp(-deltaMs / POST_FX.chromaticAberration.spikeDecayMs);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    this.setUniform1f('uTime', timeMs / 1000);
    this.setUniform2f('uTexelSize', 1 / width, 1 / height);
    this.setUniform1i('uScene', 0);
    for (const pass of this.passes) {
      if (!pass.enabled) {
        continue;
      }
      switch (pass.id) {
        case 'bloom':
          this.setUniform1f('uBloomIntensity', pass.intensity);
          this.setUniform1f('uBloomThreshold', pass.params.threshold);
          this.setUniform1f('uBloomRadius', pass.params.radiusTexels);
          break;
        case 'vignette':
          this.setUniform1f(
            'uVignetteIntensity',
            pass.intensity + this.nearMissIntensity * POST_FX.vignette.nearMissBoost,
          );
          break;
        case 'chromaticAberration':
          this.setUniform1f('uChromaticIntensity', pass.intensity + this.chromaticSpike);
          break;
        case 'grain':
          this.setUniform1f('uGrainIntensity', pass.intensity);
          break;
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Composed fragment source, exposed for tests and debugging. */
  getFragmentSourceForTest(): string {
    return this.fragmentSource;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
    gl.deleteShader(this.vertexShader);
  }

  /**
   * Rebuilds the program when the set of enabled effects changed. The
   * signature avoids needless recompiles on every toggle call. A fresh
   * program is linked per rebuild (attaching a second fragment shader to a
   * linked program would collide at link time in real WebGL).
   */
  private rebuildProgram(): void {
    const enabled = this.passes.filter((pass) => pass.enabled);
    const signature = enabled.map((pass) => pass.id).join('|');
    if (signature === this.programSignature) {
      return;
    }
    const gl = this.gl;
    const uniforms = enabled.map((pass) => this.shaderFor(pass.id).uniforms).join('\n');
    const functions = enabled.map((pass) => this.shaderFor(pass.id).glsl).join('\n');
    const applies = enabled.map((pass) => `  ${this.shaderFor(pass.id).apply}`).join('\n');
    this.fragmentSource = [
      FRAGMENT_PREAMBLE,
      uniforms,
      functions,
      FRAGMENT_MAIN_START,
      applies,
      FRAGMENT_MAIN_END,
    ].join('\n');

    const program = this.compileProgram(this.fragmentSource);
    const previous = this.program;
    this.program = program;
    this.programSignature = signature;
    if (previous !== null) {
      gl.deleteProgram(previous);
    }
  }

  /** Compiles `fragmentSource`, links it with the vertex shader and returns the program. */
  private compileProgram(fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (program === null) {
      gl.deleteShader(fragmentShader);
      throw new Error('PostProcessPipeline: createProgram returned null');
    }
    gl.attachShader(program, this.vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? '';
      gl.deleteProgram(program);
      gl.deleteShader(fragmentShader);
      throw new Error(`PostProcessPipeline: program link failed: ${log}`);
    }
    // The shader object can go once the program owns a linked copy.
    gl.deleteShader(fragmentShader);
    return program;
  }

  private shaderFor(id: PostEffectId): PostEffectShader {
    const shader = EFFECT_CHAIN.find((candidate) => candidate.id === id);
    if (shader === undefined) {
      throw new RangeError(`No shader chunk registered for effect: ${id}`);
    }
    return shader;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (shader === null) {
      throw new Error('PostProcessPipeline: createShader returned null');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? '';
      gl.deleteShader(shader);
      throw new Error(`PostProcessPipeline: shader compile failed: ${log}`);
    }
    return shader;
  }

  private setUniform1f(name: string, value: number): void {
    if (this.program === null) {
      return;
    }
    const location = this.gl.getUniformLocation(this.program, name);
    if (location !== null) {
      this.gl.uniform1f(location, value);
    }
  }

  private setUniform2f(name: string, x: number, y: number): void {
    if (this.program === null) {
      return;
    }
    const location = this.gl.getUniformLocation(this.program, name);
    if (location !== null) {
      this.gl.uniform2f(location, x, y);
    }
  }

  private setUniform1i(name: string, value: number): void {
    if (this.program === null) {
      return;
    }
    const location = this.gl.getUniformLocation(this.program, name);
    if (location !== null) {
      this.gl.uniform1i(location, value);
    }
  }
}
