import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterGrid } from '../fluid-grid.js';
import { stepThermalCompartments, FLASHOVER_TEMP } from '../thermal.js';
import { damageBlock, stepStructuralIntegrity } from '../destruction.js';

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

test('addWaterAt increases volume, spreads via wave step, and strictly conserves volume', () => {
  const grid = new WaterGrid();
  grid.addWaterAt(0, 0, 0.2);

  const initialVol = grid.getTotalVolume();
  assert.ok(Math.abs(initialVol - 0.2) < 1e-5, `Expected volume ~0.2, got ${initialVol}`);

  for (let i = 0; i < 60; i++) {
    grid.step(0.016, null, 22);
  }
  assertFiniteGrid(grid);

  const afterVol = grid.getTotalVolume();
  assert.ok(Math.abs(afterVol - initialVol) < 1e-4, `Volume must be conserved: ${initialVol} -> ${afterVol}`);

  const neighborAfter = grid.getDepthAt(0.6, 0.6);
  assert.ok(neighborAfter > 0, 'Wave should spread water to neighboring cells');
});

test('stairwell drainage transfers water from upper floor to lower floor while conserving total volume', () => {
  const upper = new WaterGrid();
  const lower = new WaterGrid();

  for (let i = 0; i < 8; i++) {
    upper.addWaterAt(2.8, -0.4, 0.15);
  }
  const totalStart = upper.getTotalVolume();
  assert.ok(Math.abs(totalStart - 1.2) < 1e-4);

  for (let i = 0; i < 40; i++) {
    upper.step(0.016, lower, 22);
    lower.step(0.016, null, 22);
  }

  assertFiniteGrid(upper);
  assertFiniteGrid(lower);
  const totalEnd = upper.getTotalVolume() + lower.getTotalVolume();
  assert.ok(Math.abs(totalEnd - totalStart) < 1e-3, `Combined volume must be conserved: ${totalStart} -> ${totalEnd}`);
  assert.ok(lower.getTotalVolume() > 0.2, 'Lower floor should receive substantial stairwell cascade water');
  assert.ok(upper.getTotalVolume() < totalStart, 'Upper floor volume should decrease as it drains');
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

test('thermal model spreads fire, triggers flashover, and convects heat upstairs', () => {
  const flammables = [
    { name: 'Sofa', floor: 0, burning: true, temp: 400, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: -1.6, y: 0, z: 0.4 } },
    { name: 'Table', floor: 0, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: -1.6, y: 0, z: 1.6 } },
    { name: 'FarItem', floor: 0, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 2.0, y: 0, z: -2.0 } }
  ];
  const floorTemps = [22, 22, 22];
  const floorSoot = [0, 0, 0];
  const windows = [{ broken: false }, { broken: false }, { broken: false }];

  for (let i = 0; i < 600; i++) {
    stepThermalCompartments({
      dt: 0.05,
      flammables,
      floorTemps,
      floorSoot,
      windows,
      getPos: (item) => item.pos
    });
  }

  assert.equal(flammables[1].burning, true, 'Nearby table should ignite via radiative spread');
  assert.ok(floorTemps[0] > FLASHOVER_TEMP, 'Compartment should reach flashover temperature');
  assert.equal(flammables[2].burning, true, 'Far item should ignite during flashover');
  assert.ok(floorTemps[1] > 40, 'Stairwell convection should heat upper floor');
  assert.ok(floorSoot[1] > 0, 'Smoke/soot should convect to upper floor');
});

