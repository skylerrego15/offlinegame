import { R } from './rt.js';
import { ZONES, EGGS, zoneAt } from './data.js';
import { IMG } from './assets.js';
import { stats, omenActive, S } from './state.js';
import { clamp, lerp, rand, seeded, TAU, mixRgb, rgba, weighted } from './util.js';

// ---------------------------------------------------------------------------
// Water colour by depth
// ---------------------------------------------------------------------------
function colorAt(d) {
  const z = zoneAt(Math.max(0, d));
  const f = clamp((d - z.start) / (z.end - z.start), 0, 1);
  let c = mixRgb(z.top, z.bot, f);
  const next = ZONES[z.index + 1];
  if (next && d > z.end - 25) {
    const k = clamp((d - (z.end - 25)) / 25, 0, 1);
    const n = mixRgb(next.top, next.top, 0);
    c = c.map((v, i) => lerp(v, n[i], k));
  }
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

export function worldW() { return R.W / R.PPM; }

// ---------------------------------------------------------------------------
// Sky + surface
// ---------------------------------------------------------------------------
const stars = Array.from({ length: 60 }, () => [Math.random(), Math.random() * 0.7, Math.random()]);
let bolt = 0;
function drawSky(c, yWater) {
  const g = c.createLinearGradient(0, yWater - R.H, 0, yWater);
  g.addColorStop(0, '#05070d');
  g.addColorStop(0.6, '#0e1622');
  g.addColorStop(1, '#22333b');
  c.fillStyle = g;
  c.fillRect(0, 0, R.W, yWater + 2);
  // stars
  for (const s of stars) {
    const y = yWater - R.H * 1.2 + s[1] * R.H;
    if (y < 0 || y > yWater) continue;
    c.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(R.t * (0.5 + s[2]) + s[2] * 10));
    c.fillStyle = '#cfe';
    c.fillRect(s[0] * R.W, y, 1.5, 1.5);
  }
  c.globalAlpha = 1;
  // sickly moon
  const mx = R.W * 0.2, my = yWater - R.H * 0.62;
  const mg = c.createRadialGradient(mx, my, 4, mx, my, 90);
  mg.addColorStop(0, 'rgba(230,240,200,0.35)'); mg.addColorStop(1, 'rgba(230,240,200,0)');
  c.fillStyle = mg; c.beginPath(); c.arc(mx, my, 90, 0, TAU); c.fill();
  c.fillStyle = '#dfe6c8'; c.beginPath(); c.arc(mx, my, 22, 0, TAU); c.fill();
  c.fillStyle = 'rgba(14,22,34,0.85)'; c.beginPath(); c.arc(mx + 9, my - 4, 20, 0, TAU); c.fill();
  // clouds
  c.fillStyle = 'rgba(8,12,18,0.7)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 137 + R.t * 6) % (R.W + 200)) - 100;
    const y = yWater - R.H * 0.5 + (i % 3) * 40;
    c.beginPath(); c.ellipse(x, y, 90, 18, 0, 0, TAU); c.fill();
  }
  // distant lightning
  if (Math.random() < 0.003) bolt = 0.25;
  if (bolt > 0) {
    bolt -= 1 / 60;
    c.fillStyle = `rgba(200,230,255,${bolt * 0.6})`;
    c.fillRect(0, 0, R.W, yWater);
  }
}

export function waveY(xPx, t = R.t) {
  return Math.sin(xPx * 0.03 + t * 1.6) * 2.5 + Math.sin(xPx * 0.011 - t * 0.9) * 3.5;
}

