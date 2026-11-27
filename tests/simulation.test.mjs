import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterGrid } from '../fluid-grid.js';

function assertFiniteGrid(grid) {
  for (let i = 0; i < grid.h.length; i++) {
    assert.ok(Number.isFinite(grid.h[i]), `h[${i}] must be finite`);
    assert.ok(grid.h[i] >= 0, `h[${i}] must be non-negative`);
    assert.ok(Number.isFinite(grid.vel[i]), `vel[${i}] must be finite`);
  }
}

test('WaterGrid initializes dry and finite', () => {
  const grid = new WaterGrid();
  assert.equal(grid.getTotalVolume(), 0);
  assertFiniteGrid(grid);
});

test('addWaterAt increases volume, clamps depth, and spreads via wave step', () => {
  const grid = new WaterGrid();
  grid.addWaterAt(0, 0, 0.2);

  const centerBefore = grid.getDepthAt(0, 0);
  assert.ok(centerBefore > 0 && centerBefore <= 0.45);
  assert.ok(grid.getTotalVolume() > 0);

  for (let i = 0; i < 30; i++) {
    grid.step(0.016, null, 22);
  }
  assertFiniteGrid(grid);

  const neighborAfter = grid.getDepthAt(0.6, 0.6);
  assert.ok(neighborAfter > 0, 'Wave should spread water to neighboring cells');
});

test('stairwell drainage transfers water from upper floor to lower floor', () => {
  const upper = new WaterGrid();
  const lower = new WaterGrid();

  // Add water near the stairwell opening on the right side (x > 2.3)
  for (let i = 0; i < 8; i++) {
    upper.addWaterAt(2.8, -0.4, 0.15);
  }
  const upperStart = upper.getTotalVolume();
  assert.ok(upperStart > 0.5);

  for (let i = 0; i < 40; i++) {
    upper.step(0.016, lower, 22);
    lower.step(0.016, null, 22);
  }

  assertFiniteGrid(upper);
  assertFiniteGrid(lower);
  assert.ok(lower.getTotalVolume() > 0.02, 'Lower floor should receive stairwell cascade water');
  assert.ok(upper.getTotalVolume() < upperStart, 'Upper floor volume should decrease as it drains');
});

test('high floor temperature evaporates water and drain clears grid', () => {
  const grid = new WaterGrid();
  grid.addWaterAt(0, 0, 0.08);
  const before = grid.getTotalVolume();

  for (let i = 0; i < 120; i++) {
    grid.step(0.05, null, 450);
  }

  assertFiniteGrid(grid);
  assert.ok(grid.getTotalVolume() < before, 'Hot floor should evaporate water');

  grid.drain();
  assert.equal(grid.getTotalVolume(), 0);
});
