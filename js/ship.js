import { R } from './rt.js';
import { S } from './state.js';
import { CREW, CREATURE_BY_ID, RARITIES } from './data.js';
import { creatureImg } from './assets.js';
import { TAU, clamp, seeded, lerp } from './util.js';

const ROOM_H = 48;
const DECK = -26;

export function layoutShip() {
  const W = R.W;
  const hullX = Math.round(W * 0.04);
  const hullW = Math.round(W * 0.72);
  const L = hullX, Rr = hullX + hullW;
  const roomX0 = L + 10, roomX1 = Rr - 30;
  const roomW = (roomX1 - roomX0) / 3;
  const rows = Math.max(1, Math.ceil(S.rooms.length / 3));
  const rooms = S.rooms.map((type, i) => ({
    type, idx: i,
    x: roomX0 + (i % 3) * roomW,
    y: DECK + 8 + Math.floor(i / 3) * ROOM_H,
    w: roomW, h: ROOM_H,
  }));
  const bottom = DECK + 8 + rows * ROOM_H + 16;
  R.ship = {
    hullX, hullW, L, Rr, rows, rooms, bottom, roomW,
    deckY: DECK,
    cannonX: Rr + 4,
    cannonY: DECK - 8,
    mastTop: DECK - 210,
  };
  return R.ship;
}

export function cannonTip() {
  const sh = R.ship;
  const a = R.aimAngle;
  const bob = shipBob();
  return [sh.cannonX + Math.sin(a) * 26 + 10, sh.cannonY + bob + Math.cos(a) * 26];
}
export function shipBob() { return Math.sin(R.t * 1.1) * 2.2; }

// ---------------------------------------------------------------------------
function hullPath(c, sh, top, bot) {
  const L = sh.L, Rr = sh.Rr;
  c.beginPath();
  c.moveTo(L - 10, top - 18);
  c.lineTo(L + 70, top - 18);
  c.lineTo(L + 76, top);
  c.lineTo(Rr - 8, top);
  c.lineTo(Rr + 22, top - 14);
  c.quadraticCurveTo(Rr + 6, bot - 20, Rr - 36, bot);
  c.lineTo(L + 36, bot);
  c.quadraticCurveTo(L - 12, bot - 10, L - 10, top - 18);
  c.closePath();
}

function sailor(c, x, y, col, face, walk, act, scale = 1, hat = true) {
  c.save();
  c.translate(x, y);
  c.scale(face * scale, scale);
  const sw = Math.sin(walk) * 3;
  c.strokeStyle = '#1b130e'; c.lineWidth = 2.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-1.5, -8); c.lineTo(-1.5 + sw, 0); c.moveTo(1.5, -8); c.lineTo(1.5 - sw, 0); c.stroke();
  c.fillStyle = col;
  c.beginPath(); c.roundRect ? c.roundRect(-4.5, -17, 9, 10, 2.5) : c.rect(-4.5, -17, 9, 10); c.fill();
  // arm
  c.strokeStyle = col; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(2, -15);
  if (act === 'crank') { const a = R.t * 9; c.lineTo(5 + Math.cos(a) * 3, -12 + Math.sin(a) * 3); }
  else if (act === 'pray') c.lineTo(5, -19);
  else c.lineTo(4 + sw * 0.4, -9);
  c.stroke();
  c.fillStyle = '#d9b99a';
  c.beginPath(); c.arc(0, -20.5, 3.8, 0, TAU); c.fill();
  if (hat) {
    c.fillStyle = '#1d1a24';
    c.beginPath(); c.moveTo(-5.5, -22.5); c.lineTo(5.5, -22.5); c.lineTo(0, -27.5); c.closePath(); c.fill();
  }
  c.restore();
}

function lamp(c, x, y, r = 40, a = 0.35) {
  const fl = 0.85 + Math.sin(R.t * 13 + x) * 0.07 + Math.sin(R.t * 5.3 + y) * 0.06;
  const g = c.createRadialGradient(x, y, 1, x, y, r * fl);
  g.addColorStop(0, `rgba(255,190,110,${a * fl})`);
  g.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * fl, 0, TAU); c.fill();
  c.fillStyle = '#ffd59a'; c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill();
}

