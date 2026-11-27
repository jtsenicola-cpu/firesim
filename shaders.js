import * as THREE from 'three';

export function applySurfacePhysicsShader(material, options = {}) {
  const uniforms = {
    uWetness: { value: options.wetness ?? 0.0 },
    uSootLevel: { value: options.soot ?? 0.0 },
    uBurnAmount: { value: options.burn ?? 0.0 },
    uEmberGlow: { value: options.ember ?? 0.0 },
    uFloorBaseY: { value: options.floorBaseY ?? 0.0 },
    uCeilingHeight: { value: options.ceilingHeight ?? 2.8 },
    uTime: { value: 0.0 }
  };

  material.userData.physicsUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWetness;
         uniform float uSootLevel;
         uniform float uBurnAmount;
         uniform float uEmberGlow;
         uniform float uFloorBaseY;
         uniform float uCeilingHeight;
         uniform float uTime;
         varying vec3 vWorldPos;

         float hash31(vec3 p) {
           p = fract(p * 0.1031);
           p += dot(p, p.yzx + 33.33);
           return fract((p.x + p.y) * p.z);
         }
         float noise3D(vec3 p) {
           vec3 i = floor(p);
           vec3 f = fract(p);
           f = f * f * (3.0 - 2.0 * f);
           return mix(
             mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                 mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                 mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z
           );
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float n = noise3D(vWorldPos * 6.5);
         float crack = smoothstep(0.45, 0.78, noise3D(vWorldPos * 18.0));

         // Ceiling soot gradient
         float relH = clamp((vWorldPos.y - uFloorBaseY) / uCeilingHeight, 0.0, 1.0);
         float sootMask = smoothstep(0.35, 1.0, relH) * uSootLevel * (0.65 + 0.35 * n);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.04, 0.045), clamp(sootMask, 0.0, 0.92));

         // Porous wetness darkening
         float wetMask = clamp(uWetness * (0.8 + 0.2 * n), 0.0, 1.0);
         diffuseColor.rgb *= mix(1.0, 0.44, wetMask);

         // Charring
         float charMask = smoothstep(0.1, 0.9, uBurnAmount * (0.6 + 0.5 * n));
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.02, 0.02), charMask);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float emberN = noise3D(vWorldPos * 6.5);
         float emberCrack = smoothstep(0.45, 0.78, noise3D(vWorldPos * 18.0));
         float emberWet = clamp(uWetness * (0.8 + 0.2 * emberN), 0.0, 1.0);
         float pulse = 0.75 + 0.25 * sin(uTime * 7.5 + emberN * 6.28);
         vec3 emberCol = vec3(1.0, 0.28, 0.03) * uEmberGlow * emberCrack * pulse * 2.8 * (1.0 - emberWet * 0.85);
         totalEmissiveRadiance += emberCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.12, clamp(uWetness, 0.0, 1.0));
         roughnessFactor = mix(roughnessFactor, 0.95, clamp(uBurnAmount, 0.0, 1.0));`
      );
  };

  material.needsUpdate = true;
  return uniforms;
}

const NOISE_2D_GLSL = `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm2D(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2D(p);
      p = p * 2.05 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }
`;

export function createFlameMaterial(seed = 0.0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uLife: { value: 1.0 },
      uSeed: { value: seed },
      uIntensity: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLife;
      uniform float uSeed;
      uniform float uIntensity;
      varying vec2 vUv;
      ${NOISE_2D_GLSL}

      void main() {
        vec2 uv = vUv;
        float y = uv.y;
        float x = (uv.x - 0.5) * 2.0;

        // Upward scrolling FBM turbulence that intensifies toward the flame tip
        float flow = uTime * 4.2 + uSeed * 10.0;
        float n1 = fbm2D(vec2(uv.x * 3.2 + uSeed, y * 2.8 - flow));
        float n2 = fbm2D(vec2(uv.x * 6.5 - uSeed, y * 5.2 - flow * 1.45));
        float turb = (n1 * 0.65 + n2 * 0.35) - 0.48;

        // Tapered teardrop silhouette with licking flame tongues
        float taper = mix(0.85, 0.12, pow(y, 0.72));
        float dist = abs(x + turb * (0.35 + y * 0.85)) / max(0.08, taper);
        float shape = smoothstep(1.0, 0.18, dist) * smoothstep(0.0, 0.16, y) * smoothstep(1.0, 0.62, y + n2 * 0.28);

        // Blackbody temperature gradient: white-yellow core -> orange -> crimson tip
        float heat = clamp((1.0 - y * 0.75) * (0.75 + 0.5 * n1) * uLife * uIntensity, 0.0, 1.2);
        vec3 col = mix(vec3(0.75, 0.08, 0.01), vec3(1.0, 0.42, 0.04), smoothstep(0.12, 0.55, heat));
        col = mix(col, vec3(1.0, 0.95, 0.76), smoothstep(0.55, 0.98, heat));

        float alpha = shape * smoothstep(0.0, 0.25, uLife) * 0.92;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * (1.15 + heat * 0.5), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

export function createSmokeMaterial(seed = 0.0, isSteam = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uLife: { value: 1.0 },
      uSeed: { value: seed },
      uOpacity: { value: isSteam ? 0.55 : 0.65 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLife;
      uniform float uSeed;
      uniform float uOpacity;
      varying vec2 vUv;
      ${NOISE_2D_GLSL}

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float n = fbm2D(vUv * 3.4 + vec2(uSeed, -uTime * 0.7));
        float mask = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.55);
        float alpha = mask * smoothstep(0.0, 0.2, uLife) * smoothstep(1.0, 0.85, uLife) * uOpacity;
        if (alpha < 0.01) discard;
        vec3 baseCol = ${isSteam ? 'vec3(0.9, 0.94, 0.98)' : 'vec3(0.09, 0.09, 0.11)'};
        vec3 col = baseCol * (0.75 + 0.45 * n);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });
}
