import { R } from './rt.js';
import { rand, TAU, clamp, ease, hsl, rgba } from './util.js';

const parts = [];
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

export function comboFX(level, sx, sy, label, sub) {
  const repeat = combo.t < 0.4 && combo.life > 0;
  level = Math.min(level, 10);
  combo.level = level; combo.t = 0; combo.life = 1.1 + Math.min(level, 8) * 0.15;
  combo.x = sx; combo.y = sy; combo.label = label; combo.sub = sub;
  shake(Math.min(16, 3 + level * 2));
  flash(level >= 7 ? '#ffffff' : level >= 4 ? '#b9ffef' : '#ffffff', repeat ? 0.08 : Math.min(0.38, 0.1 + level * 0.04));
  stop(Math.min(0.2, 0.03 + level * 0.02));
  const cols = ['#ffffff', '#9fffe0', '#7ff6ff', '#c79bff', '#ffd34d', '#ff4d6d', '#3dffc8', '#ffffff'];
  const col = cols[Math.min(level - 1, cols.length - 1)];
  burst(sx, sy, 14 + level * 10, { scr: true, color: col, speed: 220 + level * 60, size: 2 + level * 0.4, life: 0.9 });
  for (let i = 0; i < Math.min(level, 6); i++) setTimeout(() => ring(sx, sy, col, 80 + i * 40 + level * 15, 0.6, true, 5 - i * 0.5), i * 70);
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
  const k = p.life / p.max;
  const x = p.x - ox, y = p.y - oy;
  if (p.kind === 'ring') {
    const r = p.size * ease.outCubic(1 - k);
    c.strokeStyle = p.color; c.globalAlpha = k; c.lineWidth = p.width * k + 0.5;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    return;
  }
  c.globalAlpha = Math.min(1, k * 1.5);
  c.fillStyle = p.color;
  if (p.kind === 'shard') {
    c.save(); c.translate(x, y); c.rotate(p.rot);
    c.beginPath(); c.moveTo(-p.size, -p.size * 0.6); c.lineTo(p.size, 0); c.lineTo(-p.size * 0.4, p.size * 0.8); c.closePath(); c.fill();
    c.restore();
  } else if (p.kind === 'streak') {
    c.strokeStyle = p.color; c.lineWidth = p.size;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - p.vx * 0.04, y - p.vy * 0.04); c.stroke();
  } else {
    c.beginPath(); c.arc(x, y, p.size * (0.4 + k * 0.6), 0, TAU); c.fill();
  }
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
  const k = 1 - t / life; // fade
  const inK = ease.outBack(clamp(t * 4, 0, 1));
  c.save();
  // L4+: chromatic edge bleed
  if (L >= 4) {
    const a = 0.35 * k;
    const g1 = c.createLinearGradient(0, 0, W * 0.25, 0);
    g1.addColorStop(0, rgba('#ff2050', a)); g1.addColorStop(1, 'rgba(255,0,60,0)');
    c.fillStyle = g1; c.fillRect(0, 0, W * 0.25, H);
    const g2 = c.createLinearGradient(W, 0, W * 0.75, 0);
    g2.addColorStop(0, rgba('#20c8ff', a)); g2.addColorStop(1, 'rgba(0,200,255,0)');
    c.fillStyle = g2; c.fillRect(W * 0.75, 0, W * 0.25, H);
  }
  // L5+: god rays from hit
  if (L >= 5) {
    c.globalCompositeOperation = 'lighter';
    const n = 10 + L * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.6;
      const w = 0.06;
      c.fillStyle = hsl(L >= 8 ? (i * 40 + t * 300) % 360 : 170, 90, 70, 0.12 * k);
      c.beginPath(); c.moveTo(combo.x, combo.y);
      c.arc(combo.x, combo.y, Math.max(W, H) * 1.2, a - w, a + w); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  // L5+: tentacles creeping from screen edges
  if (L >= 5) {
    const reach = ease.outCubic(clamp(t * 2, 0, 1)) * k;
    c.strokeStyle = rgba('#05020a', 0.85 * k); c.lineCap = 'round';
    const n = Math.min(10, L + 1);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : 0;
      const y0 = ((i * 97) % 100) / 100 * H;
      const x0 = side ? W + 10 : -10;
      const len = (60 + ((i * 53) % 60)) * reach * (1 + L * 0.08);
      c.lineWidth = 16 - (i % 3) * 3;
      c.beginPath(); c.moveTo(x0, y0);
      for (let s = 1; s <= 10; s++) {
        const f = s / 10;
        const x = x0 + (side ? -1 : 1) * len * f;
        const y = y0 + Math.sin(f * 6 + t * 5 + i) * 14 * f;
        c.lineWidth = (16 - (i % 3) * 3) * (1 - f * 0.85);
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  // L6+: giant eye opens behind everything
  if (L >= 6) {
    const open = Math.sin(clamp(t / life, 0, 1) * Math.PI);
    const ex = W / 2, ey = H * 0.42, ew = W * 0.42, eh = ew * 0.45 * open;
    c.globalAlpha = 0.55 * k;
    c.fillStyle = '#e8d6b0';
    c.beginPath(); c.ellipse(ex, ey, ew, Math.max(1, eh), 0, 0, TAU); c.fill();
    c.fillStyle = '#c0182f';
    c.beginPath(); c.ellipse(ex, ey, eh * 0.9, Math.max(1, eh * 0.9), 0, 0, TAU); c.fill();
    c.fillStyle = '#000';
    c.beginPath(); c.ellipse(ex, ey, eh * 0.18, Math.max(1, eh * 0.8), 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }
  // L7+: rune circle
  if (L >= 7) {
    c.save(); c.translate(combo.x, combo.y); c.rotate(t * 1.4);
    c.strokeStyle = rgba('#3dffc8', 0.7 * k); c.lineWidth = 2;
    const rr = 90 + L * 8;
    c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, rr * 0.78, 0, TAU); c.stroke();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      c.beginPath(); c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      c.lineTo(Math.cos(a + (3 * TAU) / 7) * rr, Math.sin(a + (3 * TAU) / 7) * rr); c.stroke();
    }
    c.restore();
  }
  // L8+: lightning cracks
  if (L >= 8 && Math.random() < 0.6) {
    c.strokeStyle = rgba('#ffffff', 0.9 * k); c.lineWidth = 2;
    for (let j = 0; j < 3; j++) {
      let x = Math.random() * W, y = 0;
      c.beginPath(); c.moveTo(x, y);
      while (y < H) { x += rand(-30, 30); y += rand(20, 50); c.lineTo(x, y); }
      c.stroke();
    }
  }
  // combo text
  const size = 44 + Math.min(L, 8) * 3;
  c.font = `900 ${size}px Georgia, serif`;
  const fit = Math.min(1, (W * 0.74) / Math.max(1, c.measureText(combo.label).width * (1 + Math.max(0, L - 2) * 0.06)));
  const sc = inK * (1 + Math.max(0, L - 2) * 0.06) * fit;
  const pulse = 1 + Math.sin(t * 20) * 0.025 * Math.min(L, 6);
  c.save();
  c.translate(W / 2, H * 0.27);
  c.scale(sc * pulse, sc * pulse);
  c.rotate(Math.sin(t * 9) * 0.02 * L);
  c.globalAlpha = clamp(k * 2, 0, 1);
  c.textAlign = 'center';
  c.font = `900 ${size}px Georgia, serif`;
  const grad = c.createLinearGradient(0, -size, 0, size * 0.3);
  if (L >= 8) {
    const h = (t * 400) % 360;
    grad.addColorStop(0, hsl(h, 100, 75)); grad.addColorStop(1, hsl(h + 120, 100, 55));
  } else {
    const cols = [['#fff', '#cfe'], ['#fff', '#7ff6ff'], ['#fff', '#7ff6ff'], ['#f6e9ff', '#b45cff'], ['#fff5d6', '#ffb52e'], ['#ffe0e6', '#ff4d6d'], ['#e8fff8', '#3dffc8']];
    const cc = cols[Math.min(L - 2, cols.length - 1)] || cols[0];
    grad.addColorStop(0, cc[0]); grad.addColorStop(1, cc[1]);
  }
  c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.85)';
  c.strokeText(combo.label, 0, 0);
  c.fillStyle = grad; c.fillText(combo.label, 0, 0);
  c.font = `700 ${16 + Math.min(L, 8)}px Georgia, serif`;
  c.lineWidth = 5; c.strokeText(combo.sub, 0, 30 + L * 1.5);
  c.fillStyle = '#e8fff8'; c.fillText(combo.sub, 0, 30 + L * 1.5);
  c.restore();
  c.restore();
}
