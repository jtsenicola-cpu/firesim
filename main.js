import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBuilding, FLOOR_HEIGHT, NUM_FLOORS } from './building.js';
import { FloorWaterSystem } from './fluid.js';
import { createSpriteGlowTexture } from './textures.js';
import { stepThermalCompartments } from './thermal.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f17);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4.1, 0);
controls.enableDamping = true;
controls.enabled = false;

function updateCameraFraming() {
  camera.aspect = window.innerWidth / window.innerHeight;
  const isPortrait = camera.aspect < 1.0;
  camera.fov = isPortrait ? 58 : 44;
  camera.position.set(isPortrait ? -9.8 : -7.8, 6.2, isPortrait ? 14.8 : 11.8);
  camera.updateProjectionMatrix();
}
updateCameraFraming();
window.addEventListener('resize', () => {
  updateCameraFraming();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Warm-Cool Three-Point & Hemisphere Lighting
scene.add(new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.65));

const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
keyLight.position.set(-6, 15, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 35;
const d = 8.5;
keyLight.shadow.camera.left = -d;
keyLight.shadow.camera.right = d;
keyLight.shadow.camera.top = d + 3;
keyLight.shadow.camera.bottom = -d;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

// Dynamic Flickering Fire PointLights per floor
const fireLights = [0, 1, 2].map((f) => {
  const pl = new THREE.PointLight(0xff6b1a, 0, 7.5, 1.6);
  pl.position.set(0, f * FLOOR_HEIGHT + 1.2, 0);
  scene.add(pl);
  return pl;
});

const { flammables, floorSurfaces, windows } = buildBuilding(scene);
const waterFloors = [0, 1, 2].map((f) => new FloorWaterSystem(scene, f, f * FLOOR_HEIGHT));
const floorTemps = [22, 22, 22];
const floorSoot = [0, 0, 0];

// Soft Radial Sprite Particles (Fire, Smoke, Water, Steam, Ember Sparks)
const fireTex = createSpriteGlowTexture('rgba(255,248,195,1)', 'rgba(255,85,10,0.82)', 'rgba(0,0,0,0)');
const smokeTex = createSpriteGlowTexture('rgba(20,20,24,0.88)', 'rgba(39,39,42,0.42)', 'rgba(0,0,0,0)');
const steamTex = createSpriteGlowTexture('rgba(255,255,255,0.9)', 'rgba(226,232,240,0.45)', 'rgba(0,0,0,0)');
const waterTex = createSpriteGlowTexture('rgba(186,230,253,0.95)', 'rgba(56,189,248,0.65)', 'rgba(0,0,0,0)');
const sparkTex = createSpriteGlowTexture('rgba(255,255,220,1)', 'rgba(255,155,30,0.9)', 'rgba(0,0,0,0)');

const particles = [];

function spawnParticle(type, pos, vel, floor, scale = 0.55) {
  if (particles.length > 560) return;
  const texMap = { fire: fireTex, smoke: smokeTex, steam: steamTex, water: waterTex, spark: sparkTex };
  const isAdditive = type === 'fire' || type === 'spark';
  const mat = new THREE.SpriteMaterial({
    map: texMap[type],
    transparent: true,
    opacity: type === 'smoke' ? 0.72 : 0.92,
    blending: isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    rotation: type === 'fire' ? (Math.random() - 0.5) * 0.45 : 0
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(pos);
  if (type === 'fire') {
    sprite.scale.set(scale * 0.68, scale * 1.48, 1);
  } else {
    sprite.scale.setScalar(scale);
  }
  scene.add(sprite);
  particles.push({ type, sprite, vel, floor, life: 1.0, baseScale: scale, seed: Math.random() * 6.283 });
}

// Tool State & Multi-Touch Input
let tool = 'ignite';
let isPointerDown = false;
const activePointers = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setTool(next) {
  tool = next;
  controls.enabled = tool === 'orbit';
  document.getElementById('btn-ignite').classList.toggle('active', tool === 'ignite');
  document.getElementById('btn-water').classList.toggle('active', tool === 'water');
  document.getElementById('btn-orbit').classList.toggle('active', tool === 'orbit');
}

document.getElementById('btn-ignite').onclick = () => setTool('ignite');
document.getElementById('btn-water').onclick = () => setTool('water');
document.getElementById('btn-orbit').onclick = () => setTool('orbit');
document.getElementById('btn-drain').onclick = () => waterFloors.forEach((w) => w.drain());
document.getElementById('btn-reset').onclick = () => location.reload();

function applyToolAtPointer(e) {
  if (tool === 'orbit') return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (tool === 'ignite') {
    for (const item of flammables) {
      if (raycaster.intersectObject(item.group, true).length > 0 && item.wetness < 0.55) {
        item.burning = true;
        item.temp = Math.max(item.temp, 360);
      }
    }
  } else if (tool === 'water') {
    const hits = raycaster.intersectObjects(scene.children, true);
    if (hits.length > 0) {
      const pt = hits[0].point;
      const f = Math.max(0, Math.min(2, Math.floor(pt.y / FLOOR_HEIGHT)));
      waterFloors[f].addWaterAt(pt.x, pt.z, 0.048);

      for (let i = 0; i < 4; i++) {
        spawnParticle(
          'water',
          pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.35, (Math.random() - 0.5) * 0.45)),
          new THREE.Vector3((Math.random() - 0.5) * 1.5, -1.9, (Math.random() - 0.5) * 1.5),
          f,
          0.26
        );
      }

      for (const item of flammables) {
        if (item.floor === f && item.group.position.distanceTo(pt) < 1.65) {
          item.wetness = Math.min(1.0, item.wetness + 0.09);
          if (item.burning || item.temp > 120) {
            item.temp -= 55;
            spawnParticle(
              'steam',
              pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4)),
              new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.5, (Math.random() - 0.5) * 0.6),
              f,
              0.65
            );
            if (item.temp < 145) item.burning = false;
          }
        }
      }
    }
  }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  if (activePointers.size >= 2) {
    controls.enabled = true;
    isPointerDown = false;
  } else {
    controls.enabled = (tool === 'orbit');
    isPointerDown = true;
    applyToolAtPointer(e);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (activePointers.size === 1 && isPointerDown) {
    applyToolAtPointer(e);
  }
});

