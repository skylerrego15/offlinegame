import { R } from './rt.js';
import { S, load, save, stats, ensureContracts } from './state.js';
import { loadAssets } from './assets.js';
import { drawOcean, drawField, drawSurface, drawDarkness, updateField, drawEgg, eggSize } from './ocean.js';
import { layoutShip, drawShip, drawVisit, cannonTip, shipBob } from './ship.js';
import { update as fxUpdate, drawWorld as fxWorld, drawScreen as fxScreen, shakeOffset, isStopped } from './fx.js';
import { initAudio, setAmbience, setSfx, setMusic, sfxPlay } from './audio.js';
import { updateDive, updateReel, updateSystems, resetField, toShip, offlineEarnings, startReel, fireHarpoon } from './game.js';
import { drawReveal } from './reveal.js';
import { initUI, updateUI, revealTap, openPanelFor, showOffline } from './ui.js';
import { clamp, TAU, mixHex, rgba } from './util.js';
import { EGGS } from './data.js';
import { drawCage } from './cage.js';
import { initGL } from './gl.js';
import { S as _S } from './state.js';

const cv = document.getElementById('cv');
const c = cv.getContext('2d');
const app = document.getElementById('app');

function resize() {
  R.W = app.clientWidth;
  R.H = app.clientHeight;
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(R.W * R.dpr);
  cv.height = Math.round(R.H * R.dpr);
  cv.style.width = R.W + 'px';
  cv.style.height = R.H + 'px';
  R.PPM = clamp(R.H / 150, 4.4, 7);
  layoutShip();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------
function updateCamera(dt) {
  const sh = R.ship, PPM = R.PPM;
  let target, k = 4;
  const hp = R.hp;
  if ((R.mode === 'dive' || R.mode === 'reel') && hp) {
    target = hp.y * PPM - R.H * (R.mode === 'reel' ? 0.55 : 0.33);
    if (hp.phase === 'air') target = Math.min(target, sh.mastTop - 70);
    k = R.mode === 'dive' ? 9 : 7;
  } else {
    const maxPan = Math.max(0, sh.bottom + 260 - (sh.mastTop - 70) - R.H * 0.6);
    R.shipPan = clamp(R.shipPan, -40, maxPan);
    target = sh.mastTop - 70 + R.shipPan;
  }
  const prev = R.camY;
  R.camY += (target - R.camY) * Math.min(1, dt * k);
  R.camVY = dt > 0 ? (R.camY - prev) / dt : 0;
}

// ---------------------------------------------------------------------------
// render helpers
// ---------------------------------------------------------------------------
function drawAim() {
  if (R.mode !== 'aim') return;
  const [tx, ty] = cannonTip();
  let x = tx, y = ty - R.camY;
  const dx = Math.sin(R.aimAngle), dy = Math.cos(R.aimAngle);
  c.save();
  for (let i = 0; i < 40; i++) {
    x += dx * 12; y += dy * 12;
    if (x < 0 || x > R.W) break;
    c.globalAlpha = 0.9 * (1 - i / 40);
    c.fillStyle = i % 2 ? '#ffe7b0' : '#fff';
    c.beginPath(); c.arc(x, y, 2.6 - i * 0.04, 0, TAU); c.fill();
  }
  c.restore();
}

function drawHarpoon() {
  const hp = R.hp;
  if (!hp) return;
  const PPM = R.PPM;
  const [cx, cyW] = cannonTip();
  const cy = cyW - R.camY;
  const hx = hp.x * PPM, hy = hp.y * PPM - R.camY;
  const reel = R.mode === 'reel';
  // cable
  const sag = reel ? 0 : Math.min(70, Math.abs(hy - cy) * 0.12);
  c.strokeStyle = reel ? mixHex('#d8d0c0', '#ff3b3b', clamp(hp.tension, 0, 1)) : 'rgba(216,208,192,0.85)';
  c.lineWidth = reel ? 1.6 + hp.tension * 1.4 : 1.4;
  if (reel && hp.tension > 0.7) c.lineWidth += Math.sin(R.t * 60) * 0.6;
  c.beginPath(); c.moveTo(cx, cy);
  c.quadraticCurveTo((cx + hx) / 2 - sag * 0.5, (cy + hy) / 2 + sag, hx, hy - 34);
  c.stroke();
  // the cage, with every egg caught so far piled inside
  const cw = 58;
  const tilt = reel ? Math.sin(R.t * 3) * 0.05 * (1 + hp.tension * 3) : hp.angle * 0.5;
  const lt = stats().light;
  const g = c.createRadialGradient(hx, hy, 4, hx, hy, 70 * lt);
  g.addColorStop(0, 'rgba(255,230,170,0.25)'); g.addColorStop(1, 'rgba(255,230,170,0)');
  c.fillStyle = g; c.beginPath(); c.arc(hx, hy, 70 * lt, 0, TAU); c.fill();
  const sq = hp.squash || 0;
  drawCage(c, hx, hy, cw * (1 + 0.16 * sq * Math.cos(R.t * 40)), _S.cage, hp.eggs, R.t, tilt);
}

function render(dt) {
  c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  const [sx, sy] = shakeOffset();
  c.translate(sx, sy);
  drawOcean(c, dt);
  if (R.field) drawField(c, R.field, R.hp);
  drawShip(c);
  drawVisit(c);
  drawSurface(c);
  drawAim();
  drawHarpoon();
  fxWorld(c);
  if (R.hp && (R.mode === 'dive' || R.mode === 'reel')) drawDarkness(c, R.hp.x * R.PPM, R.hp.y * R.PPM - R.camY);
  else drawDarkness(c, R.W / 2, R.H / 2);
  c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  if (R.mode === 'reveal') drawReveal(c, dt);
  fxScreen(c);
}

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------
let last = performance.now(), saveT = 0, ambT = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  R.t += dt;
  // keep the canvas exactly matched to the visible app area (fixes off-centre drawing on phones)
  if (app.clientWidth !== R.W || app.clientHeight !== R.H) resize();
  try {
    fxUpdate(dt);
    const gdt = isStopped() ? 0 : dt;
    if (R.mode !== 'loading') {
      if (R.mode === 'dive' && R.hp) updateDive(gdt);
      else if (R.mode === 'reel' && R.hp) updateReel(gdt);
      if (R.field) updateField(R.field, gdt);
      updateSystems(dt);
      updateCamera(dt);
      updateUI(dt);
      ambT += dt;
      if (ambT > 0.5) { ambT = 0; setAmbience(Math.max(0, (R.camY + R.H / 2) / R.PPM), R.mode === 'dive' || R.mode === 'reel' ? 'dive' : 'ship'); }
      saveT += dt;
      if (saveT > 10) { saveT = 0; save(); }
    }
    render(dt);
  } catch (e) {
    console.error(e);
    window.__lastError = String(e && e.stack || e);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// input on the world canvas
// ---------------------------------------------------------------------------
let ptr = null;
cv.addEventListener('pointerdown', (e) => {
  initAudio();
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: R.shipPan, moved: 0 };
  const lx = e.clientX - app.getBoundingClientRect().left;
  if (R.mode === 'reveal') revealTap();
  if (R.mode === 'dive') R.steerX = lx / R.PPM;
});
cv.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const lx = e.clientX - app.getBoundingClientRect().left;
  const dy = e.clientY - ptr.y;
  ptr.moved += Math.abs(e.clientX - ptr.x) + Math.abs(dy);
  ptr.x = e.clientX; ptr.y = e.clientY;
  if (R.mode === 'dive') R.steerX = lx / R.PPM;
  else if (R.mode === 'reel') R.power = clamp(R.power - dy / 320, 0, 1);
  else if (R.mode === 'ship') R.shipPan = ptr.pan - (e.clientY - ptr.sy);
});
const up = (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  R.steerX = null;
  if (R.mode === 'ship' && ptr.moved < 10 && !R.panel) {
    const r = app.getBoundingClientRect();
    const wx = e.clientX - r.left, wy = e.clientY - r.top + R.camY - shipBob();
    const room = R.ship.rooms.find((m) => wx >= m.x && wx <= m.x + m.w && wy >= m.y && wy <= m.y + m.h);
    if (room) { sfxPlay('ui'); openPanelFor(room.type); }
  }
  ptr = null;
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);