// ---------------------------------------------------------------------------
// Background scenery per zone
// ---------------------------------------------------------------------------
const F = {
  crosses(c, x, y, s) {
    c.fillRect(x - s * 0.06, y - s, s * 0.12, s * 1.2);
    c.fillRect(x - s * 0.35, y - s * 0.7, s * 0.7, s * 0.1);
    c.fillRect(x - s * 0.8, y + s * 0.1, s * 1.6, s * 0.25);
  },
  kelp(c, x, y, s, r, t) {
    c.lineWidth = s * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + s);
    for (let i = 1; i <= 8; i++) c.lineTo(x + Math.sin(i * 0.8 + t * 0.6 + r * 10) * s * 0.12, y + s - (i / 8) * s * 2.4);
    c.stroke();
    for (let i = 2; i < 8; i += 2) { c.beginPath(); c.ellipse(x + Math.sin(i + t) * s * 0.12 + s * 0.1, y + s - (i / 8) * s * 2.4, s * 0.15, s * 0.05, 0.6, 0, TAU); c.fill(); }
  },
  houses(c, x, y, s, r) {
    c.beginPath(); c.moveTo(x - s * 0.5, y + s * 0.6); c.lineTo(x - s * 0.5, y); c.lineTo(x, y - s * 0.5); c.lineTo(x + s * 0.5, y + s * 0.05); c.lineTo(x + s * 0.5, y + s * 0.6); c.fill();
    c.fillRect(x + s * 0.2, y - s * 0.55, s * 0.12, s * 0.35);
    return () => { c.fillRect(x - s * 0.25, y + s * 0.1, s * 0.15, s * 0.15); if (r > 0.5) c.fillRect(x + s * 0.08, y + s * 0.15, s * 0.15, s * 0.15); };
  },
  ribs(c, x, y, s, r) {
    c.lineWidth = s * 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - s * 1.4, y + s * 0.6); c.quadraticCurveTo(x, y + s * 0.3, x + s * 1.4, y + s * 0.6); c.stroke();
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * s * 0.38, y + s * 0.45); c.quadraticCurveTo(x + i * s * 0.5 + s * 0.3, y - s * 0.6, x + i * s * 0.2 + s * 0.1, y - s * (0.9 - Math.abs(i) * 0.1)); c.stroke(); }
  },
  reef(c, x, y, s, r) {
    for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x + (i - 2) * s * 0.3, y + s * 0.4 - (i % 2) * s * 0.2, s * 0.25, s * 0.45, (i - 2) * 0.2, 0, TAU); c.fill(); }
    return () => { for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (i - 3) * s * 0.22, y + s * 0.1 - (i % 3) * s * 0.2, s * 0.05, 0, TAU); c.fill(); } };
  },
  cliffs(c, x, y, s, r) {
    c.beginPath(); c.moveTo(x - s, y + s); c.lineTo(x - s * 0.7, y - s * 0.8); c.lineTo(x - s * 0.2, y - s); c.lineTo(x + s * 0.1, y - s * 0.4); c.lineTo(x + s * 0.6, y - s * 0.6); c.lineTo(x + s, y + s); c.fill();
    return () => { c.beginPath(); c.ellipse(x - s * 0.3, y - s * 0.3, s * 0.1, s * 0.04, 0, 0, TAU); c.fill(); c.fillRect(x - s * 0.31, y - s * 0.28, s * 0.02, s * 0.5 * (0.5 + r)); };
  },
  arches(c, x, y, s) {
    c.fillRect(x - s * 0.8, y - s, s * 0.22, s * 2); c.fillRect(x + s * 0.58, y - s, s * 0.22, s * 2);
    c.beginPath(); c.moveTo(x - s * 0.8, y - s); c.quadraticCurveTo(x, y - s * 2.2, x + s * 0.8, y - s); c.lineTo(x + s * 0.58, y - s); c.quadraticCurveTo(x, y - s * 1.8, x - s * 0.58, y - s); c.fill();
    return () => { c.beginPath(); c.arc(x, y - s * 1.25, s * 0.12, 0, TAU); c.fill(); };
  },
  pools(c, x, y, s) {
    c.beginPath(); c.ellipse(x, y + s * 0.4, s * 1.3, s * 0.35, 0, 0, TAU); c.fill();
    return () => { c.beginPath(); c.ellipse(x, y + s * 0.3, s * 1.0, s * 0.12, 0, 0, TAU); c.fill(); };
  },
  skulls(c, x, y, s, r) {
    for (let i = 0; i < 6; i++) {
      const sx = x + ((i % 3) - 1) * s * 0.45 + (i > 2 ? s * 0.22 : 0), sy = y + (i > 2 ? -s * 0.35 : 0);
      c.beginPath(); c.arc(sx, sy, s * 0.22, 0, TAU); c.fill(); c.fillRect(sx - s * 0.12, sy + s * 0.1, s * 0.24, s * 0.16);
    }
    return () => { for (let i = 0; i < 3; i++) { const sx = x + (i - 1) * s * 0.45; c.fillRect(sx - s * 0.1, y - s * 0.04, s * 0.07, s * 0.07); c.fillRect(sx + s * 0.03, y - s * 0.04, s * 0.07, s * 0.07); } };
  },
  vents(c, x, y, s, r, t) {
    c.beginPath(); c.moveTo(x - s * 0.4, y + s); c.lineTo(x - s * 0.15, y - s * 0.6); c.lineTo(x + s * 0.15, y - s * 0.6); c.lineTo(x + s * 0.4, y + s); c.fill();
    for (let i = 0; i < 5; i++) { const k = ((t * 0.3 + i / 5 + r) % 1); c.globalAlpha *= 0.9; c.beginPath(); c.arc(x + Math.sin(k * 6 + i) * s * 0.2, y - s * 0.6 - k * s * 1.8, s * (0.12 + k * 0.3), 0, TAU); c.fill(); }
    return () => { c.beginPath(); c.arc(x, y - s * 0.6, s * 0.1, 0, TAU); c.fill(); };
  },
  columns(c, x, y, s, r) {
    for (let i = -1; i <= 1; i++) c.fillRect(x + i * s * 0.6 - s * 0.12, y - s * (1.4 + (i + 1) * 0.3 * r), s * 0.24, s * 3);
    return () => { for (let i = -1; i <= 1; i++) c.fillRect(x + i * s * 0.6 - s * 0.04, y - s * 0.6 + i * s * 0.2, s * 0.08, s * 0.4); };
  },
  crystals(c, x, y, s, r) {
    for (let i = 0; i < 4; i++) { const a = -0.5 + i * 0.33; c.save(); c.translate(x + (i - 1.5) * s * 0.3, y + s); c.rotate(a); c.beginPath(); c.moveTo(-s * 0.12, 0); c.lineTo(0, -s * (1.3 + (i % 2) * 0.6)); c.lineTo(s * 0.12, 0); c.fill(); c.restore(); }
    return () => { c.beginPath(); c.moveTo(x - s * 0.05, y + s); c.lineTo(x, y - s * 0.4); c.lineTo(x + s * 0.05, y + s); c.fill(); };
  },
  teeth(c, x, y, s, r) {
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x + (i - 2.5) * s * 0.4, y + s); c.quadraticCurveTo(x + (i - 2) * s * 0.4, y - s * (0.6 + (i % 2) * 0.6), x + (i - 1.5) * s * 0.4, y + s); c.fill(); }
  },
  chains(c, x, y, s, r, t) {
    c.lineWidth = s * 0.07;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(x + Math.sin(t * 0.4 + i * 0.3) * s * 0.06, y - s * 2 + i * s * 0.45, s * (i % 2 ? 0.08 : 0.16), s * 0.26, 0, 0, TAU); c.stroke(); }
  },
  moon(c, x, y, s) {
    c.beginPath(); c.arc(x, y, s * 1.4, 0, TAU); c.fill();
    return () => { c.beginPath(); c.arc(x, y, s * 1.0, 0, TAU); c.fill(); };
  },
  monoliths(c, x, y, s, r) {
    c.save(); c.translate(x, y); c.rotate((r - 0.5) * 0.7);
    c.beginPath(); c.moveTo(-s * 0.3, s); c.lineTo(-s * 0.2, -s * 1.6); c.lineTo(s * 0.35, -s * 1.3); c.lineTo(s * 0.25, s); c.fill(); c.restore();
    return () => { c.save(); c.translate(x, y); c.rotate((r - 0.5) * 0.7); c.fillRect(-s * 0.05, -s * 0.8, s * 0.1, s * 0.6); c.restore(); };
  },
  eyes(c, x, y, s, r, t) {
    const blink = Math.abs(Math.sin(t * 0.5 + r * 30)) > 0.08 ? 1 : 0.1;
    return () => { for (let i = 0; i < 3; i++) { const ex = x + (i - 1) * s * 0.7 * r, ey = y + ((i * 31) % 7 - 3) * s * 0.12; c.beginPath(); c.ellipse(ex, ey, s * 0.16, s * 0.07 * blink, 0, 0, TAU); c.fill(); } };
  },
  flesh(c, x, y, s, r, t) {
    c.beginPath(); c.ellipse(x, y, s * 1.6, s * (0.5 + Math.sin(t + r * 9) * 0.06), 0.2, 0, TAU); c.fill();
    c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(x - s * 1.4, y); c.bezierCurveTo(x - s * 0.5, y - s * 0.6, x + s * 0.5, y + s * 0.6, x + s * 1.4, y); c.stroke();
  },
  tentacles(c, x, y, s, r, t) {
    c.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      c.beginPath(); c.moveTo(x, y + s * 1.5);
      for (let i = 1; i <= 12; i++) { const f = i / 12; c.lineWidth = s * 0.3 * (1 - f) + 1; c.lineTo(x + Math.sin(f * 5 + t * 0.7 + r * 9 + k) * s * 0.6 * f, y + s * 1.5 - f * s * 3.4); }
      c.stroke();
    }
  },
  throne(c, x, y, s, r) {
    c.fillRect(x - s * 0.7, y - s * 0.2, s * 1.4, s * 1.2);
    c.beginPath(); c.moveTo(x - s * 0.55, y - s * 0.2); c.lineTo(x - s * 0.45, y - s * 2.4); c.lineTo(x, y - s * 2.9); c.lineTo(x + s * 0.45, y - s * 2.4); c.lineTo(x + s * 0.55, y - s * 0.2); c.fill();
    return () => { c.beginPath(); c.arc(x, y - s * 1.6, s * 0.06, 0, TAU); c.fill(); c.beginPath(); c.arc(x - s * 0.15, y - s * 1.7, s * 0.04, 0, TAU); c.fill(); };
  },
};