const clearPointer = (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) {
    isPointerDown = false;
    controls.enabled = (tool === 'orbit');
  }
};
renderer.domElement.addEventListener('pointerup', clearPointer);
renderer.domElement.addEventListener('pointercancel', clearPointer);

// Safe 3D Charring Vertex Deformation
function deformBurningMesh(item, burnProgress) {
  item.group.traverse((child) => {
    if (!child.isMesh || !child.geometry.userData.origPos) return;
    const orig = child.geometry.userData.origPos;
    const pos = child.geometry.attributes.position.array;
    const shrink = 1.0 - burnProgress * 0.34;
    for (let i = 0; i < pos.length; i += 3) {
      const ox = orig[i], oy = orig[i + 1], oz = orig[i + 2];
      const warp = Math.sin(ox * 6.0 + oy * 5.0) * 0.04 * burnProgress;
      pos[i] = ox * shrink + warp;
      pos[i + 1] = oy * (1.0 - burnProgress * 0.42);
      pos[i + 2] = oz * shrink - warp;
    }
    child.geometry.attributes.position.needsUpdate = true;
    child.geometry.computeVertexNormals();
  });
}

const clock = new THREE.Clock();
let simTime = 0;

function stepSimulation(dt, elapsed) {
  simTime += dt;

  // 1. Step 3D shallow-water wave grids & stairwell cascades
  waterFloors[2].step(dt, waterFloors[1], floorTemps[2]);
  waterFloors[1].step(dt, waterFloors[0], floorTemps[1]);
  waterFloors[0].step(dt, null, floorTemps[0]);

  const fireCentroids = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  // 2. Update Flammables, Gravity Collapse (#4), Boil-off Steam (#5), and Thermal/Flashover Physics
  const fireCounts = stepThermalCompartments({
    dt,
    flammables,
    floorTemps,
    floorSoot,
    windows,
    getPos: (item) => item.group.position
  });

  for (const item of flammables) {
    // Check supporting furniture collapse (#4)
    if (item.supportedBy && !item.fallen && item.supportedBy.fuel < 0.32) {
      item.fallen = true;
    }
    if (item.fallen && item.group.position.y > item.baseY + 0.02) {
      item.vy -= 9.8 * dt;
      item.group.position.y = Math.max(item.baseY + 0.02, item.group.position.y + item.vy * dt);
      item.group.rotation.z += dt * 1.4;
      item.group.rotation.x += dt * 0.9;
    }

    const waterDepth = waterFloors[item.floor].getDepthAt(item.group.position.x, item.group.position.z);

    // #5 Boil-off steam when floodwater meets hot embers
    if (waterDepth > 0.015 && (item.burning || item.temp > 130)) {
      item.temp = Math.max(65, item.temp - dt * 140);
      if (Math.random() < 0.65) {
        spawnParticle(
          'steam',
          item.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.25, (Math.random() - 0.5) * 0.6)),
          new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.4, (Math.random() - 0.5) * 0.5),
          item.floor,
          0.7
        );
      }
      if (waterDepth > 0.045) item.burning = false;
    }

    if (waterDepth > 0.015) {
      item.wetness = Math.min(1.0, item.wetness + dt * 0.45);
    } else {
      item.wetness = Math.max(0.0, item.wetness - dt * 0.012);
    }

    if (item.burning && item.fuel > 0) {
      fireCentroids[item.floor].add(item.group.position);

      if (Math.random() < 0.58) {
        const p = item.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.95, 0.45, (Math.random() - 0.5) * 0.65));
        spawnParticle('fire', p, new THREE.Vector3((Math.random() - 0.5) * 0.45, 1.65, (Math.random() - 0.5) * 0.45), item.floor, 0.62);
      }
      if (Math.random() < 0.32) {
        const p = item.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.45, (Math.random() - 0.5) * 0.5));
        spawnParticle('spark', p, new THREE.Vector3((Math.random() - 0.5) * 1.1, 2.3 + Math.random() * 1.1, (Math.random() - 0.5) * 1.1), item.floor, 0.11);
      }
      if (Math.random() < 0.42) {
        const p = item.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.85, 0.75, (Math.random() - 0.5) * 0.55));
        spawnParticle('smoke', p, new THREE.Vector3((Math.random() - 0.5) * 0.55, 1.7, (Math.random() - 0.5) * 0.55), item.floor, 0.72);
      }

      deformBurningMesh(item, 1.0 - item.fuel);
    }

    item.uniforms.uWetness.value = item.wetness;
    item.uniforms.uSootLevel.value = floorSoot[item.floor];
    item.uniforms.uBurnAmount.value = 1.0 - item.fuel;
    item.uniforms.uEmberGlow.value = item.burning ? 1.0 : Math.max(0, (item.temp - 140) / 380);
    item.uniforms.uTime.value = elapsed;
  }

  // 3. Update Dynamic Fire PointLights, Window Shattering & Floor Surfaces
  for (let f = 0; f < NUM_FLOORS; f++) {
    if (fireCounts[f] > 0) {
      fireCentroids[f].divideScalar(fireCounts[f]);
      fireLights[f].position.lerp(fireCentroids[f].add(new THREE.Vector3(0, 0.9, 0.3)), 0.15);
      const flicker = 2.6 + Math.sin(elapsed * 19 + f) * 0.7 + (Math.random() - 0.5) * 0.6;
      fireLights[f].intensity = flicker * Math.min(2.0, fireCounts[f]);
    } else {
      fireLights[f].intensity = Math.max(0, fireLights[f].intensity - dt * 6);
      floorTemps[f] = Math.max(22, floorTemps[f] - dt * 8);
    }

    // Thermal glass shattering at 360°C
    const win = windows[f];
    if (!win.broken && floorTemps[f] > 360) {
      win.broken = true;
      win.glass.visible = false;
      floorTemps[f] -= 45; // sudden ventilation cooling
    }
  }

  for (const surf of floorSurfaces) {
    surf.uniforms.uSootLevel.value = floorSoot[surf.floor];
    surf.uniforms.uWetness.value = waterFloors[surf.floor].mesh.visible ? 0.55 : 0.0;
    surf.uniforms.uTime.value = elapsed;
  }

  // 4. Step Sprite Particles with Buoyant Curl, Ceiling-Jet Deflection & Stairwell Chimney
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const decayRate = p.type === 'fire' ? 1.85 : (p.type === 'spark' ? 1.25 : 0.42);
    p.life -= dt * decayRate;

    if (p.type === 'fire') {
      const swirl = Math.sin(elapsed * 7.5 + p.seed) * 0.75;
      p.vel.x += swirl * dt;
      p.vel.y += 0.8 * dt;
      const w = p.baseScale * (0.45 + p.life * 0.45);
      const h = p.baseScale * (1.1 + p.life * 0.65);
      p.sprite.scale.set(w, h, 1);
    } else if (p.type === 'spark') {
      p.vel.x += Math.sin(elapsed * 12.0 + p.seed) * 1.4 * dt;
      p.vel.y -= 1.6 * dt;
    } else if (p.type === 'water') {
      p.vel.y -= 4.5 * dt;
    }

    p.sprite.position.addScaledVector(p.vel, dt);

    if (p.type === 'smoke' || p.type === 'steam') {
      p.vel.x += Math.sin(elapsed * 2.6 + p.seed) * 0.45 * dt;
      const ceilY = (p.floor + 1) * FLOOR_HEIGHT - 0.25;
      if (p.sprite.position.y >= ceilY && p.sprite.position.x < 2.2) {
        p.sprite.position.y = ceilY;
        p.vel.y = 0;
        p.vel.x += (Math.random() - 0.42) * 2.4 * dt;
        p.vel.z += (Math.random() - 0.45) * 2.4 * dt;
      } else if (p.sprite.position.x >= 2.2 && p.floor < 2) {
        p.floor = Math.min(2, Math.floor(p.sprite.position.y / FLOOR_HEIGHT));
      }
      const grow = p.baseScale * (1.0 + (1.0 - p.life) * 1.65);
      p.sprite.scale.setScalar(grow);
    }

    p.sprite.material.opacity = Math.max(0, p.life * (p.type === 'smoke' ? 0.72 : 0.92));
    if (p.life <= 0) {
      scene.remove(p.sprite);
      p.sprite.material.dispose();
      particles.splice(i, 1);
    }
  }

  document.getElementById('stats').textContent =
    `F1: ${Math.round(floorTemps[0])}°C | F2: ${Math.round(floorTemps[1])}°C | F3: ${Math.round(floorTemps[2])}°C`;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  stepSimulation(dt, clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
}

