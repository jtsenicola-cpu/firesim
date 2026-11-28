import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function loadExternalTexture(path, repeat = [1, 1], srgb = true) {
  const tex = loader.load(path);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createWoodTextures(style = 'oak', repeat = [3, 2]) {
  const file = style === 'walnut'
    ? './assets/textures/walnut-wood.jpg'
    : './assets/textures/oak-floor.jpg';
  const map = loadExternalTexture(file, repeat, true);
  return { map, bumpMap: map };
}

export function createPlasterTextures() {
  const map = loadExternalTexture('./assets/textures/plaster-wall.jpg', [2, 1], true);
  return { map, bumpMap: map };
}

export function createFabricTexture(_baseHex = '#334155', repeat = [3, 3]) {
  const map = loadExternalTexture('./assets/textures/slate-fabric.jpg', repeat, true);
  return { map, bumpMap: map };
}

export function createModernRugTexture() {
  return loadExternalTexture('./assets/textures/modern-rug.jpg', [1, 1], true);
}

export function createCardboardTexture() {
  return loadExternalTexture('./assets/textures/cardboard.jpg', [1, 1], true);
}

export function createBrushedMetalTexture() {
  return loadExternalTexture('./assets/textures/plaster-wall.jpg', [2, 2], true);
}

export function createModernArtTexture() {
  return loadExternalTexture('./assets/textures/modern-rug.jpg', [1, 1], true);
}

export function createFoliageTexture() {
  return loadExternalTexture('./assets/textures/slate-fabric.jpg', [2, 2], true);
}

export function createLeatherTexture() {
  return loadExternalTexture('./assets/textures/walnut-wood.jpg', [2, 2], true);
}

export function createSpriteGlowTexture(inner = 'rgba(255,230,140,1)', mid = 'rgba(255,95,10,0.65)', outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
