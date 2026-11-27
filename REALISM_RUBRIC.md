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

## 4. 3D Engine Upgrade Roadmap (Prioritized for Hourly Cycles)
1. **HDR Post-Processing (`EffectComposer` + `UnrealBloomPass`):** Use `three/addons/postprocessing/` to add subtle HDR bloom so `totalEmissiveRadiance` ember fissures, flame cores, and sparks glow naturally.
2. **Environment Reflections (`PMREMGenerator` + `RoomEnvironment`):** Generate an environment map for realistic specular reflections on wet floors, water pools (`fluid.js`), and window glass.
3. **GPU-Instanced Volumetric Fire & Smoke (`InstancedMesh` + `ShaderMaterial`):** Replace individual `THREE.Sprite` draw calls with instanced FBM-noise + blackbody-ramp shaders (white-hot -> orange -> dark soot) for higher realism and lower draw-call overhead.
4. **Shattered Glass & Charred Debris:** Spawn tumbling glass shard meshes when windows shatter above `360°C`, plus charred debris on collapse.
5. **Upgraded Water Surface Shader:** Add animated ripple normals, Fresnel reflections, and steam/foam highlights where floodwater contacts hot surfaces.
