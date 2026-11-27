import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function createWoodTextures() {
  const [c, ctx] = makeCanvas(512, 512);
  const [bc, bctx] = makeCanvas(512, 512);

  ctx.fillStyle = '#7c5332';
  ctx.fillRect(0, 0, 512, 512);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  const planks = 8;
  const pw = 512 / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    const tone = (Math.random() - 0.5) * 18;
    ctx.fillStyle = `rgb(${124 + tone}, ${83 + tone * 0.7}, ${50 + tone * 0.5})`;
    ctx.fillRect(x0 + 1, 0, pw - 2, 512);

    // Wood grain lines
    for (let i = 0; i < 45; i++) {
      const gx = x0 + Math.random() * pw;
      ctx.strokeStyle = `rgba(42, 24, 10, ${0.08 + Math.random() * 0.14})`;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 4, 170, gx - 4, 340, gx, 512);
      ctx.stroke();
    }

    // Plank seam
    ctx.fillStyle = '#2d1a0d';
    ctx.fillRect(x0, 0, 2, 512);
    bctx.fillStyle = '#202020';
    bctx.fillRect(x0, 0, 2, 512);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 2);

  return { map, bumpMap };
}

export function createPlasterTextures() {
  const [c, ctx] = makeCanvas(512, 512);
  const [bc, bctx] = makeCanvas(512, 512);

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, 512, 512);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 215 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgba(${v},${v},${v + 2},0.35)`;
    ctx.fillRect(x, y, 3, 3);

    const bv = 115 + Math.floor(Math.random() * 26);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, y, 2, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 1);

  return { map, bumpMap };
}

export function createFabricTexture(baseHex = '#9a3412') {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, 0, 2, 256);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSpriteGlowTexture(inner = 'rgba(255,230,140,1)', mid = 'rgba(255,95,10,0.65)', outer = 'rgba(0,0,0,0)') {
  const [c, ctx] = makeCanvas(128, 128);
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
