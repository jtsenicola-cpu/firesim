# Firesim Realism & Agentic Improvement Rubric

This file defines the automated verification hooks, benchmark scenarios, and realism criteria for iterative self-improvement.

## 1. Automated Verification
- **Headless physics tests:** `npm test` (runs `tests/simulation.test.mjs` against `fluid-grid.js`).
- **Browser debug API (`window.__firesim`):**
  - `getMetrics()` — returns `floorTemps`, `floorSoot`, `waterVolumes`, `activeFires`, `particleCount`, `windowsBroken`, `simTime`, and per-item `flammables` state.
  - `ignite(indexOrName)` — ignites a flammable item (e.g. `ignite(0)` or `ignite('Sectional Sofa')`).
  - `sprayWater(floor, x, z, amount)` — injects water at `(x, z)` on `floor` and cools nearby burning items.
  - `drain()` — drains all floor water grids.
  - `step(dt, steps)` — advances the simulation deterministically by `steps * dt` seconds.
  - `setCameraPreset(name)` — `'default'`, `'f1-closeup'`, or `'stairwell'`.

## 2. Standard Benchmark Scenarios
1. **Sofa Flashover (`t = 0..20s`):**
   - Call `ignite('Sectional Sofa')`, `step(0.03, 600)`.
   - Verify radiative spread ignites `Oak Coffee Table`, `floorTemps[0]` rises, `floorSoot[0]` accumulates, and window shatters above `360°C`.
2. **Extinguish & Boil-off (`t = 0..10s`):**
   - Ignite floor 0, run `step(0.03, 200)`, then call `sprayWater(0, -1.6, 0.4, 0.15)` repeatedly while stepping.
   - Verify active fires drop to `0`, temperatures cool toward ambient `22°C`, and steam particles spawn.
3. **Stairwell Cascade (`t = 0..10s`):**
   - Call `sprayWater(2, 2.8, -0.4, 0.25)` several times and step.
   - Verify `waterVolumes[1]` and `waterVolumes[0]` increase as water cascades down the stairwell.

## 3. Realism Critique Criteria (Visual + Physical)
- **Fire & Smoke:** Natural turbulent plume shape, buoyant ceiling-jet deflection, realistic ember/char progression, and warm dynamic firelight reflections.
- **Thermal & Ventilation Physics:** Realistic heat transfer, cooling toward ambient when extinguished, and ventilation effects when windows shatter.
- **Water & Steam:** Smooth shallow-water ripples, visible wetness darkening/sheen on walls and furniture, and dense steam plumes on hot-surface contact.
- **Performance:** Keep `particleCount` bounded and frame time smooth (`>= 30 FPS`, target `60 FPS`).
