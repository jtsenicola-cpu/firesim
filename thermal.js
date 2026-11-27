/**
 * Pure thermal, radiative fire spread, flashover, and stairwell convection model.
 * No Three.js or DOM dependencies so it can be unit-tested in Node.js.
 */

export const AMBIENT_TEMP = 22;
export const AMBIENT_O2 = 0.21;
export const FLASHOVER_TEMP = 480;

/**
 * Steps compartment temperatures, oxygen depletion/backdraft, stairwell convective
 * heat rise, radiative item-to-item spread, and upper-layer flashover preheating.
 */
export function stepThermalCompartments({
  dt,
  flammables,
  floorTemps,
  floorSoot,
  floorO2 = [AMBIENT_O2, AMBIENT_O2, AMBIENT_O2],
  windows,
  getPos,
  onIgnite
}) {
  const numFloors = floorTemps.length;
  const fireCounts = new Array(numFloors).fill(0);

  // 1. Item combustion, oxygen throttling, cooling, radiative spread, and flashover preheating
  for (let i = 0; i < flammables.length; i++) {
    const item = flammables[i];
    const f = item.floor;
    const o2 = floorO2[f] ?? AMBIENT_O2;
    const o2Factor = Math.max(0.18, Math.min(1.2, (o2 - 0.06) / 0.15));

    if (item.burning && item.fuel > 0) {
      fireCounts[f]++;
      const heatOutput = (1.0 - item.wetness * 0.55) * o2Factor;
      item.fuel = Math.max(0, item.fuel - dt * 0.024 * heatOutput);
      item.temp = Math.min(890, item.temp + dt * 60 * heatOutput);
      floorTemps[f] = Math.min(820, floorTemps[f] + dt * 24 * heatOutput);
      floorSoot[f] = Math.min(1.0, floorSoot[f] + dt * 0.045);
      floorO2[f] = Math.max(0.06, o2 - dt * 0.0085 * heatOutput);

      // Radiative + convective heat transfer to nearby dry furniture (same floor or adjacent stairwell)
      const posA = getPos(item);
      for (let j = 0; j < flammables.length; j++) {
        if (i === j) continue;
        const other = flammables[j];
        if (!other.burning && Math.abs(other.floor - f) <= 1 && other.fuel > 0.1) {
          const posB = getPos(other);
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const dz = posA.z - posB.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 2.6 && other.wetness < 0.4) {
            const dryFactor = 1.0 - other.wetness;
            const upwardBoost = posB.y > posA.y + 0.25 ? 1.35 : 1.0;
            other.temp += dt * (46 / Math.max(0.55, dist)) * dryFactor * upwardBoost * o2Factor;
            if (other.temp >= (other.ignitionTemp ?? 260)) {
              other.burning = true;
              if (onIgnite) onIgnite(other);
            }
          }
        }
      }

      if (item.fuel <= 0) item.burning = false;
    } else if (!item.burning) {
      // Ambient cooling + upper-layer radiant preheating (flashover above FLASHOVER_TEMP)
      const roomTemp = floorTemps[f];
      if (roomTemp > FLASHOVER_TEMP && item.fuel > 0.1 && item.wetness < 0.35) {
        const excess = roomTemp - FLASHOVER_TEMP;
        item.temp += dt * (0.28 * excess) * (1.0 - item.wetness);
        if (item.temp >= (item.ignitionTemp ?? 260)) {
          item.burning = true;
          if (onIgnite) onIgnite(item);
        }
      } else {
        const coolTarget = Math.max(AMBIENT_TEMP, roomTemp * 0.25 + AMBIENT_TEMP * 0.75);
        if (item.temp > coolTarget) {
          item.temp = Math.max(coolTarget, item.temp - dt * 14);
        }
      }
    }
  }

  // 2. Stairwell chimney convection (hot gases & smoke rise to upper floors)
  for (let f = 0; f < numFloors - 1; f++) {
    const tempDiff = floorTemps[f] - floorTemps[f + 1];
    if (tempDiff > 15) {
      const convect = tempDiff * 0.045 * dt;
      floorTemps[f + 1] += convect;
      floorTemps[f] -= convect * 0.35;
      floorSoot[f + 1] = Math.min(1.0, floorSoot[f + 1] + floorSoot[f] * 0.025 * dt);
    }
    // Slight O2 mixing via stairwell
    const o2Diff = floorO2[f + 1] - floorO2[f];
    const o2Mix = o2Diff * 0.05 * dt;
    floorO2[f] += o2Mix;
    floorO2[f + 1] -= o2Mix * 0.5;
  }

  // 3. Compartment heat loss & oxygen inflow (broken windows trigger fresh-air inflow / backdraft)
  for (let f = 0; f < numFloors; f++) {
    const win = windows[f];
    const isOpen = Boolean(win && win.broken);
    const ventRate = isOpen ? 0.065 : 0.018;
    const excess = floorTemps[f] - AMBIENT_TEMP;
    if (excess > 0) {
      floorTemps[f] = Math.max(AMBIENT_TEMP, floorTemps[f] - excess * ventRate * dt);
    }

    const o2InflowRate = isOpen ? 0.14 : 0.015;
    floorO2[f] = Math.min(AMBIENT_O2, floorO2[f] + (AMBIENT_O2 - floorO2[f]) * o2InflowRate * dt);

    // Backdraft flare-up if broken window feeds fresh O2 into hot smoldering compartment
    if (isOpen && fireCounts[f] > 0 && floorTemps[f] > 320 && floorO2[f] < 0.16) {
      floorTemps[f] = Math.min(840, floorTemps[f] + 18 * dt);
    }
  }

  return fireCounts;
}
