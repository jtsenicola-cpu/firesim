import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBuilding, FLOOR_HEIGHT, NUM_FLOORS } from './building.js';
import { FloorWaterSystem } from './fluid.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f131a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 4.0, 0);
controls.enableDamping = true;
controls.enabled = false;

function updateCameraFraming() {
  camera.aspect = window.innerWidth / window.innerHeight;
  const isPortrait = camera.aspect < 1.0;
  camera.fov = isPortrait ? 58 : 45;
  camera.position.set(isPortrait ? -9.5 : -7.5, 6.2, isPortrait ? 14.5 : 11.5);
  camera.updateProjectionMatrix();
}
updateCameraFraming();
window.addEventListener('resize', () => {
  updateCameraFraming();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
scene.add(new THREE.AmbientLight(0x94a3b8, 0.7));
const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.3);
dirLight.position.set(8, 14, 10);
scene.add(dirLight);

const { flammables, floorSurfaces } = buildBuilding(scene);
const waterFloors = [0, 1, 2].map((f) => new FloorWaterSystem(scene, f, f * FLOOR_HEIGHT));
const floorTemps = [22, 22, 22];
const floorSoot = [0, 0, 0];

// Particle pools (smoke + flame + water droplets + steam)
const particles = [];
const pGeom = new THREE.SphereGeometry(0.11, 6, 6);

function spawnParticle(type, pos, vel, floor) {
  if (particles.length > 450) return;
  const colors = { fire: 0xff5500, smoke: 0x18181b, water: 0x38bdf8, steam: 0xf8fafc };
  const mat = new THREE.MeshBasicMaterial({
    color: colors[type],
    transparent: true,
    opacity: type === 'smoke' ? 0.65 : 0.85
  });
  const mesh = new THREE.Mesh(pGeom, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  particles.push({ type, mesh, vel, floor, life: 1.0 });
}

// Tool state & Raycasting
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
      if (raycaster.intersectObject(item.group, true).length > 0 && item.wetness < 0.5) {
        item.burning = true;
        item.temp = Math.max(item.temp, 340);
      }
    }
  } else if (tool === 'water') {
    const hits = raycaster.intersectObjects(scene.children, true);
    if (hits.length > 0) {
      const pt = hits[0].point;
      const f = Math.max(0, Math.min(2, Math.floor(pt.y / FLOOR_HEIGHT)));
      waterFloors[f].addWaterAt(pt.x, pt.z, 0.045);

      for (let i = 0; i < 4; i++) {
        spawnParticle(
          'water',
          pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.35, (Math.random() - 0.5) * 0.4)),
          new THREE.Vector3((Math.random() - 0.5) * 1.4, -1.8, (Math.random() - 0.5) * 1.4),
          f
        );
      }

      for (const item of flammables) {
        if (item.floor === f && item.group.position.distanceTo(pt) < 1.6) {
          item.wetness = Math.min(1.0, item.wetness + 0.08);
          if (item.burning) {
            item.temp -= 45;
            spawnParticle('steam', pt.clone(), new THREE.Vector3(0, 1.3, 0), f);
            if (item.temp < 140) item.burning = false;
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

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  // Step 3D shallow-water grids & stairwell cascades
  waterFloors[2].step(dt, waterFloors[1]);
  waterFloors[1].step(dt, waterFloors[0]);
  waterFloors[0].step(dt, null);

  // Update flammable nodes & shader uniforms
  for (const item of flammables) {
    const waterDepth = waterFloors[item.floor].getDepthAt(item.group.position.x, item.group.position.z);
    if (waterDepth > 0.02) {
      item.wetness = Math.min(1.0, item.wetness + dt * 0.4);
      if (item.burning && waterDepth > 0.06) {
        item.burning = false;
        item.temp = 60;
      }
    } else {
      item.wetness = Math.max(0.0, item.wetness - dt * 0.015);
    }

    if (item.burning && item.fuel > 0) {
      item.fuel = Math.max(0, item.fuel - dt * 0.025);
      item.temp = Math.min(880, item.temp + dt * 55);
      floorTemps[item.floor] = Math.min(750, floorTemps[item.floor] + dt * 18);
      floorSoot[item.floor] = Math.min(1.0, floorSoot[item.floor] + dt * 0.04);

      if (Math.random() < 0.45) {
        const p = item.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.5, (Math.random() - 0.5) * 0.6));
        spawnParticle('fire', p, new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.4, (Math.random() - 0.5) * 0.4), item.floor);
      }
      if (Math.random() < 0.35) {
        const p = item.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.8, (Math.random() - 0.5) * 0.5));
        spawnParticle('smoke', p, new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.6, (Math.random() - 0.5) * 0.5), item.floor);
      }
      if (item.fuel <= 0) item.burning = false;
    }

    // Update shader uniforms (#3 Wetness, Soot & Ember Char)
    item.uniforms.uWetness.value = item.wetness;
    item.uniforms.uSootLevel.value = floorSoot[item.floor];
    item.uniforms.uBurnAmount.value = 1.0 - item.fuel;
    item.uniforms.uEmberGlow.value = item.burning ? 1.0 : Math.max(0, (item.temp - 150) / 400);
    item.uniforms.uTime.value = elapsed;
  }

  // Update architectural wall/floor wetness & ceiling soot
  for (const surf of floorSurfaces) {
    surf.uniforms.uSootLevel.value = floorSoot[surf.floor];
    surf.uniforms.uWetness.value = waterFloors[surf.floor].mesh.visible ? 0.65 : 0.0;
    surf.uniforms.uTime.value = elapsed;
  }

  // Step particles with ceiling-jet smoke deflection
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * (p.type === 'fire' ? 1.8 : 0.45);
    p.mesh.position.addScaledVector(p.vel, dt);

    if (p.type === 'smoke') {
      const ceilY = (p.floor + 1) * FLOOR_HEIGHT - 0.25;
      // Deflect horizontally under ceiling unless in right-side stairwell shaft (x > 2.3)
      if (p.mesh.position.y >= ceilY && p.mesh.position.x < 2.3) {
        p.mesh.position.y = ceilY;
        p.vel.y = 0;
        p.vel.x += (Math.random() - 0.45) * 2.2 * dt;
        p.vel.z += (Math.random() - 0.5) * 2.2 * dt;
      } else if (p.mesh.position.x >= 2.3 && p.floor < 2) {
        p.floor = Math.min(2, Math.floor(p.mesh.position.y / FLOOR_HEIGHT));
      }
      p.mesh.scale.addScalar(dt * 1.1);
    }

    p.mesh.material.opacity = Math.max(0, p.life * 0.75);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  document.getElementById('stats').textContent =
    `F1: ${Math.round(floorTemps[0])}°C | F2: ${Math.round(floorTemps[1])}°C | F3: ${Math.round(floorTemps[2])}°C`;

  controls.update();
  renderer.render(scene, camera);
}

animate();
