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

  // Cascade structural collapse upward if a lower floor loses too many load-bearing supports
  const collapsedFloors = new Array(numFloors).fill(false);
  for (let f = 0; f < numFloors; f++) {
    const ratio = totalSupport[f] > 0 ? intactSupport[f] / totalSupport[f] : 1.0;
    const belowCollapsed = f > 0 && collapsedFloors[f - 1];
    if (ratio < SUPPORT_RATIO_THRESHOLD || belowCollapsed) {
      collapsedFloors[f] = true;
      // Destroy remaining blocks on this floor and upper floors that lost support
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (!b.destroyed && b.floor >= f) {
          b.integrity = 0;
          b.destroyed = true;
          if (onBlockDestroyed) onBlockDestroyed(b, 'collapse');
        }
      }
      if (onFloorCollapse) onFloorCollapse(f);
      break; // upper floors already cascaded in loop above
    }
  }

  return collapsedFloors;
}