const sceneryCache = new Map();
function zoneScenery(z) {
  if (sceneryCache.has(z.index)) return sceneryCache.get(z.index);
  const rnd = seeded(9137 + z.index * 7919);
  const items = [];
  const n = Math.ceil((z.end - z.start) / 22);
  for (let i = 0; i < n; i++) {
    items.push({
      x: rnd(), d: z.start + rnd() * (z.end - z.start), s: 14 + rnd() * 30,
      layer: rnd() < 0.55 ? 0 : 1, r: rnd(),
    });
  }
  sceneryCache.set(z.index, items);
  return items;
}

function drawScenery(c) {
  const PPM = R.PPM;
  const topD = (R.camY - R.H) / PPM, botD = (R.camY + R.H * 2) / PPM;
  for (const z of ZONES) {
    if (z.end < topD || z.start > botD) continue;
    const items = zoneScenery(z);
    const fn = F[z.feature];
    const far = mixRgb(z.bot, '#000000', 0.25);
    const near = mixRgb(z.bot, '#000000', 0.55);
    for (const it of items) {
      const par = it.layer === 0 ? 0.55 : 0.85;
      const sy = (it.d * PPM - R.camY) * par + R.H * (1 - par) * 0.5;
      if (sy < -160 || sy > R.H + 160) continue;
      const sx = it.x * R.W;
      const s = it.s * (it.layer === 0 ? 0.8 : 1.25);
      const col = it.layer === 0 ? far : near;
      c.globalAlpha = it.layer === 0 ? 0.55 : 0.85;
      c.fillStyle = c.strokeStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      const glow = fn(c, sx, sy, s, it.r, R.t);
      if (glow) {
        c.globalAlpha = it.layer === 0 ? 0.35 : 0.7;
        c.fillStyle = c.strokeStyle = z.accent;
        glow();
      }
    }
  }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Marine snow
// ---------------------------------------------------------------------------
const snow = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));
function drawSnow(c, dt) {
  const v = R.camVY;
  c.fillStyle = 'rgba(220,240,235,0.5)';
  c.strokeStyle = 'rgba(220,240,235,0.35)';
  for (const p of snow) {
    p.y -= (v * p.z * dt) / R.H;
    p.y += (0.01 * p.z * dt);
    p.x += Math.sin(R.t * 0.5 + p.z * 20) * 0.0004;
    if (p.y < 0) { p.y += 1; p.x = Math.random(); }
    if (p.y > 1) { p.y -= 1; p.x = Math.random(); }
    const x = p.x * R.W, y = p.y * R.H;
    if (y < -R.camY) continue; // above water
    const streak = Math.min(60, Math.abs(v) * p.z * 0.04);
    if (streak > 2) {
      c.lineWidth = p.z * 1.5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + streak * Math.sign(v)); c.stroke();
    } else {
      c.fillRect(x, y, p.z * 2, p.z * 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Main ocean draw (screen space)
// ---------------------------------------------------------------------------
export function drawOcean(c, dt) {
  const PPM = R.PPM;
  const yWater = -R.camY; // screen y of the surface
  if (yWater > 0) drawSky(c, yWater);
  const top = Math.max(0, R.camY / PPM), bot = (R.camY + R.H) / PPM;
  const y0 = Math.max(0, yWater);
  if (y0 < R.H) {
    const g = c.createLinearGradient(0, y0, 0, R.H);
    for (let i = 0; i <= 8; i++) {
      const d = top + ((bot - top) * i) / 8;
      g.addColorStop(i / 8, colorAt(d));
    }
    c.fillStyle = g;
    c.fillRect(0, y0, R.W, R.H - y0);
    // god rays near surface
    const rayA = clamp(1 - top / 140, 0, 1);
    if (rayA > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.23 + Math.sin(R.t * 0.1 + i) * 0.05) % 1) * R.W;
        const gr = c.createLinearGradient(0, y0, 0, y0 + 500);
        gr.addColorStop(0, `rgba(160,230,220,${0.08 * rayA})`); gr.addColorStop(1, 'rgba(160,230,220,0)');
        c.fillStyle = gr;
        c.beginPath(); c.moveTo(x - 20, y0); c.lineTo(x + 25, y0); c.lineTo(x + 110, y0 + 500); c.lineTo(x + 30, y0 + 500); c.fill();
      }
      c.restore();
    }
    drawScenery(c);
    drawSnow(c, dt);
  }
}

