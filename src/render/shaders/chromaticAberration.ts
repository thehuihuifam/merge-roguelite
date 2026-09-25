/**
 * Chromatic aberration shader chunk: splits the RGB channels radially from the
 * screen centre. The intensity uniform carries the always-on base value plus a
 * decaying spike that `PostProcessPipeline.pulseChromaticAberration` raises on
 * merge and bomb detonation moments. Inlined into the single full-screen
 * post-process fragment shader (GLSL ES 1.00, WebGL2 + WebGL1).
 */
export const CHROMATIC_ABERRATION_SHADER = {
  id: 'chromaticAberration',
  uniforms: `
    uniform float uChromaticIntensity;`,
  glsl: `
    vec3 applyChromaticAberration(sampler2D sceneTex, vec2 uv) {
      vec2 dir = uv - 0.5;
      float dist = length(dir);
      vec2 offset = dir * dist * uChromaticIntensity;
      float r = texture2D(sceneTex, uv - offset).r;
      float g = texture2D(sceneTex, uv).g;
      float b = texture2D(sceneTex, uv + offset).b;
      return vec3(r, g, b);
    }`,
  apply: 'color = applyChromaticAberration(uScene, uv);',
} as const;
