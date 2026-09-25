/**
 * Node-safe WebGL stub for the post-processing tests. Records every call the
 * pipeline makes so tests can assert on shader sources, uniforms, texture
 * uploads and draw calls without a real GPU.
 */

export interface UniformCall {
  readonly name: string;
  readonly values: readonly number[];
}

export interface TextureUpload {
  readonly width: number;
  readonly height: number;
  readonly source: unknown;
}

export interface FakeWebGLLog {
  /** Every shader source handed to `shaderSource`. */
  readonly shaderSources: string[];
  /** Number of shaders whose COMPILE_STATUS was queried (all must succeed). */
  compileQueries: number;
  /** Number of programs whose LINK_STATUS was queried (all must succeed). */
  linkQueries: number;
  /** All uniform values pushed, in order. */
  readonly uniformCalls: UniformCall[];
  /** Every `texImage2D` canvas upload. */
  readonly textureUploads: TextureUpload[];
  /** Number of `drawArrays` calls (= full-screen passes). */
  drawCalls: number;
  /** Number of viewport calls. */
  viewportCalls: number;
  /** Deleted programs/shaders/buffers/textures. */
  deleted: number;
}

/**
 * @param unmaskedRenderer When set, the fake exposes WEBGL_debug_renderer_info
 *        and answers UNMASKED_RENDERER_WEBGL with this string (use it to
 *        simulate software rasterizers such as SwiftShader).
 */
export function createFakeWebGLContext(options?: { readonly unmaskedRenderer?: string }): {
  gl: WebGLRenderingContext;
  log: FakeWebGLLog;
} {
  const log: FakeWebGLLog = {
    shaderSources: [],
    compileQueries: 0,
    linkQueries: 0,
    uniformCalls: [],
    textureUploads: [],
    drawCalls: 0,
    viewportCalls: 0,
    deleted: 0,
  };
  let drawingBufferWidth = 480;
  let drawingBufferHeight = 720;

  const gl = {
    // Constants used by PostProcessPipeline.
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    TEXTURE_2D: 3553,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    LINEAR: 9729,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    TRIANGLE_STRIP: 5,
    DEPTH_TEST: 2929,
    BLEND: 3042,
    FLOAT: 5126,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    TEXTURE0: 33984,
    UNPACK_FLIP_Y_WEBGL: 37440,

    get drawingBufferWidth(): number {
      return drawingBufferWidth;
    },
    get drawingBufferHeight(): number {
      return drawingBufferHeight;
    },

    createShader: (): object => ({}),
    shaderSource: (_shader: unknown, source: string): void => {
      log.shaderSources.push(source);
    },
    compileShader: (): void => {
      return;
    },
    getShaderParameter: (): boolean => {
      log.compileQueries += 1;
      return true;
    },
    getShaderInfoLog: (): string => '',
    deleteShader: (): void => {
      log.deleted += 1;
    },
    createProgram: (): object => ({}),
    attachShader: (): void => {
      return;
    },
    linkProgram: (): void => {
      return;
    },
    getProgramParameter: (): boolean => {
      log.linkQueries += 1;
      return true;
    },
    getProgramInfoLog: (): string => '',
    deleteProgram: (): void => {
      log.deleted += 1;
    },
    useProgram: (): void => {
      return;
    },
    getUniformLocation: (_program: unknown, name: string): { readonly name: string } | null => ({
      name,
    }),
    uniform1f: (location: { name: string }, value: number): void => {
      log.uniformCalls.push({ name: location.name, values: [value] });
    },
    uniform2f: (location: { name: string }, x: number, y: number): void => {
      log.uniformCalls.push({ name: location.name, values: [x, y] });
    },
    uniform1i: (location: { name: string }, value: number): void => {
      log.uniformCalls.push({ name: location.name, values: [value] });
    },
    createBuffer: (): object => ({}),
    bindBuffer: (): void => {
      return;
    },
    bufferData: (): void => {
      return;
    },
    getAttribLocation: (): number => 0,
    enableVertexAttribArray: (): void => {
      return;
    },
    vertexAttribPointer: (): void => {
      return;
    },
    createTexture: (): object => ({}),
    bindTexture: (): void => {
      return;
    },
    activeTexture: (): void => {
      return;
    },
    texParameteri: (): void => {
      return;
    },
    pixelStorei: (): void => {
      return;
    },
    texImage2D: (
      _target: number,
      _level: number,
      _internalFormat: number,
      _format: number,
      _type: number,
      source: { width: number; height: number },
    ): void => {
      log.textureUploads.push({ width: source.width, height: source.height, source });
    },
    viewport: (): void => {
      log.viewportCalls += 1;
    },
    drawArrays: (): void => {
      log.drawCalls += 1;
    },
    disable: (): void => {
      return;
    },
    enable: (): void => {
      return;
    },
    getExtension: (name: string): unknown => {
      if (options?.unmaskedRenderer === undefined || name !== 'WEBGL_debug_renderer_info') {
        return null;
      }
      return { UNMASKED_RENDERER_WEBGL: 37446 };
    },
    getParameter: (parameter: number): unknown => {
      if (parameter === 37446 && options?.unmaskedRenderer !== undefined) {
        return options.unmaskedRenderer;
      }
      return null;
    },
    deleteBuffer: (): void => {
      log.deleted += 1;
    },
    deleteTexture: (): void => {
      log.deleted += 1;
    },
    /** Test hook: pretend the drawing buffer was resized. */
    __setDrawingBufferSize(width: number, height: number): void {
      drawingBufferWidth = width;
      drawingBufferHeight = height;
    },
  };

  return { gl: gl as unknown as WebGLRenderingContext, log };
}

/**
 * Canvas stub whose `getContext` returns the fake GL for `webgl`/`webgl2` and
 * a permissive recording Canvas2D stub otherwise — one stub covers both the
 * visible canvas (WebGL) and the offscreen scene canvas (2D).
 */
export function createHybridCanvas(
  gl: WebGLRenderingContext | null,
  ctx2d: CanvasRenderingContext2D | null,
  width = 480,
  height = 720,
): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    getContext: (type: string): unknown => {
      if (type === 'webgl2' || type === 'webgl') {
        return gl;
      }
      return ctx2d;
    },
    getBoundingClientRect: (): DOMRect =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: (): object => ({}),
      }) as DOMRect,
  };
  return canvas as unknown as HTMLCanvasElement;
}

/** Minimal recording CanvasRenderingContext2D for scene-draw assertions. */
export function createRecording2dContext(): {
  ctx: CanvasRenderingContext2D;
  readonly fillRectCount: () => number;
  readonly texts: string[];
} {
  let fillRects = 0;
  const texts: string[] = [];
  const noop = (): void => {
    return;
  };
  const ctx = {
    canvas: null,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
    save: noop,
    restore: noop,
    fillRect: (): void => {
      fillRects += 1;
    },
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    rect: noop,
    clip: noop,
    arc: noop,
    arcTo: noop,
    moveTo: noop,
    lineTo: noop,
    fill: noop,
    stroke: noop,
    setLineDash: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    setTransform: noop,
    fillText: (text: string): void => {
      texts.push(text);
    },
    strokeText: noop,
    measureText: (text: string): { width: number } => ({ width: text.length * 6 }),
    createLinearGradient: (): { addColorStop: () => void } => ({
      addColorStop: noop,
    }),
    createRadialGradient: (): { addColorStop: () => void } => ({
      addColorStop: noop,
    }),
    drawImage: noop,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    fillRectCount: (): number => fillRects,
    texts,
  };
}