// surface wave line, drawn over the ship hull (so the hull reads as half-submerged)
export function drawSurface(c) {
  const yWater = -R.camY;
  if (yWater < -20 || yWater > R.H + 20) return;
  c.beginPath();
  c.moveTo(0, R.H);
  for (let x = 0; x <= R.W; x += 8) c.lineTo(x, yWater + waveY(x));
  c.lineTo(R.W, R.H);
  c.closePath();
  const g = c.createLinearGradient(0, yWater - 6, 0, yWater + 120);
  g.addColorStop(0, 'rgba(70,140,150,0.35)'); g.addColorStop(1, 'rgba(15,50,62,0.12)');
  c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(200,240,235,0.55)'; c.lineWidth = 1.5;
  c.beginPath();
  for (let x = 0; x <= R.W; x += 8) { const y = yWater + waveY(x); x ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
}

// darkness that closes in with depth (screen space)
export function drawDarkness(c, cx, cy) {
  const d = (R.camY + R.H * 0.5) / R.PPM;
  const a = clamp((d - 40) / 700, 0, 0.9);
  if (a <= 0.01) return;
  const st = stats();
  const rad = 120 * st.light;
  const g = c.createRadialGradient(cx, cy, rad * 0.35, cx, cy, rad * 2.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  c.fillStyle = g;
  c.fillRect(0, 0, R.W, R.H);
}

// ---------------------------------------------------------------------------
// Field: eggs, hazards, pickups (meters)
// ---------------------------------------------------------------------------
export function newField() {
  return { eggs: [], hazards: [], pickups: [], chunks: new Set(), lurker: null };
}

function rollTier(z) {
  let c = 1 + (z.index * 7) / 19;
  if (omenActive('bloodtide')) c += 1.3;
  if (Math.random() < 0.015) return Math.min(8, Math.round(c) + 2);
  const ws = [];
  for (let t = 1; t <= 8; t++) ws.push(Math.exp(-((t - c) ** 2) / (2 * 0.85 * 0.85)));
  return weighted(ws) + 1;
}

const CHUNK = 50;
export function ensureChunks(f, depthTo) {
  const st = stats();
  const ww = worldW();
  const kmax = Math.floor(depthTo / CHUNK);
  for (let k = 0; k <= kmax; k++) {
    if (f.chunks.has(k)) continue;
    f.chunks.add(k);
    const y0 = Math.max(16, k * CHUNK), y1 = (k + 1) * CHUNK;
    if (y1 <= y0) continue;
    const z = zoneAt(y0);
    const span = (y1 - y0) / CHUNK;
    const nE = Math.floor(5.4 * st.density * span + Math.random());
    for (let i = 0; i < nE; i++) {
      f.eggs.push({
        x: rand(5, ww - 5), y: rand(y0, y1), tier: rollTier(z),
        vx: rand(-1, 1) * (1.2 + z.index * 0.08), ph: rand(0, TAU), taken: false,
      });
    }
    if (!omenActive('calm') && k >= 1) {
      const nH = Math.floor((0.45 + z.index * 0.12) * span + Math.random());
      for (let i = 0; i < nH; i++) {
        const opts = ['urchin'];
        if (z.index >= 1) opts.push('jelly');
        if (z.index >= 4) opts.push('bloat');
        if (z.index >= 7) opts.push('tentacle');
        if (z.index >= 10) opts.push('eye');
        const type = opts[Math.floor(Math.random() * opts.length)];
        const h = { type, x: rand(4, ww - 4), y: rand(y0, y1), ph: rand(0, TAU), vx: rand(-2, 2), used: false };
        if (type === 'tentacle') { h.side = Math.random() < 0.5 ? -1 : 1; h.x = h.side < 0 ? 0 : ww; h.len = rand(ww * 0.35, ww * 0.6); }
        h.r = { urchin: 2.4, jelly: 3, bloat: 3.3, tentacle: 1.6, eye: 6 }[type];
        f.hazards.push(h);
      }
    }
    const nP = Math.floor(0.8 * span + Math.random());
    for (let i = 0; i < nP; i++) {
      const roll = Math.random();
      const type = roll < 0.6 ? 'pearl' : roll < 0.85 ? 'wisp' : 'vent';
      f.pickups.push({ type, x: rand(4, ww - 4), y: rand(y0, y1), ph: rand(0, TAU), taken: false, r: type === 'vent' ? 3.2 : 2, zone: z.index });
    }
  }
}

export function updateField(f, dt) {
  const ww = worldW();
  for (const e of f.eggs) {
    if (e.taken) continue;
    e.x += e.vx * dt;
    if (e.x < 4) { e.x = 4; e.vx = Math.abs(e.vx); }
    if (e.x > ww - 4) { e.x = ww - 4; e.vx = -Math.abs(e.vx); }
  }
  for (const h of f.hazards) {
    if (h.type === 'jelly') { h.x += Math.sin(R.t * 0.8 + h.ph) * dt * 2; h.y += Math.sin(R.t * 1.3 + h.ph) * dt * 1.5; }
    if (h.type === 'bloat') { h.x += h.vx * dt * 0.4; if (h.x < 4 || h.x > ww - 4) h.vx *= -1; }
  }
}

export function tentacleTip(h) {
  const a = Math.sin(R.t * 0.9 + h.ph) * 0.6;
  const dir = h.side < 0 ? 1 : -1;
  return [h.x + Math.cos(a) * h.len * dir, h.y + Math.sin(a) * h.len];
}

// ---------------------------------------------------------------------------
// Field drawing (screen space using camera)
// ---------------------------------------------------------------------------
export function eggSize(tier) { return 6.4 * (1 + (tier - 1) * 0.05); }

export function drawEgg(c, x, y, tier, sizePx, alpha = 1, rot = 0) {
  const im = IMG.eggs[tier];
  const col = EGGS[tier - 1].color;
  const pulse = 0.6 + 0.4 * Math.sin(R.t * 3 + x * 0.1);
  const gr = c.createRadialGradient(x, y, 2, x, y, sizePx * 1.1);
  gr.addColorStop(0, rgba(col, 0.45 * pulse * alpha)); gr.addColorStop(1, rgba(col, 0));
  c.fillStyle = gr; c.beginPath(); c.arc(x, y, sizePx * 1.1, 0, TAU); c.fill();
  if (!im) return;
  const h = sizePx, w = (h * im.naturalWidth) / im.naturalHeight;
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(rot);
  c.drawImage(im, -w / 2, -h / 2, w, h);
  c.restore();
}

export function drawField(c, f, hp) {
  const PPM = R.PPM, cy = R.camY;
  const visTop = cy / PPM - 15, visBot = (cy + R.H) / PPM + 15;
  const st = stats();
  const sonarRange = st.sonar ? 40 + st.sonar * 30 : 0;
  // pickups
  for (const p of f.pickups) {
    if (p.taken || p.y < visTop || p.y > visBot) continue;
    const x = p.x * PPM, y = p.y * PPM - cy + Math.sin(R.t * 2 + p.ph) * 3;
    if (p.type === 'pearl') {
      const g = c.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
      g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#e8dcff'); g.addColorStop(1, 'rgba(200,180,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
    } else if (p.type === 'wisp') {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const g = c.createRadialGradient(x, y - i * 4, 0, x, y - i * 4, 14 - i * 3);
        g.addColorStop(0, 'rgba(160,255,200,0.7)'); g.addColorStop(1, 'rgba(60,255,160,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x + Math.sin(R.t * 5 + i) * 2, y - i * 4, 14 - i * 3, 0, TAU); c.fill();
      }
      c.restore();
    } else {
      c.fillStyle = 'rgba(30,20,20,0.9)';
      c.beginPath(); c.moveTo(x - 12, y + 10); c.lineTo(x - 4, y - 6); c.lineTo(x + 4, y - 6); c.lineTo(x + 12, y + 10); c.fill();
      c.fillStyle = 'rgba(200,240,255,0.5)';
      for (let i = 0; i < 5; i++) { const k = (R.t * 1.5 + i / 5) % 1; c.beginPath(); c.arc(x + Math.sin(i * 3 + R.t) * 4, y - 8 - k * 40, 2 + k * 3, 0, TAU); c.fill(); }
    }
  }
  // hazards
  for (const h of f.hazards) {
    if (h.y < visTop - 40 || h.y > visBot + 40) continue;
    const x = h.x * PPM, y = h.y * PPM - cy;
    if (h.type === 'urchin') {
      c.strokeStyle = '#1a0f1f'; c.lineWidth = 2;
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + R.t * 0.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); c.stroke(); }
      c.fillStyle = '#2a1430'; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill();
      c.fillStyle = '#ff3355'; c.beginPath(); c.arc(x, y, 2.5, 0, TAU); c.fill();
    } else if (h.type === 'jelly') {
      const pul = 1 + Math.sin(R.t * 4 + h.ph) * 0.1;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(180,120,255,0.35)';
      c.beginPath(); c.ellipse(x, y, 16 * pul, 11 / pul, 0, Math.PI, TAU); c.fill();
      c.strokeStyle = 'rgba(200,150,255,0.4)'; c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x - 12 + i * 6, y); for (let s = 1; s < 6; s++) c.lineTo(x - 12 + i * 6 + Math.sin(R.t * 3 + s + i) * 3, y + s * 6); c.stroke(); }
      c.restore();
    } else if (h.type === 'bloat') {
      const pul = 1 + Math.sin(R.t * 6 + h.ph) * 0.06;
      c.fillStyle = '#4a3a1a'; c.beginPath(); c.arc(x, y, 15 * pul, 0, TAU); c.fill();
      c.strokeStyle = '#d8c070'; c.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15); c.lineTo(x + Math.cos(a) * 21, y + Math.sin(a) * 21); c.stroke(); }
      c.fillStyle = `rgba(255,200,60,${0.5 + 0.5 * Math.sin(R.t * 8 + h.ph)})`;
      c.beginPath(); c.arc(x - 4, y - 3, 3, 0, TAU); c.arc(x + 4, y - 3, 3, 0, TAU); c.fill();
    } else if (h.type === 'tentacle') {
      const [tx, ty] = tentacleTip(h);
      const x0 = h.x * PPM, y0 = h.y * PPM - cy, x1 = tx * PPM, y1 = ty * PPM - cy;
      c.lineCap = 'round';
      const n = 14;
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? '#5a2440' : '#1a0812';
        c.beginPath(); c.moveTo(x0, y0);
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          c.lineWidth = (pass ? 9 : 14) * (1 - f * 0.8);
          c.lineTo(lerp(x0, x1, f) + Math.sin(f * 7 + R.t * 3 + h.ph) * 8 * f, lerp(y0, y1, f) + Math.cos(f * 6 + R.t * 2) * 6 * f);
        }
        c.stroke();
      }
    } else if (h.type === 'eye') {
      const open = h.used ? 0.1 : 0.6 + 0.4 * Math.abs(Math.sin(R.t * 0.7 + h.ph));
      c.fillStyle = '#e8d6b0'; c.beginPath(); c.ellipse(x, y, 30, 15 * open, 0, 0, TAU); c.fill();
      c.fillStyle = '#c0182f'; c.beginPath(); c.arc(x, y, 11 * open, 0, TAU); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(x, y, 2.5, 10 * open, 0, 0, TAU); c.fill();
      c.strokeStyle = '#20080c'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 30, 15 * open, 0, 0, TAU); c.stroke();
    }
  }
  // eggs
  for (const e of f.eggs) {
    if (e.taken || e.y < visTop || e.y > visBot) continue;
    const x = e.x * PPM, y = e.y * PPM - cy + Math.sin(R.t * 1.6 + e.ph) * 3;
    const sz = eggSize(e.tier) * PPM;
    drawEgg(c, x, y, e.tier, sz, 1, Math.sin(R.t + e.ph) * 0.15);
    if (hp && sonarRange && e.y > hp.y && e.y - hp.y < sonarRange) {
      const k = (R.t * 1.2 + e.ph) % 1;
      c.strokeStyle = rgba(EGGS[e.tier - 1].color, 0.6 * (1 - k)); c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, sz * 0.6 + k * 20, 0, TAU); c.stroke();
    }
  }
  // lurker
  const L = f.lurker;
  if (L) {
    const x = L.x * PPM, y = L.y * PPM - cy;
    c.save();
    c.fillStyle = 'rgba(4,2,8,0.92)';
    c.beginPath(); c.ellipse(x, y, 34, 22, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(4,2,8,0.92)'; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.lineWidth = 8;
      c.beginPath(); c.moveTo(x + (i - 2.5) * 9, y + 10);
      for (let s = 1; s <= 6; s++) { c.lineWidth = 8 * (1 - s / 7); c.lineTo(x + (i - 2.5) * 9 + Math.sin(R.t * 6 + s + i) * 7, y + 10 + s * 11); }
      c.stroke();
    }
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      c.fillStyle = 'rgba(255,40,60,0.9)';
      c.beginPath(); c.arc(x - 15 + i * 10, y - 6 + (i % 2) * 4, 2.6, 0, TAU); c.fill();
    }
    c.restore();
  }
}
