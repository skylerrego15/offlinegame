// Gacha reveal animations for hatching eggs. Shader-driven ones render through gl.js.
import { R } from './rt.js';
import { RARITIES, EGGS, MUT_BY_ID } from './data.js';
import { IMG, creatureImg } from './assets.js';
import { shake, flash, floatText, clearFx } from './fx.js';
import { renderFX, glOk } from './gl.js';
import { makeBolt, drawBolt } from './bolt.js';
import { sfxPlay, vibrate } from './audio.js';
import { TAU, clamp, ease, lerp, rand, seg, seeded, rgba, hsl } from './util.js';

export const REVEALS = [
  'Crackle', 'Bubble Burst', null, 'Tide Spin', 'Lantern Beam',
  'Sonar Ping', 'Whirlpool', null, null, 'Lantern Swarm',
  null, 'The Grasp', 'Blood Moon', 'Rune Circle', 'The Rift',
  'The Choir', null, 'Void Collapse', 'Doom Clock', null,
  'Black Tide', 'Thunderhead', 'Caustic Bloom', 'Hydrothermal Eruption', 'Bioluminescent Swarm',
  'Event Horizon', "Leviathan's Gaze", 'From Below', 'Abyssal Aurora', 'Shattered Reality',
];
const POOLS = [[0, 1, 22], [3, 4, 5, 24], [6, 9, 20, 21], [11, 12, 23, 28], [13, 26, 27, 21], [14, 15, 26, 27], [17, 18, 25], [29, 25]];
// shader backdrop per animation: [effect, resolution scale]
const SHADER = { 20: ['blacktide', 0.55], 21: ['thunder', 0.5], 22: ['caustic', 0.55], 23: ['vent', 0.5], 24: ['biolum', 0.5], 25: ['horizon', 0.7], 26: ['gaze', 0.75], 27: ['deep', 0.5], 28: ['aurora', 0.55], 29: ['shatter', 0.6] };
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
  RV.dur = DUR[r] * (RV.anim === 17 || RV.anim === 18 || RV.anim >= 25 ? 1.15 : 1);
  RV.hatchK = RV.anim === 29 ? 0.7 : RV.anim === 17 || RV.anim === 25 ? 0.68 : 0.62;
  clearFx();
  RV.hT = 0; RV.flash = 0; RV.flashX = 0.5; RV.bolts = []; RV.plank = null;
  LP.length = 0; FR.length = 0;
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
  shake(4 + r * 2.2);
  flash(r >= 6 ? '#ffffff' : col, 0.12 + r * 0.03);
  vibrate(30 + r * 15);
  shellBreak(cx, cy, E(), 8 + r);
  bloom(cx, cy, R.W * (0.7 + r * 0.06), col, 0.7);
  ring(cx, cy, col, R.W * (0.55 + r * 0.06), 0.9);
  if (r >= 4) setTimeout(() => ring(cx, cy, '#ffffff', R.W * (0.7 + r * 0.05), 1.0), 110);
  burst(cx, cy, 16 + r * 10, { color: RARITIES[r].glow, speed: 260 + r * 40, size: 2.2, life: 1.1 });
  if (RV.item.inst.mut) {
    const m = MUT_BY_ID[RV.item.inst.mut];
    setTimeout(() => { burst(cx, cy, 40, { color: m.color, speed: 240, life: 1.4 }); ring(cx, cy, m.color, R.W * 0.6, 1.1); sfxPlay('combo', 5); }, 260);
  }
}