test('fire extends across hallway objects and climbs up the stairs to floor 2', () => {
  const flammables = [
    { name: 'Sofa', floor: 0, burning: true, temp: 400, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: -1.7, y: 0, z: 0.3 } },
    { name: 'Hall Console', floor: 0, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 0.45, y: 0, z: 0.55 } },
    { name: 'Hallway Runner', floor: 0, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 1.45, y: 0, z: 1.15 } },
    { name: 'Entryway Boxes', floor: 0, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 2.75, y: 0, z: 0.95 } },
    { name: 'Stairs F1 Lower', floor: 0, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 3.0, y: 0.4, z: -0.2 } },
    { name: 'Stairs F1 Upper', floor: 1, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 3.0, y: 1.8, z: 0.8 } },
    { name: 'Landing Bench', floor: 1, burning: false, temp: 22, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 2.55, y: 2.8, z: 1.85 } }
  ];
  const floorTemps = [22, 22, 22];
  const floorSoot = [0, 0, 0];
  const windows = [{ broken: false }, { broken: false }, { broken: false }];

  for (let i = 0; i < 1400; i++) {
    stepThermalCompartments({
      dt: 0.05,
      flammables,
      floorTemps,
      floorSoot,
      windows,
      getPos: (item) => item.pos
    });
  }

  assert.equal(flammables[3].burning, true, 'Entryway Boxes near stairs should ignite');
  assert.equal(flammables[4].burning, true, 'Lower stair flight should ignite');
  assert.equal(flammables[5].burning, true, 'Upper stair flight should ignite');
  assert.equal(flammables[6].burning, true, 'Floor 2 Landing Bench at top of stairs should ignite');
});

test('sealed fire depletes oxygen and broken window restores oxygen', () => {
  const flammables = [
    { name: 'Sofa', floor: 0, burning: true, temp: 500, ignitionTemp: 260, fuel: 1.0, wetness: 0, pos: { x: 0, y: 0, z: 0 } }
  ];
  const floorTemps = [350, 22, 22];
  const floorSoot = [0, 0, 0];
  const floorO2 = [0.21, 0.21, 0.21];
  const windows = [{ broken: false }, { broken: false }, { broken: false }];

  for (let i = 0; i < 300; i++) {
    stepThermalCompartments({
      dt: 0.05,
      flammables,
      floorTemps,
      floorSoot,
      floorO2,
      windows,
      getPos: (item) => item.pos
    });
  }
  const depletedO2 = floorO2[0];
  assert.ok(depletedO2 < 0.16, `Sealed fire should deplete O2 below 0.16, got ${depletedO2}`);

  windows[0].broken = true;
  for (let i = 0; i < 200; i++) {
    stepThermalCompartments({
      dt: 0.05,
      flammables,
      floorTemps,
      floorSoot,
      floorO2,
      windows,
      getPos: (item) => item.pos
    });
  }
  assert.ok(floorO2[0] > depletedO2, 'Breaking window should replenish oxygen');
});

test('small spills form localized puddles while heavy water floods the room', () => {
  const puddleGrid = new WaterGrid();
  puddleGrid.addWaterAt(-1.6, 0.4, 0.015);
  for (let i = 0; i < 60; i++) puddleGrid.step(0.016, null, 22);

  assert.ok(puddleGrid.getDepthAt(-1.6, 0.4) > 0, 'Puddle should remain at spray point');
  assert.equal(puddleGrid.getDepthAt(3.0, -2.0), 0, 'Small puddle should not flood far corner');

  const floodGrid = new WaterGrid();
  for (let i = 0; i < 60; i++) floodGrid.addWaterAt(-1.6, 0.4, 0.25);
  for (let i = 0; i < 180; i++) floodGrid.step(0.03, null, 22);

  assert.ok(floodGrid.getDepthAt(2.5, -1.5) > 0.005, 'Excessive water should overflow puddles and flood the room');
});

test('deep lower-floor flood overflows upward into the upper floor', () => {
  const f1 = new WaterGrid();
  const f2 = new WaterGrid();

  // Fill f1 cells beyond floorHeight (2.8m)
  f1.h.fill(2.9);
  for (let i = 0; i < 20; i++) {
    f1.step(0.016, null, 22, f2, 2.8);
    f2.step(0.016, null, 22, null, 2.8);
  }

  assert.ok(f2.getTotalVolume() > 10, 'Excess floodwater above 2.8m should rise onto Floor 2');
});

