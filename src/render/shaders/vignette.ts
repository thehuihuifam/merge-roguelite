/**
 * Vignette shader chunk: darkens the screen edges for mood and focus. The
 * intensity uniform is computed on the CPU from the pass's base intensity plus
 * the live `nearMissIntensity` of the run, so the vignette tightens as a ball
 * rests close to the danger line. Inlined into the single full-screen
 * post-process fragment shader (GLSL ES 1.00, WebGL2 + WebGL1).
 */
export const VIGNETTE_SHADER = {
  id: 'vignette',
  uniforms: `
    uniform float uVignetteIntensity;`,
  glsl: `
    vec3 applyVignette(vec3 color, vec2 uv) {
      vec2 centered = uv - 0.5;
      // 0 at the centre, ~1 at the corners.
      float dist = length(centered) * 1.4142;
      float falloff = smoothstep(0.35, 1.0, dist);
      return color * (1.0 - uVignetteIntensity * falloff);
    }`,
  apply: 'color = applyVignette(color, uv);',
} as const;