window.__firesim = {
  getMetrics() {
    return {
      simTime: Number(simTime.toFixed(3)),
      floorTemps: floorTemps.map((t) => Number(t.toFixed(2))),
      floorSoot: floorSoot.map((s) => Number(s.toFixed(3))),
      waterVolumes: waterFloors.map((w) => Number(w.getTotalVolume().toFixed(4))),
      activeFires: flammables.filter((f) => f.burning).length,
      particleCount: particles.length,
      windowsBroken: windows.map((w) => w.broken),
      flammables: flammables.map((item, index) => ({
        index,
        name: item.name,
        floor: item.floor,
        burning: item.burning,
        temp: Number(item.temp.toFixed(2)),
        fuel: Number(item.fuel.toFixed(3)),
        wetness: Number(item.wetness.toFixed(3)),
        fallen: Boolean(item.fallen)
      }))
    };
  },
  ignite(indexOrName) {
    const item = typeof indexOrName === 'number'
      ? flammables[indexOrName]
      : flammables.find((f) => f.name.toLowerCase() === String(indexOrName).toLowerCase());
    if (!item || item.wetness >= 0.55) return false;
    item.burning = true;
    item.temp = Math.max(item.temp, 360);
    return true;
  },
  sprayWater(floor, x, z, amount = 0.05) {
    const f = Math.max(0, Math.min(NUM_FLOORS - 1, floor));
    waterFloors[f].addWaterAt(x, z, amount);
    const pt = new THREE.Vector3(x, f * FLOOR_HEIGHT + 0.2, z);
    for (const item of flammables) {
      if (item.floor === f && item.group.position.distanceTo(pt) < 1.65) {
        item.wetness = Math.min(1.0, item.wetness + 0.09);
        if (item.burning || item.temp > 120) {
          item.temp -= 55;
          if (item.temp < 145) item.burning = false;
        }
      }
    }
  },
  drain() {
    waterFloors.forEach((w) => w.drain());
  },
  step(dt = 0.016, steps = 1) {
    for (let i = 0; i < steps; i++) {
      stepSimulation(dt, simTime + dt);
    }
    controls.update();
    renderer.render(scene, camera);
    return this.getMetrics();
  },
  setCameraPreset(name = 'default') {
    if (name === 'f1-closeup') {
      camera.position.set(-4.6, 2.1, 6.8);
      controls.target.set(-1.2, 1.0, 0.6);
    } else if (name === 'stairwell') {
      camera.position.set(5.2, 5.2, 8.2);
      controls.target.set(2.5, 3.8, -0.2);
    } else {
      updateCameraFraming();
      controls.target.set(0, 4.1, 0);
    }
    camera.updateProjectionMatrix();
    controls.update();
    renderer.render(scene, camera);
  },
  reset() {
    location.reload();
  }
};

animate();
