import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function createWoodTextures(style = 'oak', repeat = [3, 2]) {
  const [c, ctx] = makeCanvas(512, 512);
  const [bc, bctx] = makeCanvas(512, 512);

  const palettes = {
    oak: { r: 176, g: 138, b: 98, grain: 'rgba(85, 56, 28, ', seam: '#5c3d20' },
    walnut: { r: 88, g: 58, b: 38, grain: 'rgba(30, 16, 8, ', seam: '#261409' },
    birch: { r: 196, g: 164, b: 122, grain: 'rgba(110, 82, 48, ', seam: '#7c5d37' }
  };
  const pal = palettes[style] || palettes.oak;

  ctx.fillStyle = `rgb(${pal.r},${pal.g},${pal.b})`;
  ctx.fillRect(0, 0, 512, 512);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  const planks = style === 'oak' ? 8 : 6;
  const pw = 512 / planks;
  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    const tone = (Math.random() - 0.5) * 14;
    ctx.fillStyle = `rgb(${pal.r + tone}, ${pal.g + tone * 0.8}, ${pal.b + tone * 0.6})`;
    ctx.fillRect(x0 + 1, 0, pw - 2, 512);

    for (let i = 0; i < 55; i++) {
      const gx = x0 + Math.random() * pw;
      ctx.strokeStyle = `${pal.grain}${0.06 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.8 + Math.random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 3, 170, gx - 3, 340, gx, 512);
      ctx.stroke();
    }

    ctx.fillStyle = pal.seam;
    ctx.fillRect(x0, 0, 2, 512);
    bctx.fillStyle = '#282828';
    bctx.fillRect(x0, 0, 2, 512);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat[0], repeat[1]);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat[0], repeat[1]);

  return { map, bumpMap };
}

export function createPlasterTextures() {
  const [c, ctx] = makeCanvas(512, 512);
  const [bc, bctx] = makeCanvas(512, 512);

  ctx.fillStyle = '#cfd5df';
  ctx.fillRect(0, 0, 512, 512);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  // Subtle modern Venetian micro-cement trowel strokes
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 18 + Math.random() * 44;
    const h = 8 + Math.random() * 20;
    const v = 200 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 6},0.16)`;
    ctx.fillRect(x, y, w, h);

    const bv = 120 + Math.floor(Math.random() * 16);
    bctx.fillStyle = `rgba(${bv},${bv},${bv},0.28)`;
    bctx.fillRect(x, y, w, h);
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

export function createFabricTexture(baseHex = '#334155', repeat = [4, 4]) {
  const [c, ctx] = makeCanvas(256, 256);
  const [bc, bctx] = makeCanvas(256, 256);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, 256, 2);
    bctx.fillStyle = y % 8 === 0 ? '#9a9a9a' : '#646464';
    bctx.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, 0, 2, 256);
    bctx.fillStyle = x % 8 === 0 ? 'rgba(175,175,175,0.5)' : 'rgba(95,95,95,0.5)';
    bctx.fillRect(x, 0, 2, 256);
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat[0], repeat[1]);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat[0], repeat[1]);

  return { map, bumpMap };
}

export function createModernRugTexture(bgHex = '#e2e8f0', lineHex = '#334155') {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 256);

  // Minimalist Scandinavian geometric rug lines
  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, 220, 220);
  ctx.lineWidth = 3;
  for (let i = 48; i <= 208; i += 40) {
    ctx.beginPath();
    ctx.moveTo(28, i);
    ctx.lineTo(228, i);
    ctx.stroke();
  }
  // Subtle weave
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, 256, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCardboardTexture() {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#b08968';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,35,15,0.07)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 6, 2);
  }
  // Packing tape strip & seam
  ctx.fillStyle = 'rgba(215, 185, 140, 0.72)';
  ctx.fillRect(108, 0, 40, 256);
  ctx.strokeStyle = 'rgba(70, 45, 20, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 252);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBrushedMetalTexture(baseHex = '#1e293b') {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createModernArtTexture(bgHex = '#f8fafc', accentA = '#0284c7', accentB = '#f97316') {
  const [c, ctx] = makeCanvas(256, 256);
  // Dark gallery frame border
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 256);
  // Matte canvas
  ctx.fillStyle = bgHex;
  ctx.fillRect(16, 16, 224, 224);
  // Minimalist Bauhaus shapes
  ctx.fillStyle = accentA;
  ctx.beginPath();
  ctx.arc(105, 118, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accentB;
  ctx.fillRect(128, 108, 72, 84);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(46, 178, 112, 12);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFoliageTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 120);
  ctx.lineTo(64, 8);
  ctx.stroke();
  for (let y = 24; y < 110; y += 18) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(24, y - 14);
    ctx.moveTo(64, y);
    ctx.lineTo(104, y - 14);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLeatherTexture(baseHex = '#7f1d1d') {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y, 3, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 248, 248);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
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