test('destroying load-bearing walls on lower floor collapses upper floors', () => {
  const blocks = [
    { id: 0, floor: 0, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 1, floor: 0, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 2, floor: 0, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 3, floor: 1, isLoadBearing: false, isSlab: true, integrity: 1.0, destroyed: false },
    { id: 4, floor: 1, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 5, floor: 2, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 6, floor: 2, isLoadBearing: false, isSlab: true, isRoof: true, integrity: 1.0, destroyed: false }
  ];
  const collapsed = [];
  damageBlock(blocks[0], 1.0);
  damageBlock(blocks[1], 1.0); // 1/3 = 0.33 < 0.42 threshold on floor 0

  const result = stepStructuralIntegrity({
    dt: 0.016,
    blocks,
    floorTemps: [22, 22, 22],
    numFloors: 3,
    onFloorCollapse: (f) => collapsed.push(f)
  });

  assert.equal(result[1], true, 'Floor 1 (supported by Floor 0 walls) should collapse');
  assert.equal(result[2], true, 'Floor 2 should also collapse');
  assert.deepEqual(collapsed, [1]);
  assert.equal(blocks[2].destroyed, false, 'Remaining Floor 0 wall stays standing');
  assert.equal(blocks[3].destroyed, true, 'Floor 1 slab should collapse');
  assert.equal(blocks[4].destroyed, true, 'Floor 1 wall should collapse');
  assert.equal(blocks[6].destroyed, true, 'Roof should collapse');
});

test('breached floor slab drains water downward as a waterfall while conserving volume', () => {
  const upper = new WaterGrid();
  const lower = new WaterGrid();

  for (let i = 0; i < 6; i++) {
    upper.addWaterAt(-1.2, 0.2, 0.12);
  }
  const startVol = upper.getTotalVolume();
  upper.setBreachedRect(-2.0, 0.0, -1.0, 1.0);

  let sawSpill = false;
  for (let i = 0; i < 30; i++) {
    upper.step(0.03, lower, 22);
    if (upper.spillPoints.length > 0) sawSpill = true;
    lower.step(0.03, null, 22);
  }

  assert.equal(sawSpill, true, 'Breached slab should emit waterfall spill points');
  const endVol = upper.getTotalVolume() + lower.getTotalVolume();
  assert.ok(Math.abs(endVol - startVol) < 1e-3, `Volume must be conserved across waterfall: ${startVol} -> ${endVol}`);
  assert.ok(lower.getTotalVolume() > 0.3, 'Lower floor should receive waterfall water through breached slab');
});

test('stagedCollapse applies progressive sag and staggers upper-floor block destruction', () => {
  const blocks = [
    { id: 0, floor: 0, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 1, floor: 0, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 2, floor: 0, isLoadBearing: true, isSlab: false, integrity: 1.0, destroyed: false },
    { id: 3, floor: 1, isLoadBearing: false, isSlab: true, integrity: 1.0, destroyed: false },
    { id: 4, floor: 2, isLoadBearing: true, isSlab: false, isRoof: true, integrity: 1.0, destroyed: false }
  ];

  damageBlock(blocks[0], 1.0);
  damageBlock(blocks[1], 1.0);

  stepStructuralIntegrity({
    dt: 0.016,
    blocks,
    floorTemps: [22, 22, 22],
    numFloors: 3,
    stagedCollapse: true
  });

  assert.equal(blocks[3].collapsing, true, 'Floor 1 slab should enter collapsing state');
  assert.equal(blocks[3].destroyed, false, 'Staged collapse should stagger destruction over time');
  assert.equal(blocks[3].sagAmount, 1.0, 'Collapsing block should have full sagAmount');

  for (let i = 0; i < 60; i++) {
    stepStructuralIntegrity({
      dt: 0.03,
      blocks,
      floorTemps: [22, 22, 22],
      numFloors: 3,
      stagedCollapse: true
    });
  }

  assert.equal(blocks[3].destroyed, true, 'Floor 1 slab should finish collapsing');
  assert.equal(blocks[4].destroyed, true, 'Upper roof block should finish collapsing');
});