function drawRoom(c, rm, oy, tankFish, trophy) {
  const x = rm.x, y = rm.y + oy, w = rm.w, h = rm.h;
  // back wall
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3a2719'); g.addColorStop(1, '#22160e');
  c.fillStyle = g; c.fillRect(x + 1, y + 1, w - 2, h - 2);
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + 1, y + (i * h) / 4); c.lineTo(x + w - 1, y + (i * h) / 4); c.stroke(); }
  const fy = y + h - 5; // floor
  switch (rm.type) {
    case 'tank': {
      const tx = x + 5, ty = y + 6, tw = w - 10, th = h - 14;
      const wg = c.createLinearGradient(0, ty, 0, ty + th);
      wg.addColorStop(0, 'rgba(60,170,190,0.85)'); wg.addColorStop(1, 'rgba(10,50,70,0.95)');
      c.fillStyle = wg; c.fillRect(tx, ty, tw, th);
      c.save(); c.beginPath(); c.rect(tx, ty, tw, th); c.clip();
      tankFish.forEach((f, i) => {
        const im = creatureImg(f.id, f.mut);
        if (!im) return;
        const sp = 0.25 + ((f.uid * 37) % 10) / 30;
        const ph = R.t * sp + f.uid;
        const fx = tx + tw * (0.5 + 0.38 * Math.sin(ph));
        const face = Math.cos(ph) > 0 ? 1 : -1;
        const fh = Math.min(th * 0.45, 9 + CREATURE_BY_ID[f.id].r * 1.5);
        const fw = (fh * im.width) / im.height;
        const fyy = ty + th * (0.25 + (i % 4) * 0.18) + Math.sin(ph * 2) * 2;
        c.save(); c.translate(fx, fyy); c.scale(-face, 1);
        c.drawImage(im, -fw / 2, -fh / 2, Math.min(fw, tw * 0.7), fh);
        c.restore();
      });
      c.fillStyle = 'rgba(220,255,255,0.5)';
      for (let i = 0; i < 4; i++) { const k = (R.t * 0.4 + i * 0.27 + rm.idx * 0.1) % 1; c.beginPath(); c.arc(tx + tw * (0.15 + i * 0.22), ty + th * (1 - k), 1.4, 0, TAU); c.fill(); }
      c.restore();
      c.strokeStyle = 'rgba(200,240,255,0.45)'; c.lineWidth = 1.5; c.strokeRect(tx, ty, tw, th);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(tx + 3, ty + 2, 4, th - 4);
      break;
    }
    case 'bunk':
      c.fillStyle = '#5a3d27';
      for (let i = 0; i < 2; i++) { c.fillRect(x + 6 + i * (w / 2), y + 14, w / 2 - 12, 4); c.fillRect(x + 6 + i * (w / 2), y + 30, w / 2 - 12, 4); }
      c.fillStyle = '#7d6b5a';
      for (let i = 0; i < 2; i++) { c.fillRect(x + 8 + i * (w / 2), y + 10, 10, 4); c.fillRect(x + 8 + i * (w / 2), y + 26, 10, 4); }
      lamp(c, x + w / 2, y + 8, 30, 0.25);
      break;
    case 'winch': {
      const cx = x + w * 0.62, cy = y + h * 0.48, rr = h * 0.32;
      const spin = R.mode === 'reel' ? R.t * 12 * (0.3 + R.power) : R.t * 0.3;
      c.strokeStyle = '#b89a70'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.stroke();
      for (let i = 0; i < 6; i++) { const a = spin + (i / 6) * TAU; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); c.stroke(); }
      c.fillStyle = '#6b5440'; c.beginPath(); c.arc(cx, cy, 4, 0, TAU); c.fill();
      c.fillStyle = '#3c2a1c'; c.fillRect(x + 6, y + h * 0.6, w * 0.3, h * 0.3);
      lamp(c, x + 10, y + 10, 26, 0.25);
      break;
    }
    case 'shrine': {
      const cx = x + w / 2, cy = y + h * 0.42;
      c.save(); c.globalCompositeOperation = 'lighter';
      const pg = c.createRadialGradient(cx, cy, 1, cx, cy, h * 0.6);
      pg.addColorStop(0, `rgba(180,120,255,${0.35 + Math.sin(R.t * 2) * 0.1})`); pg.addColorStop(1, 'rgba(120,60,255,0)');
      c.fillStyle = pg; c.beginPath(); c.arc(cx, cy, h * 0.6, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(200,160,255,0.7)'; c.lineWidth = 1.2;
      c.save(); c.translate(cx, cy); c.rotate(R.t * 0.4);
      c.beginPath(); c.arc(0, 0, h * 0.26, 0, TAU); c.stroke();
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, b = ((i + 2) / 5) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * h * 0.26, Math.sin(a) * h * 0.26); c.lineTo(Math.cos(b) * h * 0.26, Math.sin(b) * h * 0.26); c.stroke(); }
      c.restore();
      c.restore();
      for (let i = 0; i < 4; i++) { const cxp = x + 8 + i * ((w - 16) / 3); c.fillStyle = '#e8e0cc'; c.fillRect(cxp - 1.5, fy - 7, 3, 7); lamp(c, cxp, fy - 9, 10, 0.5); }
      break;
    }
    case 'refinery': {
      for (let i = 0; i < 2; i++) {
        const vx = x + 8 + i * (w / 2 - 2), vy = y + 10, vw = w / 2 - 14, vh = h - 18;
        c.fillStyle = '#2b2b22'; c.fillRect(vx, vy, vw, vh);
        const lvl = 0.5 + Math.sin(R.t * 0.7 + i) * 0.15;
        c.fillStyle = 'rgba(110,255,120,0.6)'; c.fillRect(vx + 2, vy + vh * (1 - lvl), vw - 4, vh * lvl - 2);
        c.strokeStyle = '#7a7a62'; c.lineWidth = 1.5; c.strokeRect(vx, vy, vw, vh);
      }
      c.strokeStyle = '#6a6a55'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w / 2 - 6, y + 14); c.lineTo(x + w / 2 + 6, y + 14); c.stroke();
      break;
    }
    case 'trophy': {
      const cx = x + w / 2;
      c.fillStyle = '#6b5a3c'; c.fillRect(cx - 12, fy - 10, 24, 10);
      if (trophy) {
        const im = creatureImg(trophy.id, trophy.mut);
        if (im) {
          const fh = h * 0.45, fw = Math.min(w * 0.85, (fh * im.width) / im.height);
          c.save(); c.globalCompositeOperation = 'lighter';
          const tg = c.createRadialGradient(cx, fy - 22, 1, cx, fy - 22, w * 0.5);
          tg.addColorStop(0, 'rgba(255,210,120,0.35)'); tg.addColorStop(1, 'rgba(255,210,120,0)');
          c.fillStyle = tg; c.fillRect(x, y, w, h); c.restore();
          c.drawImage(im, cx - fw / 2, fy - 12 - fh + Math.sin(R.t) * 1.5, fw, fh);
        }
      }
      lamp(c, x + 8, y + 9, 22, 0.3); lamp(c, x + w - 8, y + 9, 22, 0.3);
      break;
    }
  }
  c.strokeStyle = '#120b07'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
}

