import { R } from './rt.js';
import {
  S, stats, save, addMoney, nextUid, contractEvent, eggValue, upgradeCost, crewCost, roomCost, crewTotal,
  incomePerSec, sellValue, omenActive, ensureContracts, makeContract,
} from './state.js';
import { MAX_DEPTH, CREATURE_BY_ID, EGGS, HATCH_ODDS, BY_RARITY, MUTATIONS, RARITIES, UPG_BY_ID, CREW_BY_ID, zoneAt, ZONES, OMENS, OMEN_BY_ID } from './data.js';
import { newField, ensureChunks, updateField, eggSize, worldW, tentacleTip } from './ocean.js';
import { layoutShip, cannonTip } from './ship.js';
import { burst, ring, spark, floatText, shake, flash, comboFX, stop, clearFx } from './fx.js';
import { sfxPlay, vibrate, setAmbience } from './audio.js';
import { clamp, rand, pick, weighted, gauss, fmt, money, meters, lerp } from './util.js';
const MAX_SINK = 600; // m/s: past this the screen can't show what's coming
import { UI } from './ui-bridge.js';
import { CAGES } from './cage.js';

// ---------------------------------------------------------------------------
// Hatching
// ---------------------------------------------------------------------------
export const COMBO_WINDOW = 40;

export function hatch(tier, haulLuck = 0) {
  const st = stats();
  const luck = Math.max(0, st.luck + haulLuck);
  const odds = HATCH_ODDS[tier - 1].map((p, r) => p * Math.pow(1 + luck, r * 0.55));
  const r = weighted(odds);
  const def = pick(BY_RARITY[r]);
  let mut = null;
  const mChance = (0.035 + 0.012 * (tier - 1) + luck * 0.015) * st.mutMult;
  if (Math.random() < mChance) mut = MUTATIONS[weighted(MUTATIONS.map((m) => m.w * (m.mult > 10 ? 1 + luck * 0.3 : 1)))].id;
  let size = clamp(Math.exp(gauss() * 0.22), 0.6, 1.9);
  const colossal = Math.random() < 0.012;
  if (colossal) size *= 2.5;
  const mMult = mut ? MUTATIONS.find((m) => m.id === mut).mult : 1;
  const value = def.value * mMult * size * (1 + (tier - 1) * 0.04);
  const inst = { uid: nextUid(), id: def.id, mut, size, value, colossal };
  // codex
  const cx = S.codex[def.id] || (S.codex[def.id] = { caught: 0, muts: {}, best: 0 });
  const first = cx.caught === 0;
  const firstMut = !cx.muts[mut || 'normal'];
  cx.caught++;
  cx.muts[mut || 'normal'] = 1;
  cx.best = Math.max(cx.best, value);
  S.stats.hatched++;
  S.stats.bestValue = Math.max(S.stats.bestValue, value);
  S.dread = clamp(S.dread + RARITIES[r].dread, 0, 100);
  contractEvent('hatch', { r });
  if (mut) contractEvent('mutation');
  return { tier, def, inst, first, firstMut };
}

