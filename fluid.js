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

    // Top wave surface
    this.geom = new THREE.PlaneGeometry(width, depth, this.nx - 1, this.nz - 1);
    this.geom.rotateX(-Math.PI / 2);

    this.waterUniforms = {
      uTime: { value: 0 },
      uHeat: { value: 0 }
    };

    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.68,
      roughness: 0.06,
      metalness: 0.12,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      depthWrite: false
    });

    this.mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.waterUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWaterUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uHeat;
           varying vec2 vWaterUv;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float r1 = sin(vWaterUv.x * 38.0 + uTime * 3.2) * cos(vWaterUv.y * 34.0 - uTime * 2.7);
           float r2 = sin((vWaterUv.x + vWaterUv.y) * 52.0 - uTime * 4.1);
           float shimmer = smoothstep(0.55, 1.0, (r1 + r2) * 0.5);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.96, 1.0), shimmer * (0.28 + uHeat * 0.35));`
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
      // Keep dry cells slightly below floor slab (-0.012) so dry floor shows wood planks cleanly!
      posAttr.setY(i, this.h[i] > 0.002 ? this.h[i] : -0.012);
    }

    this.mesh.visible = totalVolume > 0.025;
    if (this.mesh.visible) {
      posAttr.needsUpdate = true;
      this.geom.computeVertexNormals();
    }
  }

  drain() {
    this.grid.drain();
    this.mesh.visible = false;
  }
}
