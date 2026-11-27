/**
 * Pure 2D volume-conserving shallow-water heightfield grid (no Three.js or DOM dependencies).
 * Supports localized puddle formation via surface-tension/micro-relief, merging puddles,
 * room-wide flooding, stairwell drainage, and thermal boil-off evaporation.
 */
export class WaterGrid {
  constructor(width = 8.0, depth = 5.6, nx = 32, nz = 22) {
    this.width = width;
    this.depth = depth;
    this.nx = nx;
    this.nz = nz;

    const count = nx * nz;
    this.h = new Float32Array(count);
    this.fluxR = new Float32Array(count);
    this.fluxD = new Float32Array(count);
    this.vel = new Float32Array(count);

    // Subtle deterministic floor micro-relief (0..0.006m) so small spills form realistic puddles
    this.relief = new Float32Array(count);
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const i = z * nx + x;
        const n = Math.sin(x * 0.75 + z * 0.55) * Math.cos(x * 0.42 - z * 0.85);
        this.relief[i] = (n * 0.5 + 0.5) * 0.006;
      }
    }
  }

  addWaterAt(worldX, worldZ, amount) {
    if (amount <= 0) return;
    const gx = Math.floor(((worldX + this.width / 2) / this.width) * this.nx);
    const gz = Math.floor(((worldZ + this.depth / 2) / this.depth) * this.nz);

    let weightSum = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = gx + dx;
        const iz = gz + dz;
        if (ix >= 0 && ix < this.nx && iz >= 0 && iz < this.nz) {
          weightSum += (dx === 0 && dz === 0) ? 0.55 : 0.05625;
        }
      }
    }
    if (weightSum <= 0) return;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = gx + dx;
        const iz = gz + dz;
        if (ix >= 0 && ix < this.nx && iz >= 0 && iz < this.nz) {
          const w = ((dx === 0 && dz === 0) ? 0.55 : 0.05625) / weightSum;
          const idx = iz * this.nx + ix;
          this.h[idx] = Math.min(4.0, this.h[idx] + amount * w);
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

  step(dt, lowerGrid = null, floorTemp = 22, upperGrid = null, floorHeight = 2.8) {
    if (dt <= 0) return this.getTotalVolume();

    const gravity = 9.8;
    const damping = Math.pow(0.86, dt * 60);
    const surfaceTensionDepth = 0.005; // puddles hold shape until deeper water overflows
    const nx = this.nx;
    const nz = this.nz;

    // 1. Update horizontal pipe fluxes from total surface height (relief + water depth)
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const i = z * nx + x;
        const hC = this.h[i];
        const surfC = hC + this.relief[i];

        if (x < nx - 1) {
          const hR = this.h[i + 1];
          const surfR = hR + this.relief[i + 1];
          const dhR = surfC - surfR;
          const active = (dhR > 0 ? hC : hR) > surfaceTensionDepth;
          this.fluxR[i] = active ? (this.fluxR[i] * damping + dt * gravity * dhR * 0.65) : 0;
        } else {
          this.fluxR[i] = 0;
        }

        if (z < nz - 1) {
          const hD = this.h[i + nx];
          const surfD = hD + this.relief[i + nx];
          const dhD = surfC - surfD;
          const active = (dhD > 0 ? hC : hD) > surfaceTensionDepth;
          this.fluxD[i] = active ? (this.fluxD[i] * damping + dt * gravity * dhD * 0.65) : 0;
        } else {
          this.fluxD[i] = 0;
        }
      }
    }

    // 2. Clamp per-cell total outflow so no cell can ever go negative (strict mass conservation)
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const i = z * nx + x;
        let out = 0;
        if (x < nx - 1 && this.fluxR[i] > 0) out += this.fluxR[i];
        if (x > 0 && this.fluxR[i - 1] < 0) out -= this.fluxR[i - 1];
        if (z < nz - 1 && this.fluxD[i] > 0) out += this.fluxD[i];
        if (z > 0 && this.fluxD[i - nx] < 0) out -= this.fluxD[i - nx];

        const maxOut = this.h[i] * 0.999;
        if (out > maxOut && out > 1e-12) {
          const scale = maxOut / out;
          if (x < nx - 1 && this.fluxR[i] > 0) this.fluxR[i] *= scale;
          if (x > 0 && this.fluxR[i - 1] < 0) this.fluxR[i - 1] *= scale;
          if (z < nz - 1 && this.fluxD[i] > 0) this.fluxD[i] *= scale;
          if (z > 0 && this.fluxD[i - nx] < 0) this.fluxD[i - nx] *= scale;
        }
      }
    }

    // 3. Apply conservative flux exchange + optional evaporation + stairwell drainage
    const evapRate = floorTemp > 100 ? (floorTemp - 100) * 0.000012 * dt : 0;
    let totalVolume = 0;

    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const i = z * nx + x;
        const prevH = this.h[i];

        let net = 0;
        if (x < nx - 1) net -= this.fluxR[i];
        if (x > 0) net += this.fluxR[i - 1];
        if (z < nz - 1) net -= this.fluxD[i];
        if (z > 0) net += this.fluxD[i - nx];

        let nextH = Math.max(0, prevH + net - evapRate);

        // Stairwell opening drainage on right side (x > 2.3) unless lower floor is already flooded to ceiling
        if (lowerGrid && x >= nx - 5 && z >= 4 && z <= 14 && nextH > 0.015 && lowerGrid.getDepthAt(2.8, -0.4) < floorHeight * 0.95) {
          const spill = Math.min(nextH, nextH * 0.28 * dt * 10);
          nextH -= spill;
          lowerGrid.addWaterAt(2.8, -0.4, spill);
        }

        // Upward stairwell flood overflow when water rises above ceiling height
        if (upperGrid && nextH > floorHeight) {
          const overflow = nextH - floorHeight;
          nextH = floorHeight;
          upperGrid.addWaterAt(2.8, -0.4, overflow);
        }

        this.h[i] = nextH;
        this.vel[i] = (nextH - prevH) / dt;
        totalVolume += nextH;
      }
    }

    return totalVolume;
  }

  drain() {
    this.h.fill(0);
    this.fluxR.fill(0);
    this.fluxD.fill(0);
    this.vel.fill(0);
  }
}
