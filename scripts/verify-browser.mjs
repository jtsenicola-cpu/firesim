import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chromium-based browser executable found (Brave, Edge, or Chrome).');
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const filePath = path.join(ROOT, rel);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

const executablePath = findBrowserExecutable();
const { server, url } = await startServer();
const errors = [];

let browser;
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__firesim), { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, '01-initial.png') });

  // Scenario 1: Sofa fire & thermal de-morphing close-up
  const metrics1 = await page.evaluate(() => {
    window.__firesim.setCameraPreset('f1-closeup');
    window.__firesim.ignite('Fabric Sofa');
    return window.__firesim.step(0.03, 500);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT_DIR, '02-sofa-fire-demorph.png') });

  // Scenario 2: Punching bag burn + localized puddle on Floor 2 + room flood on Floor 1
  const metrics2 = await page.evaluate(() => {
    window.__firesim.setCameraPreset('default');
    window.__firesim.ignite('Punching Bag');
    for (let i = 0; i < 3; i++) {
      window.__firesim.sprayWater(1, -1.0, 0.5, 0.12);
    }
    for (let i = 0; i < 45; i++) {
      window.__firesim.sprayWater(0, -1.6, 0.4, 0.65);
    }
    return window.__firesim.step(0.03, 150);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT_DIR, '03-punching-bag-water.png') });

  // Scenario 3: Red Faction structural destruction (collapse Floor 2 & 3 -> floor remnants, falling window & roof)
  const metrics3 = await page.evaluate(() => {
    window.__firesim.setCameraPreset('default');
    // Breach Floor 2 load-bearing walls (indices 9..13) to trigger upper collapse
    for (let i = 9; i <= 13; i++) {
      window.__firesim.breachBlock(i, 1.0);
    }
    return window.__firesim.step(0.03, 90);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT_DIR, '04-destruction-remnants.png') });

  console.log(JSON.stringify({ executablePath, errors, metrics1, metrics2, metrics3Summary: { intactBlocks: metrics3.intactBlocks, totalBlocks: metrics3.totalBlocks } }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
