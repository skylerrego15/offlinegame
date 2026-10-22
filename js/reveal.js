// 20 gacha reveal animations for hatching eggs
import { R } from './rt.js';
import { RARITIES, EGGS, MUT_BY_ID } from './data.js';
import { IMG, creatureImg } from './assets.js';
import { burst, ring, spark, shake, flash, floatText } from './fx.js';
import { sfxPlay, vibrate } from './audio.js';
import { TAU, clamp, ease, lerp, rand, seg, seeded, rgba, hsl } from './util.js';

export const REVEALS = [
  'Crackle', 'Bubble Burst', 'Ink Bloom', 'Tide Spin', 'Lantern Beam',
  'Sonar Ping', 'Whirlpool', 'Stormcall', 'Coral Bloom', 'Lantern Swarm',
  'The Eye Opens', 'The Grasp', 'Blood Moon', 'Rune Circle', 'The Rift',
  'The Choir', 'The Maw', 'Void Collapse', 'Doom Clock', 'THE AWAKENING',
];
const POOLS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 5], [11, 12, 13], [14, 15, 16], [17, 18, 16], [19, 17]];
const DUR = [1.5, 1.8, 2.3, 2.8, 3.4, 4.0, 4.8, 6.2];

export const RV = { active: false, item: null, anim: 0, t: 0, dur: 1, hatchK: 0.62, fired: new Set(), held: false, onDone: null, seed: 1, hold: 0 };

export function startReveal(item, onDone) {
  const r = item.def.r;
  const pool = POOLS[r];
  RV.anim = pool[Math.floor(Math.random() * pool.length)];
  // occasionally borrow a fancier animation for a tease
  if (r >= 2 && Math.random() < 0.15) RV.anim = POOLS[Math.min(7, r + 1)][0];
  if (r === 0 && Math.random() < 0.08) RV.anim = 3;
  RV.active = true; RV.item = item; RV.t = 0; RV.held = false; RV.hold = 0;
  RV.dur = DUR[r] * (RV.anim >= 17 ? 1.15 : 1);
  RV.hatchK = RV.anim === 19 ? 0.72 : RV.anim === 17 ? 0.68 : 0.62;
  RV.fired = new Set(); RV.onDone = onDone; RV.seed = Math.floor(Math.random() * 1e9);
  if (r >= 2) sfxPlay('riser', RV.dur * RV.hatchK);
}

export function skipReveal() {
  if (!RV.active || RV.held) return;
  if (RV.t / RV.dur < RV.hatchK) fire('hatch', hatchMoment);
  RV.t = RV.dur;
}

function fire(key, fn) {
  if (RV.fired.has(key)) return;
  RV.fired.add(key);
  fn();
}

function hatchMoment() {
  const r = RV.item.def.r;
  const col = RARITIES[r].color;
  const cx = R.W / 2, cy = R.H * 0.4;
  sfxPlay('reveal', r);
  shake(4 + r * 2.5);
  flash(r >= 6 ? '#ffffff' : col, 0.35 + r * 0.06);
  vibrate(30 + r * 15);
  burst(cx, cy, 30 + r * 14, { scr: true, color: EGGS[RV.item.tier - 1].color, kind: 'shard', speed: 380 + r * 40, size: 4 + r * 0.6, life: 1.2, grav: 300, drag: 1.2 });
  burst(cx, cy, 20 + r * 12, { scr: true, color: col, speed: 300 + r * 50, size: 2.5, life: 1.0 });
  ring(cx, cy, col, 180 + r * 40, 0.8, true, 6);
  if (r >= 4) setTimeout(() => ring(cx, cy, '#ffffff', 260 + r * 30, 0.9, true, 3), 120);
  if (RV.item.inst.mut) {
    const m = MUT_BY_ID[RV.item.inst.mut];
    setTimeout(() => { burst(cx, cy, 50, { scr: true, color: m.color, speed: 260, life: 1.4 }); ring(cx, cy, m.color, 220, 1, true, 4); sfxPlay('combo', 5); }, 260);
  }
}

