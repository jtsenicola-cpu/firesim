import * as THREE from 'three';
import { applySurfacePhysicsShader } from './shaders.js';
import { createWoodTextures, createPlasterTextures, createFabricTexture, createLeatherTexture } from './textures.js';

export const FLOOR_HEIGHT = 2.8;
export const NUM_FLOORS = 3;

export function buildBuilding(scene) {
  const flammables = [];
  const floorSurfaces = [];
  const windows = [];
  const smokeLayers = [];
  const structuralBlocks = [];
  const floorTrims = [];
  let blockId = 0;

  const woodTex = createWoodTextures();
  const plasterTex = createPlasterTextures();

  for (let f = 0; f < NUM_FLOORS; f++) {
    const baseY = f * FLOOR_HEIGHT;

    // 1. Hardwood floor slab with stairwell cutout on right (x: 2.2 to 3.9, z: -2.2 to 0.6)
    const slabMat = new THREE.MeshStandardMaterial({
      map: woodTex.map,
      bumpMap: woodTex.bumpMap,
      bumpScale: 0.015,
      roughness: 0.62
    });
    const slabUniforms = applySurfacePhysicsShader(slabMat, {
      floorBaseY: baseY,
      ceilingHeight: FLOOR_HEIGHT
    });

    const mainSlab = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 5.8), slabMat);
    mainSlab.position.set(-1.0, baseY - 0.09, 0);
    mainSlab.castShadow = true;
    mainSlab.receiveShadow = true;
    scene.add(mainSlab);
    if (f > 0) {
      const slabBlock = {
        id: blockId++, floor: f, isLoadBearing: false, isSlab: true,
        width: 6.2, height: 0.18, depth: 5.8,
        integrity: 1.0, destroyed: false, mesh: mainSlab, color: 0x7c5332
      };
      mainSlab.userData.structuralBlock = slabBlock;
      structuralBlocks.push(slabBlock);
    }

    const frontLanding = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 2.3), slabMat);
    frontLanding.position.set(3.1, baseY - 0.09, 1.75);
    frontLanding.castShadow = true;
    frontLanding.receiveShadow = true;
    scene.add(frontLanding);
    if (f > 0) {
      const landBlock = {
        id: blockId++, floor: f, isLoadBearing: false, isSlab: true,
        width: 2.0, height: 0.18, depth: 2.3,
        integrity: 1.0, destroyed: false, mesh: frontLanding, color: 0x7c5332
      };
      frontLanding.userData.structuralBlock = landBlock;
      structuralBlocks.push(landBlock);
    }

    if (f === 0) {
      // Solid ground under stairwell
      const stairBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 3.5), slabMat);
      stairBase.position.set(3.1, baseY - 0.09, -1.15);
      stairBase.receiveShadow = true;
      scene.add(stairBase);
    } else {
      // Flammable wooden staircase flights + handrail connecting floor f-1 to floor f
      const stairSegments = addStaircase(scene, 3.0, baseY - FLOOR_HEIGHT, -0.8, FLOOR_HEIGHT, f - 1);
      flammables.push(...stairSegments);
    }

    floorSurfaces.push({ floor: f, uniforms: slabUniforms });

    // 2. Textured Plaster Walls + Baseboards
    const wallMat = new THREE.MeshStandardMaterial({
      map: plasterTex.map,
      bumpMap: plasterTex.bumpMap,
      bumpScale: 0.01,
      roughness: 0.85
    });
    const wallUniforms = applySurfacePhysicsShader(wallMat, {
      floorBaseY: baseY,
      ceilingHeight: FLOOR_HEIGHT
    });

    // Modular destructible back wall panels (4 load-bearing bays) & right wall panels (3 bays)
    const backSegments = [
      { x: -3.075, w: 2.05 },
      { x: -1.025, w: 2.05 },
      { x: 1.025, w: 2.05 },
      { x: 3.075, w: 2.05 }
    ];
    const floorBackPanels = [];
    for (const seg of backSegments) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(seg.w - 0.03, FLOOR_HEIGHT, 0.16), wallMat);
      panel.position.set(seg.x, baseY + FLOOR_HEIGHT / 2, -2.85);
      panel.castShadow = true;
      panel.receiveShadow = true;
      scene.add(panel);
      const b = {
        id: blockId++, floor: f, isLoadBearing: true, isSlab: false,
        width: seg.w - 0.03, height: FLOOR_HEIGHT, depth: 0.16,
        integrity: 1.0, destroyed: false, mesh: panel,
        origPos: panel.position.clone(), color: 0xd1d6de
      };
      panel.userData.structuralBlock = b;
      structuralBlocks.push(b);
      floorBackPanels.push(b);
    }

    const rightSegments = [
      { z: -1.93, d: 1.93 },
      { z: 0.0, d: 1.93 },
      { z: 1.93, d: 1.93 }
    ];
    for (const seg of rightSegments) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, FLOOR_HEIGHT, seg.d - 0.03), wallMat);
      panel.position.set(4.05, baseY + FLOOR_HEIGHT / 2, seg.z);
      panel.castShadow = true;
      panel.receiveShadow = true;
      scene.add(panel);
      const b = {
        id: blockId++, floor: f, isLoadBearing: true, isSlab: false,
        width: 0.16, height: FLOOR_HEIGHT, depth: seg.d - 0.03,
        integrity: 1.0, destroyed: false, mesh: panel,
        origPos: panel.position.clone(), color: 0xd1d6de
      };
      panel.userData.structuralBlock = b;
      structuralBlocks.push(b);
    }

    // Baseboard trim
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.14, 0.04), trimMat);
    backTrim.position.set(0, baseY + 0.07, -2.75);
    const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 5.7), trimMat);
    rightTrim.position.set(3.95, baseY + 0.07, 0);
    scene.add(backTrim, rightTrim);
    floorTrims.push([backTrim, rightTrim]);

    // 3. Back Wall Window with Glass Pane (shatters at high heat, falls if back wall breaks)
    const winObj = createWindow(scene, -1.2, baseY + 1.45, -2.76, f);
    winObj.supportBlock = floorBackPanels[1]; // x = -1.025 panel behind window
    winObj.fallen = false;
    winObj.vy = 0;
    windows.push(winObj);

    // Descending Ceiling Smoke Layer per floor
    const smokeLayerMat = new THREE.MeshBasicMaterial({
      color: 0x0f1117,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const smokeLayer = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.55, 5.5), smokeLayerMat);
    smokeLayer.position.set(0, baseY + FLOOR_HEIGHT - 0.35, 0);
    smokeLayer.userData.noRaycast = true;
    smokeLayer.visible = false;
    scene.add(smokeLayer);
    smokeLayers.push({ floor: f, baseY, mesh: smokeLayer, mat: smokeLayerMat });

    floorSurfaces.push({ floor: f, uniforms: wallUniforms });

    // 4. Detailed Multi-Part Furniture & Supported Props (#4)
    if (f === 0) {
      const sofa = createDetailedSofa(scene, -1.7, baseY, 0.3, f);
      const table = createDetailedCoffeeTable(scene, -1.7, baseY, 1.55, f);
      const rug = createRug(scene, -1.7, baseY, 1.0, f);
      const bookStack = createSupportedProp(scene, -1.7, baseY + 0.46, 1.55, f, table, {
        name: 'Magazines', color: 0xfef08a, size: [0.38, 0.06, 0.28]
      });
      const bookshelf = createBookshelf(scene, -3.3, baseY, -1.9, f);
      const consoleTable = createDetailedDesk(scene, 0.45, baseY, 0.55, f, 'Hall Console');
      const runnerRug = createRunnerRug(scene, 1.45, baseY, 1.15, f);
      const entryBoxes = createDetailedCrates(scene, 2.75, baseY, 0.95, f, 'Entryway Boxes', 0.65);
      flammables.push(sofa, table, rug, bookStack, bookshelf, consoleTable, runnerRug, entryBoxes);
    } else if (f === 1) {
      const bed = createDetailedBed(scene, -1.9, baseY, -0.7, f);
      const desk = createDetailedDesk(scene, 0.65, baseY, -1.8, f);
      const monitor = createSupportedProp(scene, 0.65, baseY + 0.78, -1.85, f, desk, {
        name: 'PC Monitor', color: 0x1e293b, size: [0.65, 0.44, 0.08]
      });
      const nightstand = createNightstand(scene, -3.25, baseY, -1.45, f);
      const lamp = createSupportedProp(scene, -3.25, baseY + 0.56, -1.45, f, nightstand, {
        name: 'Bedside Lamp', color: 0xfde68a, size: [0.24, 0.34, 0.24]
      });
      const landingBench = createWoodenBench(scene, 2.55, baseY, 1.85, f);
      const hallShelf = createBookshelf(scene, 1.85, baseY, -2.15, f);
      flammables.push(bed, desk, monitor, nightstand, lamp, landingBench, hallShelf);
    } else {
      const workbench = createDetailedDesk(scene, 0.5, baseY, -1.8, f, 'Workbench');
      const paintCans = createSupportedProp(scene, 0.3, baseY + 0.78, -1.8, f, workbench, {
        name: 'Solvent Cans', color: 0xef4444, size: [0.35, 0.28, 0.22]
      });
      const crates = createDetailedCrates(scene, -1.8, baseY, -0.8, f);
      const stairLandingCrates = createDetailedCrates(scene, 2.65, baseY, 1.75, f, 'Attic Boxes', 0.7);
      const punchingBag = createPunchingBag(scene, -0.25, baseY, 0.85, f);
      flammables.push(workbench, paintCans, crates, stairLandingCrates, punchingBag);
    }
  }

  // Roof slab (supported by top floor walls)
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(8.35, 0.22, 5.95),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
  );
  roof.position.set(0, NUM_FLOORS * FLOOR_HEIGHT + 0.11, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  scene.add(roof);
  const roofBlock = {
    id: blockId++, floor: NUM_FLOORS - 1, isLoadBearing: false, isSlab: true, isRoof: true,
    width: 8.35, height: 0.22, depth: 5.95,
    integrity: 1.0, destroyed: false, mesh: roof, color: 0x1e293b
  };
  roof.userData.structuralBlock = roofBlock;
  structuralBlocks.push(roofBlock);

  return { flammables, floorSurfaces, windows, smokeLayers, structuralBlocks, floorTrims };
}

