import * as THREE from 'three';
import { WaterGrid } from './fluid-grid.js';

export class FloorWaterSystem {
  constructor(scene, floorIndex, baseY, width = 8.0, depth = 5.6) {
    this.floorIndex = floorIndex;
    this.baseY = baseY;
    this.width = width;
    this.depth = depth;
    this.nx = 32;
    this.nz = 22;

    this.grid = new WaterGrid(width, depth, this.nx, this.nz);
    this.h = this.grid.h;
    this.vel = this.grid.vel;

    // Top wave surface with per-vertex depth attribute for smooth puddle shorelines
    this.geom = new THREE.PlaneGeometry(width, depth, this.nx - 1, this.nz - 1);
    this.geom.rotateX(-Math.PI / 2);
    this.depthAttr = new THREE.BufferAttribute(new Float32Array(this.nx * this.nz), 1);
    this.geom.setAttribute('aDepth', this.depthAttr);

    this.waterUniforms = {
      uTime: { value: 0 },
      uHeat: { value: 0 }
    };

    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.85,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      depthWrite: false
    });

    this.mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.waterUniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aDepth;
           varying vec2 vWaterUv;
           varying float vDepth;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vWaterUv = uv;
           vDepth = aDepth;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uHeat;
           varying vec2 vWaterUv;
           varying float vDepth;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // Smooth shoreline fade so dry floor stays invisible and puddles have organic edges
           float puddleAlpha = smoothstep(0.0008, 0.006, vDepth);
           if (puddleAlpha < 0.01) discard;

           // Animated multi-directional capillary ripples
           float r1 = sin(vWaterUv.x * 42.0 + uTime * 3.6) * cos(vWaterUv.y * 36.0 - uTime * 2.9);
           float r2 = sin((vWaterUv.x * 0.8 - vWaterUv.y) * 58.0 - uTime * 4.4);
           float r3 = cos((vWaterUv.x + vWaterUv.y * 1.2) * 28.0 + uTime * 2.1);
           float ripple = (r1 + r2 + r3) / 3.0;
           float shimmer = smoothstep(0.45, 0.95, ripple);

           // Depth-based color absorption: shallow aqua puddle -> deep flood blue
           float deepFactor = smoothstep(0.008, 0.11, vDepth);
           vec3 shallowCol = vec3(0.22, 0.72, 0.96);
           vec3 deepCol = vec3(0.02, 0.34, 0.72);
           diffuseColor.rgb = mix(shallowCol, deepCol, deepFactor);

           // Shoreline meniscus foam + hot boil-off shimmer
           float edgeFoam = smoothstep(0.0015, 0.006, vDepth) * (1.0 - smoothstep(0.006, 0.02, vDepth));
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.96, 1.0), shimmer * (0.28 + uHeat * 0.45) + edgeFoam * 0.25);
           diffuseColor.a *= puddleAlpha * mix(0.62, 0.92, deepFactor);`
        );
    };

    this.mesh = new THREE.Mesh(this.geom, this.mat);
    this.mesh.position.set(0, baseY + 0.008, 0);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  addWaterAt(worldX, worldZ, amount) {
    this.grid.addWaterAt(worldX, worldZ, amount);
  }

  getDepthAt(worldX, worldZ) {
    return this.grid.getDepthAt(worldX, worldZ);
  }

  getTotalVolume() {
    return this.grid.getTotalVolume();
  }

  step(dt, lowerFloorWater = null, floorTemp = 22) {
    this.waterUniforms.uTime.value += dt;
    this.waterUniforms.uHeat.value = Math.min(1.0, Math.max(0.0, (floorTemp - 80) / 300));
    const totalVolume = this.grid.step(dt, lowerFloorWater ? lowerFloorWater.grid : null, floorTemp);

    const posAttr = this.geom.attributes.position;
    for (let i = 0; i < this.h.length; i++) {
      const depth = this.h[i];
      this.depthAttr.setX(i, depth);
      posAttr.setY(i, depth > 0.0005 ? depth : -0.003);
    }

    this.mesh.visible = totalVolume > 0.008;
    if (this.mesh.visible) {
      posAttr.needsUpdate = true;
      this.depthAttr.needsUpdate = true;
      this.geom.computeVertexNormals();
    }
  }

  drain() {
    this.grid.drain();
    this.depthAttr.array.fill(0);
    this.depthAttr.needsUpdate = true;
    this.mesh.visible = false;
  }
}