export function drawShip(c) {
  const sh = R.ship;
  const oy = -R.camY + shipBob();
  const top = sh.deckY + oy, bot = sh.bottom + oy;
  if (bot < -20 || sh.mastTop + oy > R.H + 20) return;
  const L = sh.L, Rr = sh.Rr;

  // masts + sails (behind hull)
  const masts = [[L + sh.hullW * 0.36, 210], [L + sh.hullW * 0.68, 175]];
  masts.forEach(([mx, mh], i) => {
    c.strokeStyle = '#2a1d14'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(mx, top); c.lineTo(mx, top - mh); c.stroke();
    c.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      const yy = top - mh * (0.85 - k * 0.38), half = 42 - k * 4 - i * 6;
      c.beginPath(); c.moveTo(mx - half, yy); c.lineTo(mx + half, yy); c.stroke();
      // tattered sail
      const billow = Math.sin(R.t * 0.8 + i + k) * 4;
      c.fillStyle = 'rgba(70,64,52,0.92)';
      c.beginPath(); c.moveTo(mx - half + 2, yy + 2); c.lineTo(mx + half - 2, yy + 2);
      const sb = yy + mh * 0.3;
      c.quadraticCurveTo(mx + half + billow, (yy + sb) / 2, mx + half - 6, sb);
      for (let s = 6; s >= 0; s--) { const sx = mx - half + 6 + ((half * 2 - 12) * s) / 6; c.lineTo(sx, sb - (s % 2 ? 7 : 0) - ((s * 7) % 5)); }
      c.quadraticCurveTo(mx - half + billow, (yy + sb) / 2, mx - half + 2, yy + 2);
      c.fill();
    }
  });
  // crow's nest
  const nx = masts[0][0], ny = top - masts[0][1] + 14;
  c.fillStyle = '#3a2819'; c.fillRect(nx - 12, ny, 24, 10);
  // rigging
  c.strokeStyle = 'rgba(20,14,10,0.7)'; c.lineWidth = 1;
  c.beginPath();
  c.moveTo(L - 6, top - 18); c.lineTo(masts[0][0], top - masts[0][1]); c.lineTo(masts[1][0], top - masts[1][1]); c.lineTo(Rr + 22, top - 14);
  c.stroke();
  // flag
  c.fillStyle = '#5a1420';
  c.beginPath(); c.moveTo(masts[0][0], top - masts[0][1]);
  for (let i = 0; i <= 6; i++) c.lineTo(masts[0][0] + i * 5, top - masts[0][1] + Math.sin(R.t * 4 + i) * 2.5 + 2);
  c.lineTo(masts[0][0] + 30, top - masts[0][1] + 14); c.lineTo(masts[0][0], top - masts[0][1] + 14); c.fill();

  // hull body
  hullPath(c, sh, top, bot);
  const hg = c.createLinearGradient(0, top, 0, bot);
  hg.addColorStop(0, '#4b3020'); hg.addColorStop(1, '#22150d');
  c.fillStyle = hg; c.fill();
  c.save(); hullPath(c, sh, top, bot); c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
  for (let y = top - 18; y < bot; y += 7) { c.beginPath(); c.moveTo(L - 20, y); c.lineTo(Rr + 30, y); c.stroke(); }
  // rooms (cutaway)
  const tanks = sh.rooms.filter((r) => r.type === 'tank');
  let best = null;
  for (const f of S.aquarium) if (!best || f.value > best.value) best = f;
  sh.rooms.forEach((rm) => {
    let fish = [];
    if (rm.type === 'tank') {
      const ti = tanks.indexOf(rm);
      fish = S.aquarium.slice(ti * 4, ti * 4 + 4);
    }
    drawRoom(c, rm, oy, fish, best);
  });
  c.restore();
  hullPath(c, sh, top, bot);
  c.strokeStyle = '#0d0805'; c.lineWidth = 3; c.stroke();
  // deck rail
  c.strokeStyle = '#5c4129'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(L + 76, top - 9); c.lineTo(Rr - 8, top - 9); c.stroke();
  for (let x = L + 80; x < Rr - 8; x += 12) { c.beginPath(); c.moveTo(x, top); c.lineTo(x, top - 9); c.stroke(); }
  // stern cabin
  c.fillStyle = '#3b271a'; c.fillRect(L - 4, top - 52, 70, 34);
  c.fillStyle = '#2a1b12'; c.beginPath(); c.moveTo(L - 10, top - 52); c.lineTo(L + 72, top - 52); c.lineTo(L + 62, top - 62); c.lineTo(L, top - 62); c.fill();
  for (let i = 0; i < 3; i++) { c.fillStyle = '#ffcc80'; c.fillRect(L + 6 + i * 20, top - 44, 10, 10); lamp(c, L + 11 + i * 20, top - 39, 18, 0.35); }
  // hanging lanterns on deck
  lamp(c, L + 110, top - 30, 34, 0.35);
  lamp(c, Rr - 40, top - 26, 30, 0.3);

  // harpoon cannon
  const a = R.aimAngle;
  const cx = sh.cannonX, cy = sh.cannonY + shipBob() - R.camY;
  c.fillStyle = '#2e2a26'; c.fillRect(cx - 10, cy - 2, 20, 10);
  c.save(); c.translate(cx + 10, cy); c.rotate(-a);
  c.fillStyle = '#5a5650'; c.fillRect(-5, 0, 10, 26);
  c.fillStyle = '#8a857c'; c.fillRect(-6, 22, 12, 5);
  if (R.mode === 'ship' || R.mode === 'aim') {
    c.fillStyle = '#c9c2b2';
    c.beginPath(); c.moveTo(-2, 26); c.lineTo(0, 40); c.lineTo(2, 26); c.fill();
  }
  c.restore();

  // crew
  drawCrew(c, oy, nx, ny);
  // captain
  const capX = cx - 14, capY = top;
  sailor(c, capX, capY, '#7a1626', 1, R.mode === 'aim' ? R.t * 3 : 0, R.mode === 'reel' ? 'crank' : 'idle', 1.15);
}