function addStaircase(scene, x, baseY, zStart, height, lowerFloor) {
  const steps = 10;
  const dy = height / steps;
  const dz = 2.4 / steps;
  const lowerGroup = new THREE.Group();
  lowerGroup.position.set(x, baseY, zStart);
  const upperGroup = new THREE.Group();
  upperGroup.position.set(x, baseY + height * 0.5, zStart + 1.2);

  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.09, dz * 1.18));
    if (i < 5) {
      step.position.set(0, (i + 0.5) * dy, i * dz);
      lowerGroup.add(step);
    } else {
      step.position.set(0, (i - 5 + 0.5) * dy, (i - 5) * dz);
      upperGroup.add(step);
    }
  }

  // Wooden handrail posts + angled stair stringers
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07));
  postL.position.set(-0.62, 0.45, 0.1);
  const postU = postL.clone();
  postU.position.set(-0.62, 0.45, 1.0);
  const stringerLen = Math.sqrt(1.2 * 1.2 + (height * 0.5) * (height * 0.5));
  const stringerAngle = -Math.atan2(height * 0.5, 1.2);
  const stringerL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, stringerLen));
  stringerL.position.set(-0.65, height * 0.25 - 0.06, 0.55);
  stringerL.rotation.x = stringerAngle;
  const stringerU = stringerL.clone();
  stringerU.position.set(-0.65, height * 0.25 - 0.06, 0.55);
  lowerGroup.add(postL, stringerL);
  upperGroup.add(postU, stringerU);

  const lowerNode = makeFlammableNode(scene, lowerGroup, {
    name: `Stairs F${lowerFloor + 1} Lower`,
    floor: lowerFloor,
    color: 0x92400e,
    roughness: 0.68
  });
  const upperNode = makeFlammableNode(scene, upperGroup, {
    name: `Stairs F${lowerFloor + 1} Upper`,
    floor: lowerFloor + 1,
    color: 0x92400e,
    roughness: 0.68
  });
  return [lowerNode, upperNode];
}

