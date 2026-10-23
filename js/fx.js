import { R } from './rt.js';
import { rand, TAU, clamp, ease, hsl, rgba } from './util.js';
import { makeBolt, drawBolt } from './bolt.js';
import { renderFX } from './gl.js';
let comboBolts = [], boltAt = 0;

const parts = [];
// soft glow sprites (tinted once per colour) so particles read as light, not flat dots
const sprCache = new Map();
let whiteSpr = null;
function softSprite(col) {
  if (sprCache.has(col)) return sprCache.get(col);
  if (!whiteSpr) {
    whiteSpr = document.createElement('canvas'); whiteSpr.width = whiteSpr.height = 48;
    const g = whiteSpr.getContext('2d'); const gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = 48;
  const g = cv.getContext('2d');
  g.drawImage(whiteSpr, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, 48, 48);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55;
  const core = g.createRadialGradient(24, 24, 0, 24, 24, 7); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core; g.fillRect(0, 0, 48, 48);
  if (sprCache.size > 64) sprCache.clear();
  sprCache.set(col, cv);
  return cv;
}
const texts = [];
let shakeAmt = 0, flashA = 0, flashCol = '#fff';
let hitstop = 0;
export const combo = { level: 0, t: 0, life: 0, x: 0, y: 0, label: '', sub: '' };

export function spark(x, y, o = {}) {
  if (parts.length > 700) parts.shift();
  parts.push({
    x, y,
    vx: o.vx ?? rand(-1, 1) * (o.speed ?? 120),
    vy: o.vy ?? rand(-1, 1) * (o.speed ?? 120),
    life: o.life ?? rand(0.4, 0.9), max: 0,
    size: o.size ?? rand(1.5, 3.5),
    color: o.color ?? '#fff',
    grav: o.grav ?? 0, drag: o.drag ?? 2.2,
    scr: !!o.scr, kind: o.kind || 'dot', rot: rand(0, TAU), vr: rand(-6, 6),
    glow: o.glow ?? true,
  });
  const p = parts[parts.length - 1]; p.max = p.life;
}
export function burst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.3, 1) * (o.speed ?? 200);
    spark(x, y, Object.assign({}, o, { vx: Math.cos(a) * s, vy: Math.sin(a) * s }));
  }
}
export function ring(x, y, color, maxR = 80, life = 0.5, scr = false, width = 4) {
  parts.push({ x, y, vx: 0, vy: 0, life, max: life, size: maxR, color, grav: 0, drag: 0, scr, kind: 'ring', width });
}
export function floatText(x, y, str, color = '#fff', size = 18, scr = false, life = 1.1) {
  texts.push({ x, y, str, color, size, scr, life, max: life, vy: -40 });
}
export function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
export function flash(color, a) { flashCol = color; flashA = Math.max(flashA, a); }
export function stop(sec) { hitstop = Math.max(hitstop, sec); }
export function isStopped() { return hitstop > 0; }
export function clearFx() { parts.length = 0; texts.length = 0; combo.life = 0; }

const COMBO_COLS = ['#ffffff', '#9fffe0', '#7ff6ff', '#c79bff', '#ffd34d', '#ff4d6d', '#3dffc8', '#ffffff'];
export function comboFX(level, sx, sy, label, sub, sub2 = '') {
  const L = Math.min(level, 12);
  combo.level = L; combo.t = 0; combo.life = 0.85 + Math.min(L, 8) * 0.05;
  combo.x = sx; combo.y = sy; combo.label = label; combo.sub = sub; combo.sub2 = sub2;
  combo.col = COMBO_COLS[Math.min(L - 1, COMBO_COLS.length - 1)];
  shake(Math.min(7, 2 + L * 0.6));
  stop(Math.min(0.09, 0.02 + L * 0.008));
  // a few soft embers thrown off the hit, kept small so the water stays readable
  for (let i = 0; i < 10 + L * 3; i++) {
    const a = rand(0, TAU), sp = rand(80, 260 + L * 25);
    parts.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.35, 0.7), max: 0.7, size: rand(1.2, 2.4), color: i % 3 ? combo.col : '#ffffff', grav: 0, drag: 3.2, scr: true, kind: 'ember' });
  }
}

export function update(dt) {
  if (hitstop > 0) hitstop -= dt;
  shakeAmt *= Math.pow(0.0015, dt);
  if (shakeAmt < 0.05) shakeAmt = 0;
  flashA *= Math.pow(0.004, dt);
  combo.t += dt;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt);
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    t.y += t.vy * dt; t.vy *= Math.exp(-2 * dt);
    if (t.life <= 0) texts.splice(i, 1);
  }
}

export function shakeOffset() {
  if (!shakeAmt) return [0, 0];
  return [rand(-1, 1) * shakeAmt, rand(-1, 1) * shakeAmt];
}

