import * as THREE from 'three';

export class FloorWaterSystem {
  constructor(scene, floorIndex, baseY, width = 8.0, depth = 5.6) {
    this.floorIndex = floorIndex;
    this.baseY = baseY;
    this.width = width;
    this.depth = depth;
    this.nx = 32;
    this.nz = 22;

    const count = this.nx * this.nz;
    this.h = new Float32Array(count);
    this.vel = new Float32Array(count);

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
    const gx = Math.floor(((worldX + this.width / 2) / this.width) * this.nx);
    const gz = Math.floor(((worldZ + this.depth / 2) / this.depth) * this.nz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = gx + dx, iz = gz + dz;
        if (ix >= 0 && ix < this.nx && iz >= 0 && iz < this.nz) {
          const w = (dx === 0 && dz === 0) ? 0.55 : 0.056;
          this.h[iz * this.nx + ix] = Math.min(0.45, this.h[iz * this.nx + ix] + amount * w);
          this.vel[iz * this.nx + ix] -= amount * 0.45;
        }
      }
    }
  }

  getDepthAt(worldX, worldZ) {
    const ix = Math.max(0, Math.min(this.nx - 1, Math.floor(((worldX + this.width / 2) / this.width) * this.nx)));
    const iz = Math.max(0, Math.min(this.nz - 1, Math.floor(((worldZ + this.depth / 2) / this.depth) * this.nz)));
    return this.h[iz * this.nx + ix];
  }

  step(dt, lowerFloorWater = null, floorTemp = 22) {
    const c2 = 4.5;
    const damping = 0.965;
    let totalVolume = 0;

    for (let z = 0; z < this.nz; z++) {
      for (let x = 0; x < this.nx; x++) {
        const i = z * this.nx + x;
        const hC = this.h[i];
        totalVolume += hC;

        const hL = x > 0 ? this.h[i - 1] : hC;
        const hR = x < this.nx - 1 ? this.h[i + 1] : hC;
        const hU = z > 0 ? this.h[i - this.nx] : hC;
        const hD = z < this.nz - 1 ? this.h[i + this.nx] : hC;

        const laplacian = (hL + hR + hU + hD - 4 * hC);
        this.vel[i] = (this.vel[i] + c2 * laplacian * dt) * damping;
      }
    }

    const posAttr = this.geom.attributes.position;
    const evapRate = floorTemp > 100 ? (floorTemp - 100) * 0.00012 * dt : 0;

    for (let z = 0; z < this.nz; z++) {
      for (let x = 0; x < this.nx; x++) {
        const i = z * this.nx + x;
        this.h[i] = Math.max(0, this.h[i] + this.vel[i] * dt - evapRate);

        // Stairwell opening drainage on right side (x > 2.3)
        if (lowerFloorWater && x >= this.nx - 5 && z >= 4 && z <= 14 && this.h[i] > 0.015) {
          const spill = this.h[i] * 0.28 * dt * 10;
          this.h[i] -= spill;
          lowerFloorWater.addWaterAt(2.8, -0.4, spill);
        }

        // Keep dry cells slightly below floor slab (-0.01) so dry floor shows wood planks cleanly!
        posAttr.setY(i, this.h[i] > 0.002 ? this.h[i] : -0.012);
      }
    }

    this.mesh.visible = totalVolume > 0.025;
    if (this.mesh.visible) {
      posAttr.needsUpdate = true;
      this.geom.computeVertexNormals();
    }
  }

  drain() {
    this.h.fill(0);
    this.vel.fill(0);
    this.mesh.visible = false;
  }
}