function createRunnerRug(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const tex = createFabricTexture('#991b1b');
  const matMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.025, 1.05));
  matMesh.position.y = 0.013;
  g.add(matMesh);
  return makeFlammableNode(scene, g, { name: 'Hallway Runner', floor, map: tex, roughness: 0.95 });
}

function createWoodenBench(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.48));
  seat.position.y = 0.44;
  g.add(seat);
  for (const lx of [-0.48, 0.48]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.44));
    leg.position.set(lx, 0.21, 0);
    g.add(leg);
  }
  return makeFlammableNode(scene, g, { name: 'Landing Bench', floor, color: 0x78350f, roughness: 0.62 });
}

function createWindow(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.1), frameMat);
  top.position.y = 0.65;
  const bot = top.clone();
  bot.position.y = -0.65;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.1), frameMat);
  left.position.x = -0.81;
  const right = left.clone();
  right.position.x = 0.81;
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.24, 0.06), frameMat);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.38,
    roughness: 0.05,
    metalness: 0.1
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 1.22), glassMat);
  g.add(top, bot, left, right, mullion, glass);
  scene.add(g);

  return { floor, group: g, glass, broken: false };
}

function makeFlammableNode(scene, group, opts) {
  const matOpts = {
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.72
  };
  if (opts.map) matOpts.map = opts.map;

  const mat = new THREE.MeshStandardMaterial(matOpts);
  const uniforms = applySurfacePhysicsShader(mat, {
    floorBaseY: opts.floor * FLOOR_HEIGHT,
    ceilingHeight: FLOOR_HEIGHT
  });

  group.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry.type === 'BoxGeometry' && child.geometry.parameters) {
        const p = child.geometry.parameters;
        if ((p.widthSegments ?? 1) < 8) {
          child.geometry.dispose();
          child.geometry = new THREE.BoxGeometry(p.width, p.height, p.depth, 8, 8, 8);
        }
      } else {
        child.geometry = child.geometry.clone();
      }
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
    baseY: opts.floor * FLOOR_HEIGHT,
    group,
    uniforms,
    temp: 22,
    fuel: 1.0,
    wetness: 0.0,
    burning: false,
    supportedBy: opts.supportedBy ?? null,
    isHanging: opts.isHanging ?? false,
    swingAngle: 0,
    swingVel: 0,
    fallen: false,
    vy: 0
  };
}