// ---------------------------------------------------------------------------
// shared drawing helpers
// ---------------------------------------------------------------------------
function climbColor(k) {
  const r = RV.item.def.r;
  const step = Math.min(r, Math.floor(clamp(k, 0, 0.999) * (r + 1)));
  return RARITIES[step].color;
}

function drawEggAt(c, x, y, size, opt = {}) {
  const im = IMG.eggs[RV.item.tier];
  if (!im) return;
  const sh = opt.shake || 0;
  const rot = (opt.rot || 0) + Math.sin(R.t * 40) * sh * 0.04;
  const sx = x + Math.sin(R.t * 53) * sh, sy = y + Math.cos(R.t * 47) * sh * 0.6;
  const sc = opt.scale ?? 1;
  const h = size * sc, w = (h * im.naturalWidth) / im.naturalHeight;
  if (opt.glow) {
    const g = c.createRadialGradient(sx, sy, h * 0.2, sx, sy, h * (0.9 + opt.glowR || 0.9));
    g.addColorStop(0, rgba(opt.glow, 0.6 * (opt.glowA ?? 1))); g.addColorStop(1, rgba(opt.glow, 0));
    c.fillStyle = g; c.beginPath(); c.arc(sx, sy, h * 1.5, 0, TAU); c.fill();
  }
  c.save(); c.translate(sx, sy); c.rotate(rot); c.globalAlpha = opt.alpha ?? 1;
  c.drawImage(im, -w / 2, -h / 2, w, h);
  const cr = opt.crack || 0;
  if (cr > 0) {
    const rnd = seeded(RV.seed);
    c.strokeStyle = opt.crackCol || '#fff8e0'; c.lineWidth = 2; c.shadowColor = opt.crackCol || '#fff'; c.shadowBlur = 8;
    const n = Math.ceil(cr * 7);
    for (let i = 0; i < n; i++) {
      let px = (rnd() - 0.5) * w * 0.3, py = (rnd() - 0.5) * h * 0.3;
      c.beginPath(); c.moveTo(px, py);
      const a = rnd() * TAU;
      const len = (0.25 + rnd() * 0.25) * h * Math.min(1, cr * 1.5);
      for (let s = 0; s < 4; s++) { px += Math.cos(a + (rnd() - 0.5) * 1.6) * len / 4; py += Math.sin(a + (rnd() - 0.5) * 1.6) * len / 4; c.lineTo(px, py); }
      c.stroke();
    }
    c.shadowBlur = 0;
  }
  c.restore();
  c.globalAlpha = 1;
}

function rays(c, x, y, col, a, n = 14, spin = 0.3, w = 0.08) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + R.t * spin;
    c.fillStyle = rgba(col, a);
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, Math.max(R.W, R.H), ang - w, ang + w); c.closePath(); c.fill();
  }
  c.restore();
}

function aura(c, x, y, rad, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
}

export function drawCreatureCard(c, k) {
  // creature presentation after hatching
  const it = RV.item, r = it.def.r, col = RARITIES[r].color;
  const im = creatureImg(it.def.id, it.inst.mut);
  const cx = R.W / 2, cy = R.H * 0.38;
  const app = ease.outBack(clamp(k, 0, 1));
  if (r >= 2) rays(c, cx, cy, col, 0.06 + r * 0.01, 10 + r * 2, 0.25 + r * 0.04, 0.05 + r * 0.004);
  if (r >= 7) rays(c, cx, cy, '#ffffff', 0.05, 7, -0.4, 0.03);
  aura(c, cx, cy, R.W * (0.45 + r * 0.03), col, 0.35 + r * 0.04);
  if (it.inst.mut) {
    const m = MUT_BY_ID[it.inst.mut];
    aura(c, cx, cy, R.W * 0.4, it.inst.mut === 'iridescent' ? hsl((R.t * 120) % 360, 90, 65) : m.color, 0.3);
    if (Math.random() < 0.4) spark(cx + rand(-1, 1) * R.W * 0.35, cy + rand(-1, 1) * 70, { scr: true, color: m.color, speed: 30, life: 1, size: 2 });
  }
  if (!im) return;
  const maxW = R.W * 0.86, maxH = R.H * 0.26;
  let w = maxW, h = (w * im.height) / im.width;
  if (h > maxH) { h = maxH; w = (h * im.width) / im.height; }
  const s = (0.3 + 0.7 * app) * (1 + Math.sin(R.t * 2) * 0.015);
  c.save(); c.translate(cx, cy + Math.sin(R.t * 1.5) * 5); c.scale(s, s);
  c.drawImage(im, -w / 2, -h / 2, w, h);
  c.restore();
  // ambient sparkle
  if (Math.random() < 0.25 + r * 0.05) spark(cx + rand(-1, 1) * w * 0.5, cy + rand(-1, 1) * h * 0.5, { scr: true, color: RARITIES[r].glow, speed: 20, life: 0.8, size: 1.8 });
}