function drawP(c, p, ox, oy) {
  const k = Math.max(0, p.life / p.max);
  const x = p.x - ox, y = p.y - oy;
  if (p.kind === 'ring') {
    const r = p.size * ease.outCubic(1 - k), bw = Math.max(4, r * 0.18);
    if (r < 1) return;
    const g = c.createRadialGradient(x, y, Math.max(0, r - bw), x, y, r + bw);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.55 * k; c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r + bw, 0, TAU); c.fill();
    return;
  }
  if (p.kind === 'shard') {
    c.globalAlpha = Math.min(1, k * 1.5); c.fillStyle = p.color;
    c.save(); c.translate(x, y); c.rotate(p.rot);
    c.beginPath(); c.moveTo(-p.size, -p.size * 0.6); c.lineTo(p.size, 0); c.lineTo(-p.size * 0.4, p.size * 0.8); c.closePath(); c.fill();
    c.restore();
    return;
  }
  if (p.kind === 'ember' || p.kind === 'streak') {
    const sp = Math.hypot(p.vx, p.vy);
    c.globalAlpha = Math.min(1, k * 1.6);
    if (sp > 30) {
      c.strokeStyle = p.color; c.lineWidth = p.size * 0.9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - p.vx * 0.035, y - p.vy * 0.035); c.stroke();
    }
    const s = p.size * 3.2;
    c.globalAlpha *= 0.8;
    c.drawImage(softSprite(p.color), x - s, y - s, s * 2, s * 2);
    return;
  }
  if (p.glow === false) {
    c.globalAlpha = Math.min(1, k * 1.5) * 0.8;
    const s = p.size * 1.6;
    c.drawImage(softSprite(p.color), x - s, y - s, s * 2, s * 2);
    return;
  }
  c.globalAlpha = Math.min(1, k * 1.5);
  const s = p.size * (2.2 + k * 1.2);
  c.drawImage(softSprite(p.color), x - s, y - s, s * 2, s * 2);
}

export function drawWorld(c) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const p of parts) if (!p.scr) drawP(c, p, 0, R.camY);
  c.restore();
  c.globalAlpha = 1;
  for (const t of texts) if (!t.scr) drawText(c, t, 0, R.camY);
}

function drawText(c, t, ox, oy) {
  const k = t.life / t.max;
  c.globalAlpha = Math.min(1, k * 2);
  const s = t.size * (1 + 0.25 * ease.outBack(clamp((t.max - t.life) * 5, 0, 1)) - 0.25);
  c.font = `800 ${s}px Georgia, 'Times New Roman', serif`;
  c.textAlign = 'center';
  c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.75)';
  c.strokeText(t.str, t.x - ox, t.y - oy);
  c.fillStyle = t.color; c.fillText(t.str, t.x - ox, t.y - oy);
  c.globalAlpha = 1;
}

// screen-space overlays: particles, flash, combo spectacle
export function drawScreen(c) {
  const W = R.W, H = R.H;
  // combo spectacle (behind screen particles)
  if (combo.t < combo.life) drawCombo(c, W, H);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const p of parts) if (p.scr) drawP(c, p, 0, 0);
  c.restore();
  c.globalAlpha = 1;
  for (const t of texts) if (t.scr) drawText(c, t, 0, 0);
  if (flashA > 0.01) {
    c.globalAlpha = flashA; c.fillStyle = flashCol; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  }
}

function drawCombo(c, W, H) {
  const L = combo.level, t = combo.t, life = combo.life;
  const k = 1 - t / life;
  // realistic light: shockwave, core flare, anamorphic streak, plasma (GPU)
  const glc = renderFX('combo', { W, H, cx: combo.x, cy: combo.y, t: R.t, k: t, h: L, col: combo.col }, 0.5);
  c.save();
  if (glc) { c.globalCompositeOperation = 'lighter'; c.drawImage(glc, 0, 0, W, H); }
  else {
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(combo.x, combo.y, 0, combo.x, combo.y, 120 + L * 10);
    g.addColorStop(0, rgba('#ffffff', 0.6 * k)); g.addColorStop(0.2, rgba(combo.col, 0.35 * k)); g.addColorStop(1, rgba(combo.col, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  c.restore();
  // high chains: short forked arcs crackling out of the hit, not across the screen
  if (L >= 8 && t < 0.45) {
    if (R.t - boltAt > 0.07) {
      boltAt = R.t;
      comboBolts = [0, 1, 2].map(() => { const a = rand(0, TAU), d = rand(70, 140); return makeBolt(combo.x, combo.y, combo.x + Math.cos(a) * d, combo.y + Math.sin(a) * d, 1); });
    }
    for (const b of comboBolts) drawBolt(c, b, (1 - t / 0.45) * (0.5 + 0.5 * Math.random()), combo.col, 0.6);
  }
  // label: rises off the hit point (above the harpoon, where you've already been)
  const pop = ease.outBack(clamp(t * 5, 0, 1));
  const ty = combo.y - 64 - t * 46;
  const size0 = 34 + Math.min(L, 10) * 1.2;
  c.font = `900 ${size0}px Georgia, serif`;
  const sc = (0.55 + 0.45 * pop) * (1 + Math.min(L, 10) * 0.02);
  const half = (c.measureText(combo.label).width * sc) / 2 + 12;
  const tx = clamp(combo.x, half, W - half);
  c.save();
  c.translate(tx, ty);
  c.scale(sc, sc);
  c.globalAlpha = clamp(k * 1.8, 0, 1);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const size = 34 + Math.min(L, 10) * 1.2;
  c.font = `900 ${size}px Georgia, serif`;
  const grad = c.createLinearGradient(0, -size * 0.85, 0, size * 0.15);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.45, mixLight(combo.col)); grad.addColorStop(1, combo.col);
  c.shadowColor = combo.col; c.shadowBlur = 14 + Math.min(L, 10);
  c.lineWidth = 3; c.strokeStyle = 'rgba(5,8,14,0.9)';
  c.strokeText(combo.label, 0, 0);
  c.fillStyle = grad; c.fillText(combo.label, 0, 0);
  c.shadowBlur = 0;
  c.font = '700 13px system-ui, sans-serif';
  c.lineWidth = 3; c.strokeStyle = 'rgba(5,8,14,0.85)';
  const line2 = combo.sub + (combo.sub2 ? '  ·  ' + combo.sub2 : '');
  c.strokeText(line2, 0, 20); c.fillStyle = '#eafcff'; c.fillText(line2, 0, 20);
  c.restore();
}
function mixLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${(r + 255 * 2) / 3 | 0},${(g + 255 * 2) / 3 | 0},${(b + 255 * 2) / 3 | 0})`;
}