function createSupportedProp(scene, x, y, z, floor, supportNode, opts) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...opts.size));
  mesh.position.y = opts.size[1] / 2;
  g.add(mesh);
  return makeFlammableNode(scene, g, {
    name: opts.name,
    floor,
    color: opts.color,
    roughness: 0.5,
    supportedBy: supportNode
  });
}

function createDetailedSofa(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const tex = createFabricTexture('#b45309');

  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.24, 0.96));
  frame.position.y = 0.18;
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.16, 0.88));
  c1.position.set(-0.52, 0.36, 0.04);
  const c2 = c1.clone();
  c2.position.x = 0.52;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.54, 0.24));
  back.position.set(0, 0.56, -0.36);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.96));
  armL.position.set(-1.02, 0.46, 0);
  const armR = armL.clone();
  armR.position.x = 1.02;

  // 4 wooden legs
  for (const lx of [-0.95, 0.95]) {
    for (const lz of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08));
      leg.position.set(lx, 0.05, lz);
      g.add(leg);
    }
  }
  g.add(frame, c1, c2, back, armL, armR);
  return makeFlammableNode(scene, g, { name: 'Fabric Sofa', floor, map: tex, roughness: 0.9 });
}

function createDetailedCoffeeTable(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.07, 0.72));
  top.position.y = 0.42;
  g.add(top);
  for (const lx of [-0.58, 0.58]) {
    for (const lz of [-0.28, 0.28]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07));
      leg.position.set(lx, 0.2, lz);
      g.add(leg);
    }
  }
  return makeFlammableNode(scene, g, { name: 'Oak Coffee Table', floor, color: 0x78350f, roughness: 0.55 });
}