// ---------------------------------------------------------------------------
// local particle layer: drawn BEHIND the hatched creature, never on top of it
// ---------------------------------------------------------------------------
const LP = [];
const FR = [];
const glowCache = {};
function glowSprite(col) {
  if (glowCache[col]) return glowCache[col];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, rgba(col, 0.95));
  gr.addColorStop(0.4, rgba(col, 0.35));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (glowCache[col] = cv);
}
let bubbleSpr = null;
function bubbleSprite() {
  if (bubbleSpr) return bubbleSpr;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 18, 32, 32, 31);
  gr.addColorStop(0, 'rgba(180,240,255,0.04)'); gr.addColorStop(0.75, 'rgba(190,245,255,0.18)'); gr.addColorStop(0.95, 'rgba(230,255,255,0.75)'); gr.addColorStop(1, 'rgba(230,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill();
  const sp = g.createRadialGradient(22, 21, 0, 22, 21, 9);
  sp.addColorStop(0, 'rgba(255,255,255,0.95)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sp; g.beginPath(); g.arc(22, 21, 9, 0, TAU); g.fill();
  return (bubbleSpr = cv);
}
function spark(x, y, o = {}) {
  if (LP.length > 900) LP.shift();
  const life = o.life ?? rand(0.4, 0.9);
  LP.push({
    x, y, vx: o.vx ?? rand(-1, 1) * (o.speed ?? 120), vy: o.vy ?? rand(-1, 1) * (o.speed ?? 120),
    life, max: life, size: o.size ?? rand(1.5, 3.5), color: o.color ?? '#fff',
    grav: o.grav ?? 0, drag: o.drag ?? 2.2, kind: o.kind || 'dot',
  });
}
function burst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(0.3, 1) * (o.speed ?? 200);
    spark(x, y, Object.assign({}, o, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }));
  }
}
function ring(x, y, color, maxR = 120, life = 0.8) {
  LP.push({ x, y, vx: 0, vy: 0, life, max: life, size: maxR, color, grav: 0, drag: 0, kind: 'ring' });
}
function bloom(x, y, rad, color, life = 0.6) {
  LP.push({ x, y, vx: 0, vy: 0, life, max: life, size: rad, color, grav: 0, drag: 0, kind: 'bloom' });
}
// break the real egg image into textured shell fragments
function shellBreak(cx, cy, size, n) {
  const im = IMG.eggs[RV.item.tier];
  if (!im) return;
  const h = size, w = (h * im.naturalWidth) / im.naturalHeight;
  const angs = [];
  for (let i = 0; i < n; i++) angs.push((i / n) * TAU + rand(-0.25, 0.25) * (TAU / n));
  angs.sort((a, b) => a - b);
  for (let i = 0; i < n; i++) {
    const a0 = angs[i], a1 = i + 1 < n ? angs[i + 1] : angs[0] + TAU;
    const inner = [rand(-0.08, 0.08) * w, rand(-0.08, 0.08) * h];
    const poly = [inner];
    for (let s = 0; s <= 3; s++) {
      const a = a0 + ((a1 - a0) * s) / 3;
      const jag = s === 0 || s === 3 ? 0.55 + Math.random() * 0.2 : 1.15;
      poly.push([Math.cos(a) * w * 0.5 * jag, Math.sin(a) * h * 0.5 * jag]);
    }
    const mid = (a0 + a1) / 2, sp = rand(260, 520);
    FR.push({ poly, im, w, h, x: cx, y: cy, vx: Math.cos(mid) * sp, vy: Math.sin(mid) * sp - 140, rot: 0, vr: rand(-7, 7), life: 1.3, max: 1.3 });
  }
}
function updLocal(dt) {
  for (let i = LP.length - 1; i >= 0; i--) {
    const p = LP[i];
    p.life -= dt;
    if (p.life <= 0) { LP.splice(i, 1); continue; }
    p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt);
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = FR.length - 1; i >= 0; i--) {
    const f = FR[i];
    f.life -= dt;
    if (f.life <= 0) { FR.splice(i, 1); continue; }
    f.vy += 900 * dt; f.vx *= Math.exp(-0.6 * dt);
    f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
  }
}
function drawLocal(c) {
  // shell fragments
  for (const f of FR) {
    const k = f.life / f.max;
    c.save(); c.globalAlpha = Math.min(1, k * 2.5);
    c.translate(f.x, f.y); c.rotate(f.rot);
    c.beginPath(); f.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    c.save(); c.clip(); c.drawImage(f.im, -f.w / 2, -f.h / 2, f.w, f.h); c.restore();
    c.strokeStyle = 'rgba(255,250,235,0.35)'; c.lineWidth = 1.2; c.stroke();
    c.restore();
  }
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const p of LP) {
    const k = p.life / p.max;
    if (p.kind === 'ring') {
      const r = p.size * ease.outCubic(1 - k), bw = Math.max(10, r * 0.16);
      if (r < 2) continue;
      const g = c.createRadialGradient(p.x, p.y, Math.max(0, r - bw), p.x, p.y, r + bw);
      g.addColorStop(0, rgba(p.color, 0)); g.addColorStop(0.5, rgba(p.color, 0.38 * k)); g.addColorStop(1, rgba(p.color, 0));
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r + bw, 0, TAU); c.fill();
    } else if (p.kind === 'bloom') {
      const r = p.size * (0.6 + 0.4 * (1 - k));
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, rgba('#ffffff', 0.85 * k)); g.addColorStop(0.18, rgba(p.color, 0.55 * k)); g.addColorStop(1, rgba(p.color, 0));
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
    } else if (p.kind === 'bubble') {
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = Math.min(1, k * 1.5) * 0.9;
      const s = p.size * 2.2;
      c.drawImage(bubbleSprite(), p.x - s, p.y - s, s * 2, s * 2);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter';
    } else if (p.kind === 'ember') {
      c.globalAlpha = Math.min(1, k * 1.6) * (0.6 + 0.4 * Math.sin(R.t * 30 + p.x));
      c.strokeStyle = p.color; c.lineWidth = p.size; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke();
      c.globalAlpha = Math.min(1, k * 1.2) * 0.5;
      const s = p.size * 5;
      c.drawImage(glowSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
    } else {
      c.globalAlpha = Math.min(1, k * 1.5);
      const s = p.size * (2.5 + k * 1.5);
      c.drawImage(glowSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
    }
  }
  c.restore();
  c.globalAlpha = 1;
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
  if (opt.sqx || opt.sqy) c.scale(opt.sqx || 1, opt.sqy || 1);
  c.drawImage(im, -w / 2, -h / 2, w, h);
  const cr = opt.crack || 0;
  if (cr > 0) drawCracks(c, im, w, h, cr, opt.crackCol || opt.glow || '#fff4d6');
  c.restore();
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Shell fractures: one impact point, jagged tapering fractures that branch and
// spread across the shell, clipped to the egg's silhouette, with light leaking
// through. Generated once per reveal and grown along their length.
// ---------------------------------------------------------------------------
let crackNet = null, crackCv = null;
function buildCracks(seed) {
  const rnd = seeded(seed * 7 + 3);
  const ix = (rnd() - 0.5) * 0.2, iy = 0.02 + rnd() * 0.12; // impact, egg-normalized (-0.5..0.5)
  const paths = [];
  const walk = (x, y, ang, len, width, start, depth) => {
    const pts = [[x, y]];
    let dist = 0, a = ang;
    const step = 0.028 + rnd() * 0.012;
    while (dist < len) {
      a += (rnd() - 0.5) * 0.9;
      const sl = step * (0.6 + rnd() * 0.8);
      x += Math.cos(a) * sl; y += Math.sin(a) * sl * 1.15;
      dist += sl;
      pts.push([x, y]);
      if (depth < 2 && rnd() < 0.16 && dist > 0.05) {
        walk(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), len * (0.25 + rnd() * 0.3), width * 0.55, start + dist, depth + 1);
      }
      if (Math.abs(x) > 0.62 || Math.abs(y) > 0.62) break;
    }
    paths.push({ pts, width, start, len: dist });
  };
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    walk(ix, iy, a, 0.35 + rnd() * 0.4, 1, 0, 0);
  }
  // short crushed ring around the impact
  const ring = [];
  const rr = 0.045 + rnd() * 0.02;
  for (let k = 0; k <= 9; k++) { const a = (k / 9) * Math.PI * 2; ring.push([ix + Math.cos(a) * rr * (0.8 + rnd() * 0.4), iy + Math.sin(a) * rr * (0.8 + rnd() * 0.4)]); }
  paths.push({ pts: ring, width: 0.6, start: 0.04, len: 0.3 });
  let total = 0;
  for (const p of paths) total = Math.max(total, p.start + p.len);
  return { seed, paths, total, ix, iy };
}
function strokeGrown(g, p, reach, scaleX, scaleY, wBase, taper) {
  let d = p.start;
  for (let i = 1; i < p.pts.length; i++) {
    const [ax, ay] = p.pts[i - 1], [bx, by] = p.pts[i];
    const sl = Math.hypot(bx - ax, by - ay);
    if (d >= reach) return;
    const f = Math.min(1, (reach - d) / sl);
    const t = (d - p.start) / Math.max(0.001, p.len);
    g.lineWidth = Math.max(0.5, wBase * p.width * (taper ? 1 - t * 0.75 : 1));
    g.beginPath();
    g.moveTo((ax + 0.5) * scaleX, (ay + 0.5) * scaleY);
    g.lineTo((ax + (bx - ax) * f + 0.5) * scaleX, (ay + (by - ay) * f + 0.5) * scaleY);
    g.stroke();
    d += sl;
  }
}
function drawCracks(c, im, w, h, cr, lightCol) {
  if (!crackNet || crackNet.seed !== RV.seed) crackNet = buildCracks(RV.seed);
  const dpr = Math.min(2, R.dpr || 1);
  const cw = Math.ceil(w * dpr), ch = Math.ceil(h * dpr);
  if (!crackCv) crackCv = document.createElement('canvas');
  if (crackCv.width !== cw || crackCv.height !== ch) { crackCv.width = cw; crackCv.height = ch; }
  const g = crackCv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cw, ch);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const reach = ease.outCubic(Math.min(1, cr)) * crackNet.total;
  const base = Math.max(1.4, h * dpr * 0.02) * (0.7 + Math.min(1, cr) * 0.7);
  // fractures live on the shell body, not on horns/flames/crystals sticking out of it
  g.save();
  g.beginPath(); g.ellipse(cw * 0.5, ch * 0.6, cw * 0.42, ch * 0.37, 0, 0, Math.PI * 2); g.clip();
  // 1. light bleeding out of the fractures
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = rgba(lightCol, 0.16 + 0.22 * cr);
  for (const p of crackNet.paths) strokeGrown(g, p, reach, cw, ch, base * 2.6, true);
  // 2. the dark fracture itself
  g.strokeStyle = 'rgba(16,8,6,0.92)';
  for (const p of crackNet.paths) strokeGrown(g, p, reach, cw, ch, base * 1.2, true);
  // 3. hot core of light deep in the crack
  g.strokeStyle = rgba(lightCol, 0.95);
  for (const p of crackNet.paths) strokeGrown(g, p, reach, cw, ch, base * 0.42, true);
  // 4. raised shell edge catching light (bevel)
  g.save(); g.translate(-dpr * 0.8, -dpr * 0.8);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  for (const p of crackNet.paths) strokeGrown(g, p, reach, cw, ch, base * 0.35, true);
  g.restore();
  // 5. glow pooling at the impact point
  const gx = (crackNet.ix + 0.5) * cw, gy = (crackNet.iy + 0.5) * ch;
  const gr = g.createRadialGradient(gx, gy, 0, gx, gy, ch * (0.12 + cr * 0.25));
  gr.addColorStop(0, rgba(lightCol, 0.45 * cr)); gr.addColorStop(1, rgba(lightCol, 0));
  g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  g.restore();
  // keep everything inside the shell's silhouette
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(im, 0, 0, cw, ch);
  g.globalCompositeOperation = 'source-over';
  c.drawImage(crackCv, -w / 2, -h / 2, w, h);
}

