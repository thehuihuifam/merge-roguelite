/**
 * Bloom shader chunk: bright regions of the scene bleed light into their
 * surroundings. Inlined into the single full-screen post-process fragment
 * shader built by `src/render/PostProcessPipeline.ts` — GLSL ES 1.00 so the
 * same source serves WebGL2 and WebGL1.
 */
export const BLOOM_SHADER = {
  id: 'bloom',
  uniforms: `
    uniform float uBloomIntensity;
    uniform float uBloomThreshold;
    uniform float uBloomRadius;`,
  glsl: `
    // Soft bright-pass: contribution ramps up with luma above the threshold.
    vec3 bloomBrightPass(vec3 sampleColor, float threshold) {
      float luma = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
      float contribution = clamp((luma - threshold) / 0.35, 0.0, 1.0);
      return sampleColor * contribution;
    }

    vec3 applyBloom(sampler2D sceneTex, vec2 uv, vec2 texelSize) {
      vec2 stepSize = texelSize * uBloomRadius;
      vec3 sum = bloomBrightPass(texture2D(sceneTex, uv).rgb, uBloomThreshold);
      // 8-tap ring around the fragment — one texture-walk, no extra passes.
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2( 1.0,  0.0)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2( 0.7071,  0.7071)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2( 0.0,  1.0)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2(-0.7071,  0.7071)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2(-1.0,  0.0)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2(-0.7071, -0.7071)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2( 0.0, -1.0)).rgb, uBloomThreshold);
      sum += bloomBrightPass(texture2D(sceneTex, uv + stepSize * vec2( 0.7071, -0.7071)).rgb, uBloomThreshold);
      return (sum / 9.0) * uBloomIntensity;
    }`,
  apply: 'color += applyBloom(uScene, uv, uTexelSize);',
} as const;
