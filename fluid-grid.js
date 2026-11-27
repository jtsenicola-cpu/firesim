/**
 * Pure 2D shallow-water heightfield grid (no Three.js or DOM dependencies).
 * Shared by FloorWaterSystem in the browser and headless unit tests in Node.js.
 */
export class WaterGrid {
  constructor(width = 8.0, depth = 5.6, nx = 32, nz = 22) {
    this.width = width;
    this.depth = depth;
    this.nx = nx;
    this.nz = nz;

    const count = nx * nz;
    this.h = new Float32Array(count);
    this.vel = new Float32Array(count);
  }

  addWaterAt(worldX, worldZ, amount) {
    const gx = Math.floor(((worldX + this.width / 2) / this.width) * this.nx);
    const gz = Math.floor(((worldZ + this.depth / 2) / this.depth) * this.nz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = gx + dx;
        const iz = gz + dz;
        if (ix >= 0 && ix < this.nx && iz >= 0 && iz < this.nz) {
          const w = (dx === 0 && dz === 0) ? 0.55 : 0.056;
          const idx = iz * this.nx + ix;
          this.h[idx] = Math.min(0.45, this.h[idx] + amount * w);
          this.vel[idx] -= amount * 0.45;
        }
      }
    }
  }

  getDepthAt(worldX, worldZ) {
    const ix = Math.max(0, Math.min(this.nx - 1, Math.floor(((worldX + this.width / 2) / this.width) * this.nx)));
    const iz = Math.max(0, Math.min(this.nz - 1, Math.floor(((worldZ + this.depth / 2) / this.depth) * this.nz)));
    return this.h[iz * this.nx + ix];
  }

  getTotalVolume() {
    let sum = 0;
    for (let i = 0; i < this.h.length; i++) sum += this.h[i];
    return sum;
  }

  step(dt, lowerGrid = null, floorTemp = 22) {
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

    const evapRate = floorTemp > 100 ? (floorTemp - 100) * 0.00012 * dt : 0;

    for (let z = 0; z < this.nz; z++) {
      for (let x = 0; x < this.nx; x++) {
        const i = z * this.nx + x;
        this.h[i] = Math.max(0, this.h[i] + this.vel[i] * dt - evapRate);

        // Stairwell opening drainage on right side (x > 2.3)
        if (lowerGrid && x >= this.nx - 5 && z >= 4 && z <= 14 && this.h[i] > 0.015) {
          const spill = this.h[i] * 0.28 * dt * 10;
          this.h[i] -= spill;
          lowerGrid.addWaterAt(2.8, -0.4, spill);
        }
      }
    }

    return totalVolume;
  }

  drain() {
    this.h.fill(0);
    this.vel.fill(0);
  }
}