function drawCrew(c, oy, nx, ny) {
  const sh = R.ship;
  const byType = {};
  sh.rooms.forEach((r) => (byType[r.type] = byType[r.type] || []).push(r));
  const shown = new Map();
  const deckL = sh.L + 84, deckR = sh.Rr - 34;
  let nestUsed = false;
  for (const role of CREW) {
    const n = S.crew[role.id];
    for (let i = 0; i < n; i++) {
      const rnd = seeded(role.id.length * 1000 + i * 31 + 7);
      const seed = rnd() * 100;
      const sp = 0.25 + rnd() * 0.4;
      let room = null;
      let spot = null;
      if (role.room === 'nest' && !nestUsed) { nestUsed = true; spot = 'nest'; }
      else if (role.room !== 'deck' && role.room !== 'nest' && byType[role.room]) room = byType[role.room][i % byType[role.room].length];
      else if (role.room !== 'deck' && role.room !== 'nest' && byType.bunk) room = byType.bunk[i % byType.bunk.length];
      if (spot === 'nest') {
        sailor(c, nx + Math.sin(R.t * 0.5) * 4, ny, role.color, Math.sin(R.t * 0.3) > 0 ? 1 : -1, 0, 'idle', 0.9);
        continue;
      }
      if (room) {
        const cnt = shown.get(room) || 0;
        if (cnt >= 4) continue;
        shown.set(room, cnt + 1);
        const ph = R.t * sp + seed;
        let x = room.x + 10 + (room.w - 20) * (0.5 + 0.5 * Math.sin(ph));
        let act = 'walk', face = Math.cos(ph) > 0 ? 1 : -1, walk = R.t * 8 + seed;
        if (room.type === 'winch' && R.mode === 'reel' && cnt === 0) { x = room.x + room.w * 0.42; act = 'crank'; face = 1; walk = 0; }
        if (room.type === 'shrine' && Math.sin(ph * 0.5) > 0.3) { act = 'pray'; walk = 0; x = room.x + 10 + (room.w - 20) * (0.2 + 0.6 * ((seed * 13) % 1)); }
        if (room.type === 'bunk' && Math.sin(ph * 0.3) > 0.5) { // sleeping
          c.fillStyle = role.color; c.fillRect(room.x + 10 + (cnt % 2) * (room.w / 2), room.y + oy + (cnt < 2 ? 9 : 25), 12, 5);
          c.fillStyle = 'rgba(220,220,255,0.6)'; c.font = '8px Georgia'; c.fillText('z', room.x + 24 + (cnt % 2) * (room.w / 2), room.y + oy + (cnt < 2 ? 6 : 22) - (R.t * 6 % 6));
          continue;
        }
        sailor(c, x, room.y + oy + room.h - 4, role.color, face, act === 'walk' ? walk : 0, act, 0.85);
      } else {
        const ph = R.t * sp + seed;
        const x = deckL + (deckR - deckL) * (0.5 + 0.5 * Math.sin(ph));
        sailor(c, x, sh.deckY + oy, role.color, Math.cos(ph) > 0 ? 1 : -1, R.t * 8 + seed, role.id === 'gunner' && R.mode === 'dive' ? 'pray' : 'walk', 0.9);
      }
    }
  }
}

