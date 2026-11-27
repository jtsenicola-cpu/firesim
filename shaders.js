import * as THREE from 'three';

/**
 * Patches a MeshStandardMaterial with real-time uniforms for:
 * - uWetness: darkens diffuse albedo & drops roughness for wet sheen
 * - uSootLevel: accumulates dark carbon gradient near floor ceilings
 * - uBurnAmount & uEmberGlow: alligator-char cracking & glowing embers
 */
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
         varying vec3 vWorldPos;
         varying vec3 vLocalPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vLocalPos = position;
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
         varying vec3 vLocalPos;

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

         // 1. Ceiling soot gradient (thickest near top of compartment)
         float relH = clamp((vWorldPos.y - uFloorBaseY) / uCeilingHeight, 0.0, 1.0);
         float sootMask = smoothstep(0.35, 1.0, relH) * uSootLevel * (0.65 + 0.35 * n);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.05, 0.055), clamp(sootMask, 0.0, 0.92));

         // 2. Wetness darkening (porous saturation reduces diffuse reflectance)
         float wetMask = clamp(uWetness * (0.8 + 0.2 * n), 0.0, 1.0);
         diffuseColor.rgb *= mix(1.0, 0.42, wetMask);

         // 3. Charring & glowing ember fissures
         float charMask = smoothstep(0.1, 0.9, uBurnAmount * (0.6 + 0.5 * n));
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.025, 0.025), charMask);
         float pulse = 0.75 + 0.25 * sin(uTime * 7.0 + n * 6.28);
         vec3 emberCol = vec3(1.0, 0.26, 0.03) * uEmberGlow * crack * pulse * 2.4;
         diffuseColor.rgb += emberCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Wet surfaces become glossy; charred surfaces become matte
         roughnessFactor = mix(roughnessFactor, 0.12, clamp(uWetness, 0.0, 1.0));
         roughnessFactor = mix(roughnessFactor, 0.95, clamp(uBurnAmount, 0.0, 1.0));`
      );
  };

  material.needsUpdate = true;
  return uniforms;
}