export function sellInst(inst) {
  const v = sellValue(inst);
  addMoney(v);
  contractEvent('sell', v);
  sfxPlay('coin');
  return v;
}
// Kept creatures go into a free tank, otherwise into storage (no limit).
export function keepInst(inst) {
  const st = stats();
  if (S.aquarium.length < st.aquaSlots) {
    S.aquarium.push(inst);
    S.aquarium.sort((a, b) => b.value - a.value);
    return 'tank';
  }
  S.bag.push(inst);
  S.bag.sort((a, b) => b.value - a.value);
  return 'bag';
}
export function weakestFish() {
  let w = null;
  for (const f of S.aquarium) if (!w || f.value < w.value) w = f;
  return w;
}
function findFish(uid) {
  let i = S.aquarium.findIndex((f) => f.uid === uid);
  if (i >= 0) return [S.aquarium, i];
  i = S.bag.findIndex((f) => f.uid === uid);
  if (i >= 0) return [S.bag, i];
  return [null, -1];
}
export function sellFish(uid) {
  const [arr, i] = findFish(uid);
  if (!arr) return 0;
  const [f] = arr.splice(i, 1);
  return sellInst(f);
}
export const sellAquarium = sellFish;
export function fishToBag(uid) {
  const i = S.aquarium.findIndex((f) => f.uid === uid);
  if (i < 0) return false;
  S.bag.push(...S.aquarium.splice(i, 1));
  S.bag.sort((a, b) => b.value - a.value);
  sfxPlay('ui');
  return true;
}
// put a stored creature in a tank; if the tanks are full it swaps with the weakest
export function fishToTank(uid) {
  const i = S.bag.findIndex((f) => f.uid === uid);
  if (i < 0) return false;
  const st = stats();
  const [f] = S.bag.splice(i, 1);
  if (S.aquarium.length >= st.aquaSlots) {
    const w = weakestFish();
    if (w) { S.aquarium.splice(S.aquarium.indexOf(w), 1); S.bag.push(w); }
  }
  S.aquarium.push(f);
  S.aquarium.sort((a, b) => b.value - a.value);
  S.bag.sort((a, b) => b.value - a.value);
  sfxPlay('buy');
  return true;
}
// fill every tank with the highest earners you own
export function equipBest() {
  const st = stats();
  const all = S.aquarium.concat(S.bag).sort((a, b) => b.value - a.value);
  const before = S.aquarium.map((f) => f.uid).join();
  S.aquarium = all.slice(0, st.aquaSlots);
  S.bag = all.slice(st.aquaSlots);
  return before !== S.aquarium.map((f) => f.uid).join();
}
export function sellAllStored() {
  let t = 0;
  for (const f of S.bag) t += sellValue(f);
  if (!S.bag.length) return 0;
  addMoney(t);
  contractEvent('sell', t);
  S.bag = [];
  sfxPlay('coin');
  return t;
}