function rays(c, x, y, col, a, n = 14, spin = 0.3, w = 0.08) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const L = Math.max(R.W, R.H) * 0.95;
  const g = c.createRadialGradient(x, y, 0, x, y, L);
  g.addColorStop(0, rgba(col, a * 2.2)); g.addColorStop(0.35, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + R.t * spin + Math.sin(R.t * 0.7 + i) * 0.05;
    const ww = w * (0.6 + 0.4 * Math.sin(i * 7.3 + R.t));
    c.globalAlpha = 0.55 + 0.45 * Math.sin(R.t * 1.3 + i * 2.1);
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, L, ang - ww, ang + ww); c.closePath(); c.fill();
    c.globalAlpha *= 0.5;
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, L, ang - ww * 2.2, ang + ww * 2.2); c.closePath(); c.fill();
  }
  c.restore();
  c.globalAlpha = 1;
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
  if (r >= 2) rays(c, cx, cy, col, (SHADER[RV.anim] ? 0.03 : 0.06) + r * 0.008, 10 + r * 2, 0.25 + r * 0.04, 0.05 + r * 0.004);
  if (r >= 7) rays(c, cx, cy, '#ffffff', 0.05, 7, -0.4, 0.03);
  aura(c, cx, cy, R.W * (0.45 + r * 0.03), col, (SHADER[RV.anim] ? 0.18 : 0.35) + r * 0.03);
  if (it.inst.mut) {
    const m = MUT_BY_ID[it.inst.mut];
    aura(c, cx, cy, R.W * 0.4, it.inst.mut === 'iridescent' ? hsl((R.t * 120) % 360, 90, 65) : m.color, 0.3);
    if (Math.random() < 0.4) spark(cx + rand(-1, 1) * R.W * 0.35, cy + rand(-1, 1) * 70, { color: m.color, speed: 30, life: 1, size: 2 });
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
  if (Math.random() < 0.5) spark(cx + rand(-60, 60), cy + 80, { kind: 'bubble', vx: rand(-10, 10), vy: rand(-160, -60), size: rand(2, 5), life: 1.2, drag: 0.5 });
  drawEggAt(c, cx, cy, E(), { scale: 1 + ease.inCubic(w) * 0.35, shake: w * 3, glow: climbColor(w), crack: w > 0.7 ? (w - 0.7) * 3 : 0 });
  const br = E() * (0.75 + w * 0.3);
  const bg = c.createRadialGradient(cx, cy, br * 0.82, cx, cy, br);
  bg.addColorStop(0, 'rgba(190,245,255,0.03)'); bg.addColorStop(0.85, 'rgba(200,250,255,0.22)'); bg.addColorStop(1, 'rgba(230,255,255,0)');
  c.fillStyle = bg; c.beginPath(); c.arc(cx, cy, br, 0, TAU); c.fill();
  const sp = c.createRadialGradient(cx - br * 0.45, cy - br * 0.5, 0, cx - br * 0.45, cy - br * 0.5, br * 0.25);
  sp.addColorStop(0, 'rgba(255,255,255,0.6)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sp; c.beginPath(); c.arc(cx - br * 0.45, cy - br * 0.5, br * 0.25, 0, TAU); c.fill();
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
// 11 The Grasp — tentacles rise out of the dark, coil round the shell (behind and in front of it) and squeeze
function tubeSeg(c, a, b, w) {
  c.lineWidth = w;
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
}
function drawTentacle(c, pts, front, egg) {
  // pts: [x, y, width, depth]; depth < 0 = behind the egg
  const on = (i) => (pts[i][3] >= 0) === front;
  const nrm = (i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;
    // underside = the side facing the egg
    if ((egg[0] - pts[i][0]) * nx + (egg[1] - pts[i][1]) * ny < 0) { nx = -nx; ny = -ny; }
    return [nx, ny];
  };
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  const dim = front ? 1 : 0.42;
  const col = (r, g, b, a = 1) => `rgba(${(r * dim) | 0},${(g * dim) | 0},${(b * dim) | 0},${a})`;
  const pass = (style, wf, off, minW = 0.6) => {
    c.strokeStyle = style;
    for (let i = 1; i < pts.length; i++) {
      if (!on(i)) continue;
      const w = pts[i][2];
      if (off) {
        const [nx, ny] = nrm(i), o = off * w;
        tubeSeg(c, [pts[i - 1][0] + nx * o, pts[i - 1][1] + ny * o], [pts[i][0] + nx * o, pts[i][1] + ny * o], Math.max(minW, w * wf));
      } else tubeSeg(c, pts[i - 1], pts[i], Math.max(minW, w * wf));
    }
  };
  // round, wet tube: dark rim -> body -> lit core -> specular, lit from above the egg
  c.strokeStyle = '#050104';
  for (let i = 1; i < pts.length; i++) if (on(i)) tubeSeg(c, pts[i - 1], pts[i], pts[i][2] + 2);
  pass(col(48, 16, 36), 1, 0);
  pass(col(84, 30, 64), 0.74, -0.08);
  pass(col(122, 52, 92), 0.46, -0.16);
  pass(col(168, 92, 132, 0.8), 0.22, -0.26);
  pass(front ? 'rgba(255,225,240,0.55)' : 'rgba(255,225,240,0.12)', 0.07, -0.32);
  // pale belly along the side facing the egg
  pass(col(150, 96, 120, 0.55), 0.18, 0.36);
  // two rows of suckers along the underside
  if (front) {
    for (let i = 2; i < pts.length - 1; i += 2) {
      if (!on(i)) continue;
      const [x, y, w] = pts[i];
      const r = w * 0.2;
      if (r < 1) continue;
      const [nx, ny] = nrm(i);
      const sx = x + nx * w * 0.4, sy = y + ny * w * 0.4;
      const ang = Math.atan2(ny, nx);
      c.fillStyle = 'rgba(214,160,182,0.9)'; c.beginPath(); c.ellipse(sx, sy, r * 0.75, r * 1.1, ang, 0, TAU); c.fill();
      c.fillStyle = 'rgba(60,16,38,0.9)'; c.beginPath(); c.ellipse(sx + nx * r * 0.15, sy + ny * r * 0.15, r * 0.35, r * 0.6, ang, 0, TAU); c.fill();
    }
  }
  c.restore();
}
A[11] = (c, k, cx, cy) => {
  const w0 = seg(k, 0, 1);
  if (w0 > 0.05) fire('gr1', () => sfxPlay('tentacle'));
  if (w0 > 0.62) fire('gr2', () => { sfxPlay('growl'); shake(5); });
  const im = IMG.eggs[RV.item.tier];
  const H = E() * 1.15, Wd = im ? (H * im.naturalWidth) / im.naturalHeight : H * 0.8;
  const bx = cx, by = cy + H * 0.1, rx = Wd * 0.42, ry = H * 0.4;
  const reach = ease.outCubic(seg(w0, 0, 0.42));
  const wrapK = ease.inOut(seg(w0, 0.28, 0.78));
  const grip = ease.inOut(seg(w0, 0.6, 1));
  const sc = H / 140;
  const specs = [
    { yb: -0.32, sx: -0.12, sy: 1.0, turns: 1.55 },
    { yb: 0.12, sx: 1.12, sy: 0.92, turns: 1.4 },
    { yb: 0.55, sx: 0.32, sy: 1.12, turns: 1.3 },
  ];
  const tents = specs.map((sp, i) => {
    const side = sp.sx < 0.5 ? -1 : 1;
    const ringR = rx * Math.sqrt(Math.max(0.08, 1 - sp.yb * sp.yb)) * (1.1 - 0.1 * grip);
    const ringY = by + sp.yb * ry;
    const tilt = ringR * 0.36;
    const th0 = side > 0 ? 0 : Math.PI;
    const dir = side > 0 ? -1 : 1;
    const x0 = sp.sx * R.W, y0 = cy + sp.sy * R.H * 0.5;
    const ex = bx + ringR * Math.cos(th0), ey = ringY;
    const pts = [];
    const nA = 22;
    for (let s = 0; s <= nA; s++) {
      const f = (s / nA) * reach;
      const p1x = x0 - side * 70 * sc, p1y = lerp(y0, ey, 0.45);
      const p2x = ex + side * 110 * sc, p2y = ey + 70 * sc;
      const q = 1 - f;
      const x = q * q * q * x0 + 3 * q * q * f * p1x + 3 * q * f * f * p2x + f * f * f * ex;
      const y = q * q * q * y0 + 3 * q * q * f * p1y + 3 * q * f * f * p2y + f * f * f * ey;
      const wave = Math.sin(f * 9 + R.t * 3 + i * 1.7) * 12 * sc * Math.sin(f * Math.PI) * (1 - grip * 0.8);
      pts.push([x + wave, y + wave * 0.4, 0, 1]);
    }
    if (reach >= 0.999) {
      const wrapAmt = Math.PI * sp.turns * wrapK, nW = 34;
      for (let s = 1; s <= nW && wrapAmt > 0.01; s++) {
        const ang = (s / nW) * wrapAmt;
        const th = th0 + dir * ang;
        const z = ang < Math.PI ? -Math.sin(ang) - 0.0001 : Math.sin(ang - Math.PI) + 0.0001;
        const lift = ang < Math.PI ? -Math.sin(ang) : Math.sin(ang - Math.PI);
        pts.push([bx + ringR * Math.cos(th), ringY + tilt * lift - (ang / Math.PI) * 6 * sc, 0, z]);
      }
    }
    const n = pts.length, nA1 = nA + 1, nWr = Math.max(1, n - nA1);
    for (let s = 0; s < n; s++) {
      const w = s < nA1 ? lerp(28, 19, s / nA) : lerp(19, 5, Math.pow((s - nA1) / Math.max(1, 34 - 1), 1.2));
      pts[s][2] = w * sc * (1 + grip * 0.1);
    }
    return pts;
  });
  for (const t of tents) drawTentacle(c, t, false, [bx, by]);
  drawEggAt(c, cx, cy, H, { glow: climbColor(w0), glowA: 0.35 + w0 * 0.4, shake: grip * 5, crack: seg(w0, 0.62, 1), sqx: 1 - 0.07 * grip, sqy: 1 + 0.03 * grip });
  // contact shadow where the coils press into the shell
  c.save();
  c.strokeStyle = 'rgba(0,0,0,0.32)'; c.lineCap = 'round';
  for (const t of tents) for (let i = 1; i < t.length; i++) if (t[i][3] >= 0 && t[i][3] < 0.999) tubeSeg(c, [t[i - 1][0], t[i - 1][1] + 3], [t[i][0], t[i][1] + 3], t[i][2] * 1.3);
  c.restore();
  for (const t of tents) drawTentacle(c, t, true, [bx, by]);
  if (grip > 0.3 && Math.random() < 0.12) sfxPlay('crack');
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
// ---------------------------------------------------------------------------
// High-end reveals (shader backdrops from gl.js + 2D foreground)
// ---------------------------------------------------------------------------
const tintCache = new Map();
function tinted(im, col, a) {
  const q = Math.round(a * 20) / 20;
  const key = im.src + col + q;
  if (tintCache.has(key)) return tintCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  const g = cv.getContext('2d');
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = rgba(col, q); g.fillRect(0, 0, cv.width, cv.height);
  if (tintCache.size > 60) tintCache.clear();
  tintCache.set(key, cv);
  return cv;
}

// 20 Black Tide
A[20] = (c, k, cx, cy) => {
  if (k > 0.25) fire('wh', () => sfxPlay('whisper'));
  drawEggAt(c, cx, cy, E(), { glow: climbColor(k), glowA: 0.35 + k * 0.6, shake: seg(k, 0.65, 1) * 6, crack: seg(k, 0.55, 1) });
};
// 21 Thunderhead
A[21] = (c, k, cx, cy) => {
  [0.2, 0.42, 0.6, 0.74, 0.86, 0.95].forEach((at, i) => fireAt(k, at, 'st' + i, () => {
    const x0 = rand(0.1, 0.9) * R.W;
    const hitEgg = i >= 2;
    const tx = hitEgg ? cx + rand(-8, 8) : rand(0.05, 0.95) * R.W;
    const ty = hitEgg ? cy - E() * 0.38 : R.H * rand(0.55, 0.85);
    RV.bolts.push({ b: makeBolt(x0, -20, tx, ty, 2), t: 0 });
    RV.flash = 1; RV.flashX = x0 / R.W;
    sfxPlay('snap'); setTimeout(() => sfxPlay('bump'), 120 + rand(0, 200));
    shake(hitEgg ? 7 : 4); vibrate(25);
  }));
  drawEggAt(c, cx, cy, E(), { glow: RV.flash > 0.3 ? '#cfe4ff' : climbColor(k), glowA: 0.4 + RV.flash, shake: seg(k, 0.6, 1) * 5, crack: seg(k, 0.5, 1), crackCol: '#e8f2ff' });
};
// 22 Caustic Bloom
A[22] = (c, k, cx, cy) => {
  if (Math.random() < 0.55) spark(cx + rand(-0.5, 0.5) * R.W, R.H * rand(0.7, 1.05), { kind: 'bubble', vx: rand(-8, 8), vy: rand(-140, -60), size: rand(1.5, 4.5), life: rand(1.4, 2.4), drag: 0.2 });
  drawEggAt(c, cx, cy + Math.sin(R.t * 2) * 4, E(), { glow: climbColor(k), glowA: 0.4 + k * 0.5, crack: seg(k, 0.6, 1), shake: seg(k, 0.75, 1) * 4 });
};
// 23 Hydrothermal Eruption
A[23] = (c, k, cx, cy) => {
  const vy = cy + R.H * 0.6;
  for (let i = 0; i < 3; i++) if (Math.random() < 0.3 + k) spark(cx + rand(-14, 14) * (1 + k), vy - rand(0, 30), { kind: 'ember', color: Math.random() < 0.3 ? '#ffe2a0' : '#ff7a1a', vx: rand(-40, 40), vy: rand(-420, -220) * (0.7 + k), size: rand(1, 2.4), life: rand(0.8, 1.6), drag: 0.4 });
  if (k > 0.3) fire('rum', () => sfxPlay('tentacle'));
  drawEggAt(c, cx, cy, E(), { glow: k < 0.5 ? '#ff7a1a' : climbColor(k), glowA: 0.4 + k * 0.6, shake: 1 + k * 6, crack: seg(k, 0.5, 1), crackCol: '#ff9a3c' });
};
// 24 Bioluminescent Swarm
A[24] = (c, k, cx, cy) => {
  if (!RV.plank) {
    const rnd = seeded(RV.seed);
    RV.plank = Array.from({ length: 420 }, () => ({ a: rnd() * TAU, r: 60 + rnd() * Math.max(R.W, R.H) * 0.75, sp: (0.2 + rnd() * 0.6) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * TAU, s: 0.8 + rnd() * 1.8, c: rnd() < 0.75 ? '#5effd6' : '#8fd8ff' }));
  }
  const col = climbColor(k);
  const conv = ease.inCubic(k);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of RV.plank) {
    const rr = p.r * (1 - conv * 0.88) + Math.sin(R.t * 2 + p.ph) * 6;
    const a = p.a + R.t * p.sp * (1 + k * 3) + Math.sin(R.t + p.ph) * 0.1;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.85;
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(R.t * 3 + p.ph));
    c.globalAlpha = tw;
    const s = p.s * 3.2;
    c.drawImage(glowSprite(k > 0.6 && p.s > 2 ? col : p.c), x - s, y - s, s * 2, s * 2);
  }
  c.restore(); c.globalAlpha = 1;
  drawEggAt(c, cx, cy, E(), { glow: col, glowA: 0.3 + k * 0.7, crack: seg(k, 0.6, 1), shake: seg(k, 0.8, 1) * 4 });
};
// 25 Event Horizon
A[25] = (c, k, cx, cy) => {
  if (k > 0.35) fire('eh1', () => sfxPlay('heartbeat'));
  if (k > 0.7) fire('eh2', () => { sfxPlay('heartbeat'); shake(5); });
  const sc = Math.max(0.03, 1 - ease.inCubic(k) * 0.97);
  const ang = k * k * 9;
  const off = (1 - k) * 0;
  drawEggAt(c, cx + Math.cos(ang) * off, cy, E(), { scale: sc, rot: ang, glow: '#ffffff', glowA: 0.2 + k * 0.5, alpha: 1 - seg(k, 0.9, 1) });
};
// 26 Leviathan's Gaze
A[26] = (c, k, cx, cy) => {
  if (k > 0.2) fire('g1', () => sfxPlay('heartbeat'));
  if (k > 0.55) fire('g2', () => sfxPlay('whisper'));
  if (k > 0.8) fire('g3', () => { sfxPlay('heartbeat'); shake(4); });
  const vis = seg(k, 0.35, 0.6);
  drawEggAt(c, cx, cy, E() * 0.36, { alpha: 0.25 + 0.6 * vis, glow: climbColor(k), glowA: 0.3 * vis, shake: seg(k, 0.85, 1) * 3 });
};
// 27 From Below
A[27] = (c, k, cx, cy) => {
  const lev = IMG.creatures.leviathan, tj = IMG.creatures.thornjaw;
  const fog = '#03101a';
  if (k < 0.62 && lev) {
    const f = seg(k, 0, 0.62);
    const w = R.W * 2.6, h = (w * lev.naturalHeight) / lev.naturalWidth;
    const x = lerp(R.W + w * 0.55, -w * 0.55, f);
    const y = cy + R.H * 0.26 + Math.sin(R.t * 1.1) * 8;
    c.drawImage(tinted(lev, fog, 0.82), x - w / 2, y - h / 2, w, h);
    if (k > 0.1) fire('pass', () => sfxPlay('growl'));
  }
  drawEggAt(c, cx, cy, E(), { glow: climbColor(k), glowA: 0.35 + k * 0.5, shake: seg(k, 0.6, 1) * 7, crack: seg(k, 0.6, 1) });
  if (k >= 0.58 && tj) {
    const f = ease.inCubic(seg(k, 0.58, 1));
    const L = lerp(R.H * 0.8, R.H * 2.3, f);
    const top = lerp(R.H + 40, cy - E() * 0.25 - L * 0.07, f);
    const yc = top + L / 2;
    const short = (L * tj.naturalHeight) / tj.naturalWidth;
    c.save(); c.translate(cx, yc); c.rotate(Math.PI / 2);
    c.drawImage(tinted(tj, fog, lerp(0.88, 0.15, f)), -L / 2, -short / 2, L, short);
    c.restore();
    fire('lunge', () => { sfxPlay('growl'); sfxPlay('tentacle'); });
    if (f > 0.6) shake(3 + f * 6);
  }
};
// 28 Abyssal Aurora
A[28] = (c, k, cx, cy) => {
  if (k > 0.15) fire('au', () => sfxPlay('omen'));
  drawEggAt(c, cx, cy - Math.sin(k * Math.PI) * 18, E(), { glow: climbColor(k), glowA: 0.35 + k * 0.6, crack: seg(k, 0.6, 1), shake: seg(k, 0.8, 1) * 4 });
};
// 29 Shattered Reality
A[29] = (c, k, cx, cy) => {
  [0.15, 0.3, 0.45, 0.58, 0.7, 0.8, 0.88, 0.94].forEach((at, i) => fireAt(k, at, 'cr' + i, () => { sfxPlay('crack'); if (i > 4) shake(3 + i); }));
  if (k > 0.5) fire('sw', () => sfxPlay('whisper'));
  drawEggAt(c, cx, cy, E(), { glow: climbColor(k), glowA: 0.3 + k * 0.7, crack: k, shake: seg(k, 0.6, 1) * 7 });
};

function fireAt(w, at, key, fn) { if (w >= at) fire(key, fn); }

// ---------------------------------------------------------------------------
export function drawReveal(c, dt) {
  if (!RV.active) return;
  RV.t += dt;
  updLocal(dt);
  RV.flash *= Math.exp(-dt * 7);
  const k = clamp(RV.t / RV.dur, 0, 1);
  const cx = R.W / 2, cy = R.H * 0.4;
  const hk = RV.hatchK;
  const kb = Math.min(1, k / hk);
  if (k >= hk) RV.hT += dt;
  const sh = SHADER[RV.anim];
  let drewBg = false;
  if (sh) {
    const cvs = renderFX(sh[0], { W: R.W, H: R.H, cx, cy, t: R.t, k: kb, h: RV.hT, col: climbColor(kb), flash: RV.flash, flashX: RV.flashX }, sh[1]);
    if (cvs) { c.drawImage(cvs, 0, 0, R.W, R.H); drewBg = true; }
  }
  if (!drewBg) {
    c.fillStyle = 'rgba(2,3,8,0.8)'; c.fillRect(0, 0, R.W, R.H);
    if (sh) aura(c, cx, cy, R.W * 0.6, climbColor(kb), 0.25 + kb * 0.3);
  }
  // lightning lives above the clouds but is drawn over the egg
  if (k < hk) {
    A[RV.anim](c, kb, cx, cy);
    for (const bo of RV.bolts) {
      bo.t += dt;
      const t = bo.t;
      const inten = t < 0.05 ? 1 : t < 0.09 ? 0.25 : t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.25);
      drawBolt(c, bo.b, inten, '#8fb8ff');
    }
    drawLocal(c);
    c.font = '600 13px Georgia'; c.textAlign = 'center'; c.fillStyle = 'rgba(230,220,200,0.5)';
    c.fillText(EGGS[RV.item.tier - 1].name.toUpperCase() + ' · ' + REVEALS[RV.anim].toUpperCase(), cx, R.H * 0.74);
    c.fillText('tap to skip', cx, R.H * 0.92);
  } else {
    fire('hatch', hatchMoment);
    if (!sh) { c.fillStyle = 'rgba(2,3,8,0.15)'; c.fillRect(0, 0, R.W, R.H); }
    drawLocal(c);
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
