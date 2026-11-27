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

    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.62,
      roughness: 0.08,
      metalness: 0.1,
      depthWrite: false
    });

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