// ---------------------------------------------------------------------------
// The 20 animations. Each draws the pre-hatch build-up for k in [0, hatchK].
// ---------------------------------------------------------------------------
const A = [];
const E = () => R.W * 0.3; // egg draw height

// 0 Crackle
A[0] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  if (Math.floor(k * 12) !== Math.floor((k - 0.016) * 12)) sfxPlay('crack');
  drawEggAt(c, cx, cy, E(), { shake: w * 6, crack: w, glow: climbColor(w) });
};
// 1 Bubble Burst
A[1] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  if (Math.random() < 0.5) spark(cx + rand(-60, 60), cy + 80, { scr: true, vx: rand(-10, 10), vy: rand(-160, -60), color: '#bff', size: rand(2, 5), life: 1, drag: 0.5, glow: false });
  drawEggAt(c, cx, cy, E(), { scale: 1 + ease.inCubic(w) * 0.35, shake: w * 3, glow: climbColor(w), crack: w > 0.7 ? (w - 0.7) * 3 : 0 });
  c.strokeStyle = 'rgba(200,255,255,0.6)'; c.lineWidth = 2;
  c.beginPath(); c.arc(cx, cy, E() * (0.75 + w * 0.3), 0, TAU); c.stroke();
};
// 2 Ink Bloom
A[2] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  drawEggAt(c, cx, cy, E(), { shake: w * 4, glow: climbColor(w), crack: w });
  const rnd = seeded(RV.seed);
  c.fillStyle = `rgba(5,3,10,${0.85 * ease.outCubic(w)})`;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, d = rnd() * 60 * w;
    c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (20 + rnd() * 60) * ease.outCubic(w), 0, TAU); c.fill();
  }
};
// 3 Tide Spin
A[3] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  const rot = ease.inCubic(w) * TAU * 6;
  drawEggAt(c, cx, cy, E(), { rot, scale: 1 - w * 0.25, glow: climbColor(w), glowA: 0.5 + w });
  c.strokeStyle = rgba(climbColor(w), 0.5); c.lineWidth = 3;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx, cy, E() * (0.7 + i * 0.15), rot + i, rot + i + 1.2 + w * 2); c.stroke(); }
};
// 4 Lantern Beam
A[4] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.fillStyle = `rgba(0,0,0,${0.6 * w})`; c.fillRect(0, 0, R.W, R.H);
  const sweep = Math.sin(w * Math.PI * 1.5) * (1 - w) * 120;
  const g = c.createLinearGradient(0, 0, 0, cy + 80);
  g.addColorStop(0, rgba('#ffe7b0', 0.0)); g.addColorStop(1, rgba('#ffe7b0', 0.35));
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g;
  c.beginPath(); c.moveTo(cx - 10, -10); c.lineTo(cx + 10, -10); c.lineTo(cx + sweep + 90, cy + 90); c.lineTo(cx + sweep - 90, cy + 90); c.fill(); c.restore();
  drawEggAt(c, cx, cy, E(), { shake: w * 4, glow: climbColor(w), glowA: w, crack: seg(w, 0.5, 1) });
};
// 5 Sonar Ping
A[5] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  for (let i = 0; i < 3; i++) {
    const ti = i / 3;
    fireAt(w, ti + 0.02, 'ping' + i, () => { ring(cx, cy, climbColor(ti + 0.3), 260, 0.9, true, 3); sfxPlay('hit', 3 + i * 3); });
  }
  const pulse = Math.pow(Math.sin(w * Math.PI * 6), 8);
  drawEggAt(c, cx, cy, E(), { scale: 1 + pulse * 0.08, glow: climbColor(w), glowA: 0.4 + pulse, crack: seg(w, 0.6, 1) });
};
// 6 Whirlpool
A[6] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let j = 0; j < 5; j++) {
    c.strokeStyle = rgba(climbColor(w), 0.25); c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < 60; i++) {
      const f = i / 60;
      const a = f * TAU * 2 + j * (TAU / 5) - R.t * (3 + w * 8);
      const rr = (1 - f) * 220 * (1 - w * 0.5) + 30;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6);
    }
    c.stroke();
  }
  c.restore();
  drawEggAt(c, cx, cy, E(), { rot: w * w * 20, scale: 1 - ease.inCubic(w) * 0.6, glow: climbColor(w) });
};
// 7 Stormcall
A[7] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.fillStyle = `rgba(0,0,10,${0.5 * w})`; c.fillRect(0, 0, R.W, R.H);
  [0.3, 0.6, 0.9].forEach((at, i) => fireAt(w, at, 'bolt' + i, () => { flash('#e0f0ff', 0.5); shake(6); sfxPlay('snap'); RV['bolt'] = R.t; }));
  if (RV.bolt && R.t - RV.bolt < 0.15) {
    c.strokeStyle = '#eef8ff'; c.lineWidth = 3; c.shadowColor = '#9cf'; c.shadowBlur = 20;
    let x = cx + rand(-40, 40), y = 0; c.beginPath(); c.moveTo(x, y);
    while (y < cy) { x += rand(-25, 25); y += rand(20, 40); c.lineTo(x + (cx - x) * (y / cy) * 0.3, y); }
    c.stroke(); c.shadowBlur = 0;
  }
  drawEggAt(c, cx, cy, E(), { shake: w * 5, glow: climbColor(w), crack: w });
};
// 8 Coral Bloom
A[8] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  drawEggAt(c, cx, cy, E(), { glow: climbColor(w), crack: seg(w, 0.6, 1), shake: w * 3 });
  const rnd = seeded(RV.seed);
  c.strokeStyle = rgba('#ff6f91', 0.85); c.lineCap = 'round';
  const branch = (x, y, a, len, depth) => {
    if (depth > 5 || len < 4) return;
    const g = clamp(w * 6 - depth, 0, 1);
    if (g <= 0) return;
    const x2 = x + Math.cos(a) * len * g, y2 = y + Math.sin(a) * len * g;
    c.lineWidth = 7 - depth;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
    branch(x2, y2, a - 0.4 - rnd() * 0.3, len * 0.75, depth + 1);
    branch(x2, y2, a + 0.4 + rnd() * 0.3, len * 0.75, depth + 1);
  };
  for (let i = 0; i < 5; i++) branch(cx + (i - 2) * 50, cy + 140, -Math.PI / 2 + (i - 2) * 0.25, 55, 0);
};
// 9 Lantern Swarm
A[9] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.save(); c.globalCompositeOperation = 'lighter';
  const rnd = seeded(RV.seed);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU + R.t * (1 + rnd()) * (rnd() < 0.5 ? 1 : -1);
    const d = (1 - ease.inCubic(w)) * (120 + rnd() * 140) + 10;
    aura(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 10, i % 3 ? '#9fffd0' : climbColor(w), 0.8);
  }
  c.restore();
  drawEggAt(c, cx, cy, E(), { glow: climbColor(w), glowA: 0.3 + w, shake: w * 3, crack: seg(w, 0.5, 1) });
};
// 10 The Eye Opens
A[10] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  const open = ease.outCubic(seg(w, 0.05, 0.6)) * (w > 0.9 ? 1 - (w - 0.9) * 10 : 1);
  const ew = R.W * 0.48, eh = ew * 0.48 * open;
  c.fillStyle = '#e9dcc0'; c.beginPath(); c.ellipse(cx, cy, ew, Math.max(0.5, eh), 0, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.ellipse(cx, cy, ew, Math.max(0.5, eh), 0, 0, TAU); c.clip();
  c.strokeStyle = 'rgba(180,30,40,0.5)'; c.lineWidth = 1;
  for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(cx + (i % 2 ? 1 : -1) * ew, cy + (i - 6) * 6); c.quadraticCurveTo(cx, cy + (i - 6) * 10, cx + (i % 2 ? 0.4 : -0.4) * ew, cy); c.stroke(); }
  const px = cx + Math.sin(R.t * 1.7) * 30 * (1 - w);
  c.fillStyle = climbColor(w); c.beginPath(); c.arc(px, cy, ew * 0.38, 0, TAU); c.fill();
  c.fillStyle = '#000'; c.beginPath(); c.ellipse(px, cy, ew * (0.09 - w * 0.06), ew * 0.32, 0, 0, TAU); c.fill();
  c.restore();
  if (w > 0.3) fire('hb1', () => sfxPlay('heartbeat'));
  if (w > 0.7) fire('hb2', () => sfxPlay('heartbeat'));
  drawEggAt(c, cx, cy, E() * 0.6, { glow: climbColor(w), shake: w * 4, crack: seg(w, 0.6, 1) });
};
// 11 The Grasp
A[11] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  drawEggAt(c, cx, cy, E(), { glow: climbColor(w), shake: seg(w, 0.6, 1) * 8, crack: seg(w, 0.6, 1), scale: 1 - seg(w, 0.7, 1) * 0.1 });
  const reach = ease.outCubic(seg(w, 0, 0.7));
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const x0 = cx + side * (R.W * 0.6), y0 = cy + 140 + (i >> 1) * 40;
    const tx = cx + side * 20, ty = cy - 30 + (i >> 1) * 30;
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? '#6b2a4a' : '#12050c';
      c.beginPath(); c.moveTo(x0, y0);
      for (let s = 1; s <= 14; s++) {
        const f = (s / 14) * reach;
        c.lineWidth = (pass ? 10 : 15) * (1 - f * 0.8);
        c.lineTo(lerp(x0, tx, f) + Math.sin(f * 8 + R.t * 4 + i) * 16 * (1 - f), lerp(y0, ty, f) - Math.sin(f * Math.PI) * 60);
      }
      c.stroke();
    }
  }
  if (w > 0.75 && Math.random() < 0.4) sfxPlay('crack');
};
// 12 Blood Moon
A[12] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.fillStyle = `rgba(60,0,8,${0.55 * w})`; c.fillRect(0, 0, R.W, R.H);
  const my = lerp(R.H * 0.9, cy - 20, ease.outCubic(seg(w, 0, 0.7)));
  aura(c, cx, my, 200, '#ff1f3d', 0.45);
  c.fillStyle = '#a3101e'; c.beginPath(); c.arc(cx, my, 110, 0, TAU); c.fill();
  c.fillStyle = 'rgba(60,0,0,0.5)'; c.beginPath(); c.arc(cx + 30, my - 20, 25, 0, TAU); c.arc(cx - 40, my + 30, 18, 0, TAU); c.fill();
  c.fillStyle = '#7a0010';
  const rnd = seeded(RV.seed);
  for (let i = 0; i < 12; i++) { const x = rnd() * R.W, len = (40 + rnd() * 160) * w; c.fillRect(x, 0, 5, len); c.beginPath(); c.arc(x + 2.5, len, 5, 0, TAU); c.fill(); }
  drawEggAt(c, cx, cy, E(), { glow: climbColor(w), shake: w * 5, crack: w, crackCol: '#ff2b4a' });
};
// 13 Rune Circle
A[13] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  const col = climbColor(w);
  c.save(); c.translate(cx, cy); c.scale(1, 0.55);
  c.strokeStyle = rgba(col, 0.85); c.lineWidth = 3; c.shadowColor = col; c.shadowBlur = 14;
  const draw = ease.outCubic(seg(w, 0, 0.6));
  c.beginPath(); c.arc(0, 0, 160, -Math.PI / 2, -Math.PI / 2 + TAU * draw); c.stroke();
  c.rotate(R.t * 0.8);
  c.beginPath(); c.arc(0, 0, 125, 0, TAU * draw); c.stroke();
  for (let i = 0; i < 9; i++) {
    if (i / 9 > draw) break;
    const a = (i / 9) * TAU;
    c.save(); c.rotate(a); c.translate(142, 0);
    c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, 0); c.lineTo(-6, 8); c.moveTo(0, -10); c.lineTo(0, 10); c.stroke();
    c.restore();
  }
  c.restore(); c.shadowBlur = 0;
  if (w > 0.6) {
    const bw = 30 + seg(w, 0.6, 1) * 80;
    const g = c.createLinearGradient(cx - bw, 0, cx + bw, 0);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba('#ffffff', 0.5)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(cx - bw, 0, bw * 2, cy + 40);
  }
  drawEggAt(c, cx, cy - seg(w, 0.4, 1) * 30, E(), { glow: col, shake: w * 3, crack: seg(w, 0.5, 1) });
};
// 14 The Rift
A[14] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  const open = ease.inOut(seg(w, 0.1, 1));
  const rnd = seeded(RV.seed);
  const pts = [];
  for (let i = 0; i <= 14; i++) pts.push([(rnd() - 0.5) * 18, (i / 14) * R.H * 0.7 - R.H * 0.35]);
  const wid = 4 + open * 70;
  c.fillStyle = '#000';
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(cx + x - wid * Math.sin((i / 14) * Math.PI), cy + y) : c.moveTo(cx + x, cy + y)));
  for (let i = pts.length - 1; i >= 0; i--) c.lineTo(cx + pts[i][0] + wid * Math.sin((i / 14) * Math.PI), cy + pts[i][1]);
  c.fill();
  c.strokeStyle = climbColor(w); c.lineWidth = 3; c.shadowColor = climbColor(w); c.shadowBlur = 20; c.stroke(); c.shadowBlur = 0;
  // stars in rift
  c.fillStyle = '#fff';
  for (let i = 0; i < 20; i++) { const y = cy + (rnd() - 0.5) * R.H * 0.6; c.fillRect(cx + (rnd() - 0.5) * wid, y, 1.5, 1.5); }
  drawEggAt(c, cx + (1 - w) * 60, cy + (1 - w) * 80, E(), { scale: 1 - open * 0.7, glow: climbColor(w), rot: w * 3, alpha: 1 - seg(w, 0.85, 1) });
};
// 15 The Choir
A[15] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x0 = (i + 0.5) * (R.W / 7);
    const x = lerp(x0, cx, ease.inCubic(w));
    const drop = ease.outCubic(seg(w, i * 0.05, 0.4 + i * 0.05));
    const g = c.createLinearGradient(0, 0, 0, R.H * drop);
    g.addColorStop(0, rgba('#ffffff', 0.0)); g.addColorStop(1, rgba(climbColor(w), 0.4));
    c.fillStyle = g; c.fillRect(x - 12, 0, 24, R.H * drop * 0.9);
  }
  for (let i = 0; i < 3; i++) { c.strokeStyle = rgba('#fff', 0.3 * (1 - ((R.t * 0.8 + i / 3) % 1))); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, ((R.t * 0.8 + i / 3) % 1) * 200, 0, TAU); c.stroke(); }
  c.restore();
  fire('whisper', () => sfxPlay('whisper'));
  drawEggAt(c, cx, cy - Math.sin(w * Math.PI) * 30, E(), { glow: climbColor(w), glowA: 0.5 + w, crack: seg(w, 0.6, 1) });
};
// 16 The Maw
A[16] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  drawEggAt(c, cx, cy, E(), { glow: climbColor(w), shake: w * 6, crack: w });
  const close = ease.inCubic(seg(w, 0, 0.92));
  const gap = lerp(R.H * 0.55, 0, close);
  const drawJaw = (y, dir) => {
    c.fillStyle = '#2a0a12'; c.fillRect(0, dir < 0 ? 0 : y, R.W, dir < 0 ? y : R.H - y);
    c.fillStyle = '#efe4cc';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const tx = (i + 0.5) * (R.W / n), tl = 30 + ((i * 37) % 3) * 14;
      c.beginPath(); c.moveTo(tx - 16, y); c.lineTo(tx, y - dir * tl); c.lineTo(tx + 16, y); c.fill();
    }
  };
  drawJaw(cy - gap / 2, -1);
  drawJaw(cy + gap / 2, 1);
  fire('gr', () => sfxPlay('growl'));
};
// 17 Void Collapse
A[17] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.fillStyle = `rgba(0,0,0,${Math.min(0.97, w * 1.6)})`; c.fillRect(0, 0, R.W, R.H);
  const rnd = seeded(RV.seed);
  c.fillStyle = '#fff';
  for (let i = 0; i < 120; i++) {
    const a = rnd() * TAU, d0 = rnd() * R.H * 0.7;
    const d = d0 * (1 - ease.inCubic(w) * 0.9);
    c.globalAlpha = rnd() * w;
    c.fillRect(cx + Math.cos(a + w * 3) * d, cy + Math.sin(a + w * 3) * d, 1.5, 1.5);
  }
  c.globalAlpha = 1;
  // accretion ring
  c.save(); c.translate(cx, cy); c.scale(1, 0.3); c.rotate(R.t);
  c.strokeStyle = rgba(climbColor(w), 0.8); c.lineWidth = 10 * w; c.shadowColor = climbColor(w); c.shadowBlur = 30;
  c.beginPath(); c.arc(0, 0, 60 + 40 * (1 - w), 0, TAU); c.stroke(); c.restore(); c.shadowBlur = 0;
  drawEggAt(c, cx, cy, E(), { scale: Math.max(0.02, 1 - ease.inCubic(w)), glow: '#ffffff', glowA: w, rot: w * 10 });
  if (w > 0.4) fire('vh', () => sfxPlay('heartbeat'));
};
// 18 Doom Clock
A[18] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  const col = climbColor(w);
  c.save(); c.translate(cx, cy);
  for (let g = 0; g < 3; g++) {
    c.save(); c.rotate(R.t * (g % 2 ? -1 : 1) * (0.5 + g * 0.3) * (1 + w * 4));
    c.strokeStyle = rgba(col, 0.5); c.lineWidth = 3;
    const rr = 90 + g * 45;
    c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke();
    for (let i = 0; i < 12 + g * 6; i++) { const a = (i / (12 + g * 6)) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); c.lineTo(Math.cos(a) * (rr + 10), Math.sin(a) * (rr + 10)); c.stroke(); }
    c.restore();
  }
  // hands
  c.strokeStyle = '#efe4cc'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(w * TAU * 3 - Math.PI / 2) * 120, Math.sin(w * TAU * 3 - Math.PI / 2) * 120); c.stroke();
  c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(w * TAU - Math.PI / 2) * 70, Math.sin(w * TAU - Math.PI / 2) * 70); c.stroke();
  c.restore();
  const n = 3 - Math.floor(w * 3);
  if (n > 0) {
    fire('n' + n, () => { sfxPlay('heartbeat'); ring(cx, cy, col, 200, 0.5, true, 4); });
    c.font = '900 64px Georgia'; c.textAlign = 'center';
    c.fillStyle = rgba(col, 0.9); c.fillText(String(n), cx, cy - 150);
  }
  drawEggAt(c, cx, cy, E() * 0.75, { glow: col, crack: seg(w, 0.66, 1), shake: seg(w, 0.66, 1) * 6 });
};
// 19 THE AWAKENING
A[19] = (c, k, cx, cy) => {
  const w = seg(k, 0, 1);
  c.fillStyle = `rgba(0,0,0,${0.8 * w})`; c.fillRect(0, 0, R.W, R.H);
  const rnd = seeded(RV.seed);
  // eyes open around the screen
  for (let i = 0; i < 14; i++) {
    const ex = rnd() * R.W, ey = rnd() * R.H, es = 12 + rnd() * 26;
    const o = ease.outCubic(seg(w, i * 0.04, i * 0.04 + 0.2));
    if (o <= 0) continue;
    c.fillStyle = '#e9dcc0'; c.beginPath(); c.ellipse(ex, ey, es, es * 0.45 * o, 0, 0, TAU); c.fill();
    c.fillStyle = climbColor(w); c.beginPath(); c.arc(ex + (cx - ex) * 0.02, ey, es * 0.35 * o, 0, TAU); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(ex + (cx - ex) * 0.03, ey, 2, es * 0.3 * o, 0, 0, TAU); c.fill();
    fire('eye' + i, () => sfxPlay('crack'));
  }
  // glass cracks across the screen
  const cr = seg(w, 0.5, 1);
  if (cr > 0) {
    c.strokeStyle = rgba('#ffffff', 0.8); c.lineWidth = 1.5;
    for (let i = 0; i < 10 * cr; i++) {
      let x = cx, y = cy; const a = (i / 10) * TAU + rnd();
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += Math.cos(a + (rnd() - 0.5)) * 45; y += Math.sin(a + (rnd() - 0.5)) * 45; c.lineTo(x, y); }
      c.stroke();
    }
  }
  // chromatic split egg
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
  drawEggAt(c, cx - w * 8, cy, E(), { alpha: 0.5, shake: w * 8 });
  drawEggAt(c, cx + w * 8, cy, E(), { alpha: 0.5, shake: w * 8 });
  c.restore();
  drawEggAt(c, cx, cy, E(), { glow: hsl((R.t * 200) % 360, 100, 65), glowA: w, shake: w * 9, crack: w });
  if (w > 0.2) fire('a1', () => sfxPlay('tentacle'));
  if (w > 0.55) fire('a2', () => { sfxPlay('whisper'); shake(8); });
};

