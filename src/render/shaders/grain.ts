/**
 * Film grain shader chunk: a subtle always-on noise layer that keeps flat
 * surfaces from looking sterile. Animated with the global `uTime` uniform.
 * Inlined into the single full-screen post-process fragment shader
 * (GLSL ES 1.00, WebGL2 + WebGL1).
 */
export const GRAIN_SHADER = {
  id: 'grain',
  uniforms: `
    uniform float uGrainIntensity;`,
  glsl: `
    float grainHash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    vec3 applyGrain(vec2 uv, float timeSec) {
      vec2 grainUv = uv * vec2(1920.0, 1080.0);
      float noise = grainHash(grainUv + vec2(timeSec * 61.7, timeSec * 23.9)) - 0.5;
      return vec3(noise * uGrainIntensity);
    }`,
  apply: 'color += applyGrain(uv, uTime);',
} as const;