function createRug(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const tex = createFabricTexture('#991b1b');
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.02, 1.8));
  mesh.position.y = 0.01;
  g.add(mesh);
  return makeFlammableNode(scene, g, { name: 'Woven Rug', floor, map: tex, roughness: 0.95 });
}

function createBookshelf(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.75, 0.38));
  sideL.position.set(-0.42, 0.875, 0);
  const sideR = sideL.clone();
  sideR.position.x = 0.42;
  g.add(sideL, sideR);
  for (let s = 0; s < 4; s++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.38));
    shelf.position.set(0, 0.1 + s * 0.52, 0);
    g.add(shelf);
  }
  return makeFlammableNode(scene, g, { name: 'Bookshelf', floor, color: 0x713f12, roughness: 0.65 });
}

function createDetailedBed(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const tex = createFabricTexture('#cbd5e1');
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.22, 2.16));
  frame.position.y = 0.16;
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.24, 2.04));
  mattress.position.y = 0.38;
  const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.42));
  pillow1.position.set(-0.42, 0.54, -0.72);
  const pillow2 = pillow1.clone();
  pillow2.position.x = 0.42;
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.92, 0.12));
  headboard.position.set(0, 0.48, -1.04);
  g.add(frame, mattress, pillow1, pillow2, headboard);
  return makeFlammableNode(scene, g, { name: 'Queen Bed', floor, map: tex, roughness: 0.88 });
}

function createDetailedDesk(scene, x, y, z, floor, label = 'Study Desk') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.78));
  top.position.y = 0.74;
  g.add(top);
  for (const lx of [-0.68, 0.68]) {
    for (const lz of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07));
      leg.position.set(lx, 0.36, lz);
      g.add(leg);
    }
  }
  return makeFlammableNode(scene, g, { name: label, floor, color: 0x92400e, roughness: 0.52 });
}

function createNightstand(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.54, 0.46));
  body.position.y = 0.28;
  g.add(body);
  return makeFlammableNode(scene, g, { name: 'Nightstand', floor, color: 0x78350f, roughness: 0.6 });
}

function createDetailedCrates(scene, x, y, z, floor, label = 'Timber Crates', scale = 1.0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.92));
  c1.position.set(0, 0.46, 0);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72));
  c2.position.set(0.88, 0.36, 0.22);
  const c3 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55));
  c3.position.set(0.1, 1.19, -0.05);
  g.add(c1, c2, c3);
  return makeFlammableNode(scene, g, { name: label, floor, color: 0xb45309, roughness: 0.82 });
}

function createPunchingBag(scene, x, y, z, floor) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Heavy leather bag body (subdivided for realistic blistering/sagging)
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 1.18, 14, 6));
  bag.position.y = 1.48;

  // Top & bottom reinforced caps
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.1, 14, 2));
  topCap.position.y = 2.11;
  const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.08, 14, 2));
  botCap.position.y = 0.86;

  // Hanging chain/strap up to ceiling
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8, 2));
  strap.position.y = 2.48;

  const leatherTex = createLeatherTexture('#881337');
  g.add(bag, topCap, botCap, strap);
  return makeFlammableNode(scene, g, { name: 'Punching Bag', floor, map: leatherTex, roughness: 0.45, isHanging: true });
}