// ---------------------------------------------------------------------------
// Eggs: haul + inventory
// ---------------------------------------------------------------------------
export function sellEggs(inv, tier, n) {
  const have = inv[tier] || 0;
  n = Math.min(n, have);
  if (n <= 0) return 0;
  const v = eggValue(tier) * n;
  inv[tier] = have - n;
  if (!inv[tier]) delete inv[tier];
  addMoney(v);
  contractEvent('sell', v);
  sfxPlay('coin');
  return v;
}
export function storeEggs(inv, tier, n) {
  const have = inv[tier] || 0;
  n = Math.min(n, have);
  if (n <= 0) return 0;
  inv[tier] = have - n;
  if (!inv[tier]) delete inv[tier];
  S.eggInv[tier] = (S.eggInv[tier] || 0) + n;
  sfxPlay('pickup');
  return n;
}
export function takeEggs(inv, tier, n) {
  const have = inv[tier] || 0;
  n = Math.min(n, have);
  inv[tier] = have - n;
  if (!inv[tier]) delete inv[tier];
  return Array(n).fill(+tier);
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------
export function buyUpgrade(id) {
  const u = UPG_BY_ID[id];
  if (S.upgrades[id] >= u.max) return false;
  const cost = upgradeCost(u);
  if (S.money < cost) { sfxPlay('deny'); return false; }
  S.money -= cost;
  S.upgrades[id]++;
  sfxPlay('buy');
  return true;
}
export function hireCrew(id) {
  const st = stats();
  if (crewTotal() >= st.crewCap) { sfxPlay('deny'); UI.toast('No free beds — build Crew Bunks', '#ff6b6b'); return false; }
  const cost = crewCost(id);
  if (S.money < cost) { sfxPlay('deny'); return false; }
  S.money -= cost;
  S.crew[id]++;
  sfxPlay('buy');
  return true;
}
export function buyCage(i) {
  const cg = CAGES[i];
  if (!cg) return false;
  if (S.cages.includes(i)) { S.cage = i; sfxPlay('ui'); return true; }
  if (S.money < cg.cost) { sfxPlay('deny'); return false; }
  S.money -= cg.cost;
  S.cages.push(i);
  S.cage = i;
  sfxPlay('buy'); shake(6); flash(cg.glow || '#ffffff', 0.25);
  UI.toast(`${cg.name} equipped!`, cg.glow || '#ffd34d');
  return true;
}

export function buildRoom(type) {
  const cost = roomCost();
  if (S.money < cost) { sfxPlay('deny'); return false; }
  S.money -= cost;
  S.rooms.push(type);
  layoutShip();
  sfxPlay('buy');
  shake(4);
  return true;
}

// ---------------------------------------------------------------------------
// Dive / reel
// ---------------------------------------------------------------------------
export function resetField() {
  R.field = newField();
  ensureChunks(R.field, 120);
}

export function fireHarpoon() {
  const st = stats();
  const [tx, ty] = cannonTip();
  const PPM = R.PPM;
  R.hp = {
    x: tx / PPM, y: ty / PPM, angle: R.aimAngle, phase: 'air',
    eggs: [], combo: 0, lastHitY: 0, base: st.range, maxDepth: Math.min(MAX_DEPTH - 1, st.range), shields: st.shields,
    haulLuck: 0, slowT: 0, magnetT: 0, spd: 1, trail: [], zone: 0, best: 0, tx: null,
    tension: 0, taut: 0, lurkT: 2.5, entryX: tx / PPM, pearls: 0, ichor: 0, stolen: 0, snapped: 0,
  };
  S.stats.dives++;
  R.mode = 'dive';
  R.steer = 0;
  R.steerX = null;
  sfxPlay('fire');
  shake(7);
  vibrate(40);
  burst(tx, ty, 18, { color: '#ffd28a', speed: 160, life: 0.5 });
  burst(tx, ty, 12, { color: '#888', speed: 60, life: 1.2, size: 5, drag: 1, glow: false });
  UI.setMode('dive');
}

function hpScreen() {
  return [R.hp.x * R.PPM, R.hp.y * R.PPM - R.camY];
}

// Drop an egg into the cage. No limit.
function stowEgg(tier, wx, wy) {
  const hp = R.hp;
  hp.eggs.push(tier);
  hp.squash = 1;
  UI.eggFly(wx * R.PPM, wy * R.PPM - R.camY, tier);
  if (hp.combo < 2 || tier >= 4) floatText(wx * R.PPM, wy * R.PPM - 26, EGGS[tier - 1].name, EGGS[tier - 1].color, 14);
}

function takeEgg(e) {
  const hp = R.hp, st = stats();
  e.taken = true;
  hp.combo++;
  hp.lastHitY = e.y;
  S.stats.maxCombo = Math.max(S.stats.maxCombo, hp.combo);
  contractEvent('combo', hp.combo);
  const PPM = R.PPM;
  const ex = e.x * PPM, ey = e.y * PPM;
  const col = EGGS[e.tier - 1].color;
  burst(ex, ey, 12, { color: col, speed: 170, life: 0.5, size: 1.6 });
  ring(ex, ey, col, 46, 0.35);
  sfxPlay('hit', hp.combo);
  vibrate(15 + hp.combo * 5);
  stowEgg(e.tier, e.x, e.y);
  if (hp.combo >= 2) {
    const mult = hp.combo * hp.combo;
    hp.maxDepth = Math.min(MAX_DEPTH - 1, Math.max(hp.maxDepth, hp.base * mult));
    hp.haulLuck += 0.05;
    hp.spd *= 2; // every combo hit doubles the current dive speed
    const [sx, sy] = [ex, ey - R.camY];
    comboFX(hp.combo, sx, sy, `x${hp.combo} COMBO`, `RANGE x${mult}`, `SPEED x${fmt(hp.spd)}`);
    sfxPlay('combo', hp.combo);
  } else {
    stop(0.03);
    shake(2);
  }
}

function hazardHit(h, label) {
  const hp = R.hp;
  const PPM = R.PPM;
  if (hp.shields > 0) {
    hp.shields--;
    h.used = true; h.gone = true;
    floatText(hp.x * PPM, hp.y * PPM - 20, 'SHIELD!', '#9fd6ff', 18);
    ring(hp.x * PPM, hp.y * PPM, '#9fd6ff', 60, 0.5);
    sfxPlay('bump'); shake(5);
    return;
  }
  sfxPlay('bump'); shake(10); flash('#ff2040', 0.25); vibrate(80);
  burst(hp.x * PPM, hp.y * PPM, 26, { color: '#ff6b6b', speed: 200 });
  startReel(label);
}

export function startReel(reason) {
  const hp = R.hp;
  if (!hp || R.mode !== 'dive') return;
  R.mode = 'reel';
  hp.phase = 'reel';
  R.field.lurker = null;
  contractEvent('depth', hp.best);
  const msg = reason === 'max' ? 'LINE FULLY PAID OUT' : reason === 'manual' ? 'REELING IN' : reason;
  UI.toast(msg + ' — drag the power bar', '#e8dcc0');
  UI.setMode('reel');
  if (S.tut < 3) { UI.tip('Drag the bar up to reel faster. Too fast snaps a barb. Too slow and something catches up.'); S.tut = 3; }
}

export function updateDive(dt) {
  const hp = R.hp;
  if (!hp) return;
  if (hp.phase === 'air') return diveStep(dt);
  // fast dives are integrated in small steps so eggs and hazards can't be skipped
  const v = Math.min(MAX_SINK, stats().speed * (hp.spd || 1));
  const n = Math.min(60, Math.max(1, Math.ceil((v * dt) / 2.5)));
  for (let i = 0; i < n; i++) {
    if (R.mode !== 'dive' || R.hp !== hp) return;
    diveStep(dt / n);
  }
}

function diveStep(dt) {
  const hp = R.hp, st = stats(), PPM = R.PPM, f = R.field;
  hp.trail.push([hp.x, hp.y]);
  if (hp.trail.length > 120) hp.trail.shift();
  if (hp.phase === 'air') {
    const v = 60;
    hp.x += Math.sin(hp.angle) * v * dt;
    hp.y += Math.cos(hp.angle) * v * dt + 0;
    if (hp.y >= 0) {
      hp.phase = 'water';
      hp.angle = 0;
      sfxPlay('splash');
      burst(hp.x * PPM, 0, 24, { color: '#cfefff', speed: 160, grav: 500, life: 0.7, glow: false, size: 2.5 });
      ring(hp.x * PPM, 0, '#cfefff', 50, 0.5);
    }
    return;
  }
  hp.slowT -= dt; hp.magnetT -= dt;
  hp.squash = (hp.squash || 0) * Math.exp(-dt * 7);
  const ww = worldW();
  // Direct steering: the harpoon chases your finger's x position. Constant dive speed.
  const v = Math.min(MAX_SINK, st.speed * (hp.spd || 1)) * (hp.slowT > 0 ? 0.45 : 1);
  if (R.steerX != null) hp.tx = R.steerX;
  else if (R.steer) hp.tx = (hp.tx ?? hp.x) + R.steer * 45 * dt;
  const px = hp.x;
  if (hp.tx != null) {
    hp.tx = clamp(hp.tx, 2, ww - 2);
    hp.x += (hp.tx - hp.x) * (1 - Math.exp(-st.steer * 9 * dt));
  }
  hp.x = clamp(hp.x, 2, ww - 2);
  const lat = dt > 0 ? (hp.x - px) / dt : 0;
  hp.angle = clamp(Math.atan2(lat, v) * 0.8, -0.7, 0.7);
  hp.y += v * dt;
  // aim assist: eggs just ahead of the spear drift into its path
  // aim assist only at cruising speed: once a combo has you boosted, it's all on you
  const reach = hp.magnetT > 0 ? 16 : (hp.spd || 1) > 1 ? 0 : 6.5, pull = hp.magnetT > 0 ? 40 : 9;
  for (const e of f.eggs) {
    if (e.taken) continue;
    const ahead = e.y - hp.y;
    if (ahead < 0 || ahead > (hp.magnetT > 0 ? 24 : 12)) continue;
    const dx = hp.x - e.x;
    if (Math.abs(dx) < reach) { e.x += Math.sign(dx) * Math.min(Math.abs(dx), pull * dt); if (hp.magnetT > 0) e.y -= Math.min(ahead, 18 * dt); }
  }
  hp.best = Math.max(hp.best, hp.y);
  S.stats.maxDepth = Math.max(S.stats.maxDepth, hp.y);
  ensureChunks(f, hp.y + 160);
  if (hp.combo > 0 && hp.y - hp.lastHitY > COMBO_WINDOW) {
    if (hp.combo >= 2) { floatText(hp.x * PPM, hp.y * PPM - 24, 'COMBO BROKEN · SPEED RESET', '#9fb3b0', 14); sfxPlay('jelly'); }
    hp.combo = 0;
    hp.spd = 1;
  }
  // bubbles
  if (Math.random() < 0.5) spark(hp.x * PPM, hp.y * PPM, { vx: rand(-20, 20), vy: rand(-80, -30), color: 'rgba(200,240,255,0.6)', size: rand(1, 2.5), life: 0.8, glow: false, drag: 1 });
  // eggs
  for (const e of f.eggs) {
    if (e.taken || Math.abs(e.y - hp.y) > 8) continue;
    const rr = eggSize(e.tier) * 0.45 + 4.2;
    if ((e.x - hp.x) ** 2 + (e.y - hp.y) ** 2 < rr * rr) takeEgg(e);
  }
  // pickups
  for (const p of f.pickups) {
    if (p.taken || Math.abs(p.y - hp.y) > 6) continue;
    const rr = p.r + 1.2;
    if ((p.x - hp.x) ** 2 + (p.y - hp.y) ** 2 > rr * rr) continue;
    p.taken = true;
    const px = p.x * PPM, py = p.y * PPM;
    if (p.type === 'pearl') {
      const v = 10 * Math.pow(1.55, p.zone) * st.sellMult;
      addMoney(v); hp.pearls += v;
      floatText(px, py - 16, '+' + money(v), '#f0e6ff', 14);
      sfxPlay('pickup');
      burst(px, py, 10, { color: '#efe6ff', speed: 90 });
    } else if (p.type === 'wisp') {
      hp.haulLuck += 0.08;
      floatText(px, py - 16, '+8% LUCK', '#9dffc8', 14);
      sfxPlay('pickup');
      burst(px, py, 14, { color: '#7dffb5', speed: 100 });
    } else {
      hp.magnetT = 2.5;
      floatText(px, py - 16, 'EGG MAGNET!', '#bfefff', 16);
      ring(px, py, '#bfefff', 120, 0.7);
      sfxPlay('splash');
    }
  }
  // hazards
  for (const h of f.hazards) {
    if (h.gone) continue;
    if (h.type === 'tentacle') {
      if (Math.abs(h.y - hp.y) > h.len + 4) continue;
      const [tx, ty] = tentacleTip(h);
      const d = segDist(hp.x, hp.y, h.x, h.y, tx, ty);
      if (d < 2.4) { hazardHit(h, 'A TENTACLE SEIZED THE LINE'); return; }
      continue;
    }
    if (Math.abs(h.y - hp.y) > 10) continue;
    const rr = h.r + 1;
    if ((h.x - hp.x) ** 2 + (h.y - hp.y) ** 2 > rr * rr) continue;
    if (h.type === 'urchin') { hazardHit(h, 'IMPALED ON A BLACK URCHIN'); return; }
    if (h.type === 'bloat') {
      burst(h.x * PPM, h.y * PPM, 40, { color: '#ffcf5a', speed: 260 });
      h.gone = true;
      hazardHit(h, 'A BLOATER BURST');
      return;
    }
    if (h.type === 'jelly' && !(h.cool > R.t)) {
      h.cool = R.t + 1.2;
      hp.slowT = 1.2;
      sfxPlay('jelly');
      floatText(hp.x * PPM, hp.y * PPM - 18, 'STUNG — SLOWED', '#d6b0ff', 14);
    }
    if (h.type === 'eye' && !h.used) {
      h.used = true;
      S.dread = clamp(S.dread + 3, 0, 100);
      hp.haulLuck += 0.15;
      floatText(hp.x * PPM, hp.y * PPM - 18, 'IT SAW YOU  +15% LUCK', '#ffdd55', 15);
      sfxPlay('whisper');
      flash('#ffdd55', 0.12);
    }
  }
  // zone change
  const z = zoneAt(hp.y);
  if (z.index !== hp.zone) {
    hp.zone = z.index;
    UI.zoneBanner(z);
    sfxPlay('zone');
    setAmbience(hp.y, 'dive');
  }
  if (z.index >= 12) S.dread = clamp(S.dread + 0.12 * dt, 0, 100);
  if (hp.y >= hp.maxDepth) {
    hp.y = hp.maxDepth;
    startReel('max');
  }
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const x = ax + t * dx, y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

export function reelSafe() {
  const st = stats();
  return Math.max(0.4, st.safe - Math.min(0.12, 0.006 * (R.hp ? R.hp.eggs.length : 0)));
}

export function updateReel(dt) {
  const hp = R.hp, st = stats(), PPM = R.PPM, f = R.field;
  hp.trail.push([hp.x, hp.y]);
  if (hp.trail.length > 120) hp.trail.shift();
  const p = R.power;
  const vmax = st.reelBase + hp.y * 0.18;
  const v = p * vmax;
  hp.y -= v * dt;
  hp.x += (hp.entryX - hp.x) * Math.min(1, (v * dt) / Math.max(hp.y, 6));
  if (v > 1) sfxPlay('ratchet', p);
  // tension
  const safe = reelSafe();
  if (p > safe) hp.tension += (p - safe) * 1.9 * dt * (1 + Math.min(hp.eggs.length, 10) * 0.04);
  else hp.tension = Math.max(0, hp.tension - 0.45 * dt);
  if (p > safe - 0.12 && p <= safe && hp.eggs.length) {
    hp.taut += dt;
    if (hp.taut < 10) hp.haulLuck += 0.03 * dt;
  }
  if (hp.tension > 0.6 && Math.random() < dt * 4) sfxPlay('strain', hp.tension);
  if (hp.tension >= 1) {
    hp.tension = 0.4;
    sfxPlay('snap'); shake(9); flash('#ff3030', 0.3); vibrate(120);
    if (hp.eggs.length) {
      const i = Math.floor(Math.random() * hp.eggs.length);
      const [t] = hp.eggs.splice(i, 1);
      hp.snapped++;
      floatText(hp.x * PPM, hp.y * PPM - 20, 'SNAP! AN EGG FELL OUT: ' + EGGS[t - 1].name.toUpperCase(), '#ff5a5a', 16);
      burst(hp.x * PPM, hp.y * PPM, 20, { color: EGGS[t - 1].color, speed: 120, grav: 200 });
    } else {
      floatText(hp.x * PPM, hp.y * PPM - 20, 'LINE STRAIN!', '#ff5a5a', 16);
    }
  }
  // lurker
  const z = zoneAt(hp.y);
  if (z.index >= 2 && !omenActive('calm') && hp.eggs.length && hp.y > 40) {
    if (!f.lurker) {
      hp.lurkT -= dt;
      if (hp.lurkT <= 0) {
        f.lurker = { x: hp.x + rand(-8, 8), y: hp.y + 75, frac: 0.38 + z.index * 0.012 };
        sfxPlay('growl');
        UI.toast('SOMETHING IS FOLLOWING THE LINE', '#ff4d6d');
      }
    } else {
      const L = f.lurker;
      L.y -= L.frac * (st.reelBase + L.y * 0.18) * dt;
      L.x += (hp.x - L.x) * Math.min(1, dt * 2);
      const gap = L.y - hp.y;
      if (gap < 5) {
        const i = Math.floor(Math.random() * hp.eggs.length);
        const [t] = hp.eggs.splice(i, 1);
        hp.stolen++;
        floatText(hp.x * PPM, hp.y * PPM - 22, 'IT TOOK A ' + EGGS[t - 1].name.toUpperCase(), '#ff4d6d', 16);
        sfxPlay('growl'); shake(10); flash('#400010', 0.4); vibrate(150);
        f.lurker = null; hp.lurkT = 5;
      } else if (gap > 170) {
        f.lurker = null; hp.lurkT = 4;
        floatText(hp.x * PPM, hp.y * PPM + 40, 'you lost it', '#9fd8c9', 13);
      }
    }
  } else if (f.lurker && hp.y <= 40) f.lurker = null;
  if (hp.y <= 0) finishHaul();
}

export function finishHaul() {
  const hp = R.hp;
  hp.y = 0;
  sfxPlay('surface');
  S.stats.eggs += hp.eggs.length;
  contractEvent('eggs', hp.eggs);
  burst(hp.x * R.PPM, 0, 24, { color: '#cfefff', speed: 160, grav: 500, life: 0.7, glow: false });
  const eggs = hp.eggs.slice().sort((a, b) => a - b);
  const extra = [];
  if (hp.pearls) extra.push('pearls ' + money(hp.pearls));
  if (hp.ichor) extra.push('ichor ' + money(hp.ichor));
  if (hp.stolen) extra.push(hp.stolen + ' stolen');
  if (hp.snapped) extra.push(hp.snapped + ' snapped');
  R.haulLuck = hp.haulLuck;
  R.hp = null;
  save();
  if (!eggs.length) {
    UI.toast('The line came up empty' + (extra.length ? ' — ' + extra.join(', ') : ''), '#9fb3b0');
    toShip();
    return;
  }
  UI.toast(`Hauled ${eggs.length} egg${eggs.length > 1 ? 's' : ''}` + (extra.length ? ' — ' + extra.join(', ') : ''), '#e8dcc0');
  R.haulEggs = {};
  for (const t of eggs) R.haulEggs[t] = (R.haulEggs[t] || 0) + 1;
  R.mode = 'haul';
  UI.setMode('haul');
  UI.showHaul(true);
}

export function toShip() {
  clearFx();
  R.mode = 'ship';
  R.hp = null;
  resetField();
  setAmbience(0, 'ship');
  UI.setMode('ship');
}

// ---------------------------------------------------------------------------
// Ambient systems: income, dread, omens, visitation
// ---------------------------------------------------------------------------
let nextVisit = 60;
export function updateSystems(dt) {
  const st = stats();
  addMoney(incomePerSec(st) * dt);
  S.dread = clamp(S.dread + st.dreadRate * dt, 0, 100);
  const now = Date.now();
  if (S.omen && now > S.omenEnd) { S.omen = null; UI.toast('The omen fades', '#9fb3b0'); }
  if (!S.omen && now > S.nextOmen && S.stats.dives >= 2) {
    const o = pick(OMENS);
    S.omen = o.id; S.omenEnd = now + 80000; S.nextOmen = now + rand(160, 280) * 1000;
    sfxPlay('omen');
    UI.omen(o);
  }
  // visitation
  if (R.visit) updateVisit(dt);
  else if (R.mode === 'ship' && !R.panel && S.dread >= 80 && S.aquarium.length) {
    nextVisit -= dt;
    if (nextVisit <= 0) {
      nextVisit = rand(45, 90);
      R.visit = { phase: 'rise', t: 0, xf: rand(0.25, 0.75), taps: 0, need: 6, time: 5 };
      sfxPlay('tentacle'); shake(8);
      UI.visit(true);
    }
  }
}

export function tapVisit() {
  const v = R.visit;
  if (!v || v.phase === 'leave') return;
  v.taps++;
  sfxPlay('slap'); shake(5); vibrate(20);
  if (v.screenX) burst(v.screenX, v.screenY, 12, { scr: true, color: '#e0b8c8', speed: 180 });
  if (v.taps >= v.need) {
    v.phase = 'leave'; v.t = 0;
    const reward = Math.max(200, incomePerSec() * 40);
    addMoney(reward);
    S.dread = clamp(S.dread - 18, 0, 100);
    UI.toast('Repelled! It left ' + money(reward) + ' of ichor behind', '#9dff7a');
    UI.visit(false);
  }
}
function updateVisit(dt) {
  const v = R.visit;
  v.t += dt;
  if (v.phase === 'rise' && v.t > 1.2) { v.phase = 'grab'; v.t = 0; }
  if (v.phase === 'grab') {
    v.time -= dt;
    if (v.time <= 0) {
      const w = weakestFish();
      if (w) {
        S.aquarium.splice(S.aquarium.indexOf(w), 1);
        UI.toast('It dragged your ' + CREATURE_BY_ID[w.id].name + ' into the deep', '#ff4d6d');
      }
      S.dread = clamp(S.dread - 25, 0, 100);
      sfxPlay('growl'); shake(10);
      v.phase = 'leave'; v.t = 0;
      UI.visit(false);
    }
  }
  if (v.phase === 'leave' && v.t > 0.8) R.visit = null;
}

// ---------------------------------------------------------------------------
export function claimContract(id) {
  const i = S.contracts.findIndex((c) => c.id === id);
  if (i < 0) return;
  const c = S.contracts[i];
  if (c.progress < c.target) return;
  addMoney(c.reward);
  S.contractsDone++;
  S.contracts.splice(i, 1, makeContract());
  sfxPlay('buy');
  UI.toast('Contract fulfilled: +' + money(c.reward), '#ffd34d');
}
export function rerollContract(id) {
  const i = S.contracts.findIndex((c) => c.id === id);
  const cost = rerollCost();
  if (i < 0 || S.money < cost) { sfxPlay('deny'); return; }
  S.money -= cost;
  S.contracts.splice(i, 1, makeContract());
  sfxPlay('ui');
}
export function rerollCost() {
  return Math.ceil(Math.max(25, incomePerSec() * 20));
}

export function offlineEarnings() {
  const el = Math.min(8 * 3600, (Date.now() - (S.lastSeen || Date.now())) / 1000);
  if (el < 60) return 0;
  const earn = incomePerSec() * el * 0.5;
  if (earn > 0) addMoney(earn);
  return { earn, sec: el };
}
export { ensureContracts };