// tentacle visitation drawn over the ship
export function drawVisit(c) {
  const v = R.visit;
  if (!v) return;
  const sh = R.ship;
  const baseX = sh.L + sh.hullW * v.xf, baseY = 30 - R.camY;
  const k = v.phase === 'rise' ? clamp(v.t / 1.2, 0, 1) : v.phase === 'grab' ? 1 : clamp(1 - v.t / 0.8, 0, 1);
  const hgt = (130 + 30 * Math.sin(R.t * 2)) * k;
  c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = pass ? '#6b2a4a' : '#170610';
    c.beginPath(); c.moveTo(baseX, baseY);
    for (let i = 1; i <= 16; i++) {
      const f = i / 16;
      c.lineWidth = (pass ? 16 : 24) * (1 - f * 0.85);
      c.lineTo(baseX + Math.sin(f * 5 + R.t * 3) * 28 * f, baseY - hgt * f * 1.6);
    }
    c.stroke();
  }
  // suckers
  c.fillStyle = '#e0b8c8';
  for (let i = 2; i < 14; i += 2) {
    const f = i / 16;
    c.beginPath(); c.arc(baseX + Math.sin(f * 5 + R.t * 3) * 28 * f + 5, baseY - hgt * f * 1.6, 2.5 * (1 - f), 0, TAU); c.fill();
  }
  v.screenX = baseX; v.screenY = baseY - hgt * 1.0;
}