function fireAt(w, at, key, fn) { if (w >= at) fire(key, fn); }

// ---------------------------------------------------------------------------
export function drawReveal(c, dt) {
  if (!RV.active) return;
  RV.t += dt;
  const k = clamp(RV.t / RV.dur, 0, 1);
  const cx = R.W / 2, cy = R.H * 0.4;
  // dim backdrop
  c.fillStyle = 'rgba(2,3,8,0.78)'; c.fillRect(0, 0, R.W, R.H);
  // label of the reveal style
  const hk = RV.hatchK;
  if (k < hk) {
    A[RV.anim](c, k / hk, cx, cy);
    c.font = '600 13px Georgia'; c.textAlign = 'center'; c.fillStyle = 'rgba(230,220,200,0.5)';
    c.fillText(EGGS[RV.item.tier - 1].name.toUpperCase() + ' · ' + REVEALS[RV.anim].toUpperCase(), cx, R.H * 0.74);
    c.fillText('tap to skip', cx, R.H * 0.92);
  } else {
    fire('hatch', hatchMoment);
    drawCreatureCard(c, (k - hk) / (1 - hk) * 2.2);
  }
  if (k >= 1 && !RV.held) {
    RV.held = true;
    const r = RV.item.def.r;
    floatText(cx, R.H * 0.2, RARITIES[r].name.toUpperCase() + '!', RARITIES[r].color, 30 + r * 3, true, 1.6);
    RV.onDone && RV.onDone();
  }
}

export function endReveal() { RV.active = false; RV.item = null; }
