import * as THREE from 'three';
import { applySurfacePhysicsShader } from './shaders.js';

export const FLOOR_HEIGHT = 2.8;
export const NUM_FLOORS = 3;

export function buildBuilding(scene) {
  const flammables = [];
  const floorSurfaces = [];

  for (let f = 0; f < NUM_FLOORS; f++) {
    const baseY = f * FLOOR_HEIGHT;

    // Slab with wetness & soot shader
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.75 });
    const slabUniforms = applySurfacePhysicsShader(slabMat, {
      floorBaseY: baseY,
      ceilingHeight: FLOOR_HEIGHT
    });

    const slab = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.18, 5.8), slabMat);
    slab.position.set(0, baseY - 0.09, 0);
    slab.receiveShadow = true;
    scene.add(slab);
    floorSurfaces.push({ floor: f, uniforms: slabUniforms });

    // Back & Right walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8dee9, roughness: 0.85 });
    const wallUniforms = applySurfacePhysicsShader(wallMat, {
      floorBaseY: baseY,
      ceilingHeight: FLOOR_HEIGHT
    });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.2, FLOOR_HEIGHT, 0.16), wallMat);
    backWall.position.set(0, baseY + FLOOR_HEIGHT / 2, -2.85);
    scene.add(backWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, FLOOR_HEIGHT, 5.8), wallMat);
    rightWall.position.set(4.05, baseY + FLOOR_HEIGHT / 2, 0);
    scene.add(rightWall);

    floorSurfaces.push({ floor: f, uniforms: wallUniforms });

    // Populate furniture per floor
    if (f === 0) {
      flammables.push(createSofa(scene, -1.6, baseY, 0.4, f));
      flammables.push(createCoffeeTable(scene, -1.6, baseY, 1.6, f));
    } else if (f === 1) {
      flammables.push(createBed(scene, -1.8, baseY, -0.6, f));
      flammables.push(createDesk(scene, 0.8, baseY, -1.6, f));
    } else {
      flammables.push(createCrates(scene, -1.5, baseY, -0.5, f));
    }
  }

  // Roof slab
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(8.3, 0.2, 5.9),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
  );
  roof.position.set(0, NUM_FLOORS * FLOOR_HEIGHT + 0.1, 0);
  scene.add(roof);

  return { flammables, floorSurfaces };
}

function makeFlammableNode(scene, group, opts) {
  const mat = new THREE.MeshStandardMaterial({ color: opts.color, roughness: opts.roughness ?? 0.7 });
  const uniforms = applySurfacePhysicsShader(mat, {
    floorBaseY: opts.floor * FLOOR_HEIGHT,
    ceilingHeight: FLOOR_HEIGHT
  });

  group.traverse((child) => {
    if (child.isMesh) {
      child.geometry = child.geometry.clone();
      child.geometry.userData.origPos = child.geometry.attributes.position.array.slice();
      child.material = mat;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(group);
  return {
    name: opts.name,
    floor: opts.floor,
    group,
    uniforms,
    temp: 22,
    ignitionTemp: opts.ignitionTemp ?? 260,
    fuel: 1.0,
    wetness: 0.0,
    burning: false
  };
}

function createSofa(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.95));
  base.position.y = 0.21;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.24));
  back.position.set(0, 0.62, -0.35);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.95));
  armL.position.set(-1.0, 0.52, 0);
  const armR = armL.clone();
  armR.position.x = 1.0;
  g.add(base, back, armL, armR);
  return makeFlammableNode(scene, g, { name: 'Sectional Sofa', floor, color: 0x9a3412, roughness: 0.88 });
}

function createCoffeeTable(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.7));
  top.position.y = 0.42;
  g.add(top);
  return makeFlammableNode(scene, g, { name: 'Oak Coffee Table', floor, color: 0x78350f, roughness: 0.6 });
}

function createBed(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 2.1));
  mattress.position.y = 0.32;
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.85, 0.14));
  headboard.position.set(0, 0.55, -1.0);
  g.add(mattress, headboard);
  return makeFlammableNode(scene, g, { name: 'Queen Mattress', floor, color: 0xe2e8f0, roughness: 0.9 });
}

function createDesk(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.75));
  top.position.y = 0.74;
  g.add(top);
  return makeFlammableNode(scene, g, { name: 'Study Desk', floor, color: 0x92400e, roughness: 0.55 });
}

function createCrates(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9));
  c1.position.set(0, 0.45, 0);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7));
  c2.position.set(0.85, 0.35, 0.2);
  g.add(c1, c2);
  return makeFlammableNode(scene, g, { name: 'Storage Crates', floor, color: 0xb45309, roughness: 0.85 });
}