// keyboard (desktop)
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === ' ') {
    initAudio();
    if (R.mode === 'ship') fireHarpoon();
    else if (R.mode === 'dive' && R.hp && R.hp.phase !== 'air') startReel('manual');
    else if (R.mode === 'reveal') revealTap();
  }
  if (R.mode === 'ship' && e.key === 'ArrowLeft') R.aimAngle = clamp(R.aimAngle - 0.08, -0.85, 0.85);
  if (R.mode === 'ship' && e.key === 'ArrowRight') R.aimAngle = clamp(R.aimAngle + 0.08, -0.85, 0.85);
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
setInterval(() => {
  if (R.mode === 'dive' && !ptr) R.steer = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  if (R.mode === 'reel') { if (keys.ArrowUp) R.power = clamp(R.power + 0.03, 0, 1); if (keys.ArrowDown) R.power = clamp(R.power - 0.03, 0, 1); }
}, 30);

document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  const had = load();
  resize();
  initGL();
  const bar = document.getElementById('loadFill');
  await loadAssets((p) => (bar.style.width = Math.round(p * 100) + '%'));
  ensureContracts();
  initUI();
  resetField();
  R.camY = R.ship.mastTop - 70;
  const go = document.getElementById('loadGo');
  go.classList.remove('hidden');
  document.getElementById('loadMsg').textContent = had ? 'your ship still floats' : 'a ship, a harpoon, and the dark below';
  const start = () => {
    initAudio();
    setSfx(S.settings.sfx); setMusic(S.settings.music);
    document.getElementById('loading').classList.add('gone');
    setTimeout(() => document.getElementById('loading').remove(), 700);
    toShip();
    const off = had ? offlineEarnings() : 0;
    if (off && off.earn > 0) showOffline(off.earn, off.sec);
    save();
  };
  go.addEventListener('click', start, { once: true });
  R.mode = 'ship-wait';
  requestAnimationFrame(frame);
}
boot();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new version just took over: reload into it (only if an older one was running)
    if (!hadController || reloaded) return;
    reloaded = true;
    try { save(); } catch (e) {}
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

// debug hooks for automated tests
window.__game = { R, get S() { return S; }, stats, fireHarpoon, startReel };
