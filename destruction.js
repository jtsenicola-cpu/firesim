/**
 * Pure structural integrity & load-bearing collapse solver (Red Faction Guerrilla style).
 * Zero Three.js or DOM dependencies so it can be unit-tested in Node.js.
 */

export const COLLAPSE_HEAT_THRESHOLD = 460;
export const SUPPORT_RATIO_THRESHOLD = 0.42;

/**
 * Applies localized damage to a structural block/panel.
 * Returns true if the block just fractured/destroyed on this hit.
 */
export function damageBlock(block, amount) {
  if (!block || block.destroyed) return false;
  block.integrity = Math.max(0, block.integrity - amount);
  if (block.integrity <= 0) {
    block.destroyed = true;
    return true;
  }
  return false;
}

/**
 * Steps thermal weakening of load-bearing walls and checks if upper floors
 * lose structural support and collapse downward.
 */
export function stepStructuralIntegrity({
  dt,
  blocks,
  floorTemps,
  numFloors = 3,
  onBlockDestroyed,
  onFloorCollapse
}) {
  const totalSupport = new Array(numFloors).fill(0);
  const intactSupport = new Array(numFloors).fill(0);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.isLoadBearing) totalSupport[b.floor]++;
    if (b.destroyed) continue;

    // Extreme compartment heat gradually weakens masonry/timber supports
    const temp = floorTemps[b.floor] ?? 22;
    if (temp > COLLAPSE_HEAT_THRESHOLD) {
      const heatDamage = ((temp - COLLAPSE_HEAT_THRESHOLD) / 360) * 0.045 * dt;
      if (damageBlock(b, heatDamage) && onBlockDestroyed) {
        onBlockDestroyed(b, 'thermal');
      }
    }

    if (!b.destroyed && b.isLoadBearing) {
      intactSupport[b.floor]++;
    }
  }

  // Cascade structural collapse upward: floor f's walls support floor f+1 (and roof on top floor)
  const collapsedFloors = new Array(numFloors).fill(false);
  for (let f = 0; f < numFloors; f++) {
    const ratio = totalSupport[f] > 0 ? intactSupport[f] / totalSupport[f] : 1.0;
    if (ratio < SUPPORT_RATIO_THRESHOLD) {
      for (let cf = f + 1; cf < numFloors; cf++) collapsedFloors[cf] = true;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.destroyed) continue;
        const isRoofOnTop = b.isRoof && b.floor >= f;
        const isUpperStructure = b.floor >= f + 1;
        if (isUpperStructure || isRoofOnTop) {
          b.integrity = 0;
          b.destroyed = true;
          if (onBlockDestroyed) onBlockDestroyed(b, 'collapse');
        }
      }
      if (onFloorCollapse) onFloorCollapse(f + 1 < numFloors ? f + 1 : f);
      break;
    }
  }

  return collapsedFloors;
}
