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
 * Supports optional stagedCollapse for progressive structural sag & staggered failure.
 */
export function stepStructuralIntegrity({
  dt,
  blocks,
  floorTemps,
  numFloors = 3,
  stagedCollapse = false,
  onBlockDestroyed,
  onFloorCollapse
}) {
  const totalSupport = new Array(numFloors).fill(0);
  const intactSupport = new Array(numFloors).fill(0);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.isLoadBearing) totalSupport[b.floor]++;
    if (b.destroyed) continue;

    // Advance any staged collapse countdowns
    if (b.collapsing) {
      b.sagAmount = 1.0;
      b.collapseDelay = (b.collapseDelay ?? 0) - dt;
      if (b.collapseDelay <= 0) {
        b.integrity = 0;
        b.destroyed = true;
        b.collapsing = false;
        if (onBlockDestroyed) onBlockDestroyed(b, 'collapse');
        continue;
      }
    }

    // Extreme compartment heat gradually weakens masonry/timber supports
    const temp = floorTemps[b.floor] ?? 22;
    if (!b.collapsing && temp > COLLAPSE_HEAT_THRESHOLD) {
      const heatDamage = ((temp - COLLAPSE_HEAT_THRESHOLD) / 360) * 0.045 * dt;
      if (damageBlock(b, heatDamage) && onBlockDestroyed) {
        onBlockDestroyed(b, 'thermal');
      }
    }

    if (!b.destroyed && !b.collapsing && b.isLoadBearing) {
      intactSupport[b.floor]++;
    }
  }

  // Compute support ratios and progressive warning sag per floor
  const supportRatios = new Array(numFloors).fill(1.0);
  for (let f = 0; f < numFloors; f++) {
    supportRatios[f] = totalSupport[f] > 0 ? intactSupport[f] / totalSupport[f] : 1.0;
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.destroyed || b.collapsing) continue;
    const integritySag = b.integrity < 0.72 ? Math.min(1, (0.72 - b.integrity) / 0.72) : 0;
    const supportingRatio = b.floor > 0 ? supportRatios[b.floor - 1] : supportRatios[0];
    const warningSag = supportingRatio < 0.68
      ? Math.min(1, (0.68 - supportingRatio) / (0.68 - SUPPORT_RATIO_THRESHOLD))
      : 0;
    b.sagAmount = Math.max(integritySag, warningSag);
  }

  // Cascade structural collapse upward: floor f's walls support floor f+1 (and roof on top floor)
  const collapsedFloors = new Array(numFloors).fill(false);
  for (let f = 0; f < numFloors; f++) {
    const ratio = supportRatios[f];
    if (ratio < SUPPORT_RATIO_THRESHOLD) {
      for (let cf = f + 1; cf < numFloors; cf++) collapsedFloors[cf] = true;
      let triggeredNewCollapse = false;

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.destroyed || b.collapsing) continue;
        const isRoofOnTop = b.isRoof && b.floor >= f;
        const isUpperStructure = b.floor >= f + 1;
        if (isUpperStructure || isRoofOnTop) {
          triggeredNewCollapse = true;
          if (stagedCollapse) {
            b.collapsing = true;
            b.sagAmount = 1.0;
            const floorOffset = Math.max(0, b.floor - f);
            const stagger = (i % 5) * 0.08 + (b.isSlab ? 0.14 : 0.0) + (b.isRoof ? 0.18 : 0.0);
            b.collapseDelay = 0.06 + floorOffset * 0.18 + stagger;
          } else {
            b.integrity = 0;
            b.destroyed = true;
            if (onBlockDestroyed) onBlockDestroyed(b, 'collapse');
          }
        }
      }
      if (triggeredNewCollapse && onFloorCollapse) {
        onFloorCollapse(f + 1 < numFloors ? f + 1 : f);
      }
      break;
    }
  }

  return collapsedFloors;
}
