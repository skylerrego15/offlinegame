// Fully synthesized audio — no sound files, works offline.
let ac = null, master, sfx, mus, noiseBuf;
let droneA, droneB, droneFilter, droneGain, oceanSrc, oceanFilter, oceanGain;
let sfxOn = true, musicOn = true;
let lastRatchet = 0;

function ctx() { return ac; }

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  comp.connect(master);
  sfx = ac.createGain(); sfx.gain.value = sfxOn ? 0.9 : 0; sfx.connect(comp);
  mus = ac.createGain(); mus.gain.value = musicOn ? 0.5 : 0; mus.connect(comp);
  // noise buffer
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // ambient drone
  droneGain = ac.createGain(); droneGain.gain.value = 0.0;
  droneFilter = ac.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 300; droneFilter.Q.value = 3;
  droneA = ac.createOscillator(); droneA.type = 'sawtooth'; droneA.frequency.value = 55;
  droneB = ac.createOscillator(); droneB.type = 'sawtooth'; droneB.frequency.value = 55.6;
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ac.createGain(); lfoG.gain.value = 120; lfo.connect(lfoG); lfoG.connect(droneFilter.frequency);
  droneA.connect(droneFilter); droneB.connect(droneFilter); droneFilter.connect(droneGain); droneGain.connect(mus);
  droneA.start(); droneB.start(); lfo.start();
  // ocean wash
  oceanSrc = ac.createBufferSource(); oceanSrc.buffer = noiseBuf; oceanSrc.loop = true;
  oceanFilter = ac.createBiquadFilter(); oceanFilter.type = 'lowpass'; oceanFilter.frequency.value = 500;
  oceanGain = ac.createGain(); oceanGain.gain.value = 0.0;
  const wl = ac.createOscillator(); wl.frequency.value = 0.12;
  const wlg = ac.createGain(); wlg.gain.value = 0.05; wl.connect(wlg); wlg.connect(oceanGain.gain);
  oceanSrc.connect(oceanFilter); oceanFilter.connect(oceanGain); oceanGain.connect(mus);
  oceanSrc.start(); wl.start();
  setAmbience(0, 'ship');
}

export function setSfx(on) { sfxOn = on; if (sfx) sfx.gain.value = on ? 0.9 : 0; }
export function setMusic(on) { musicOn = on; if (mus) mus.gain.value = on ? 0.5 : 0; }

export function setAmbience(depth, mode) {
  if (!ac) return;
  const t = ac.currentTime;
  const deep = Math.min(1, depth / 3000);
  const f = 55 * Math.pow(0.5, deep * 1.2);
  droneA.frequency.setTargetAtTime(f, t, 0.8);
  droneB.frequency.setTargetAtTime(f * (1.012 + deep * 0.02), t, 0.8);
  droneFilter.frequency.setTargetAtTime(380 - deep * 250, t, 0.8);
  droneGain.gain.setTargetAtTime(mode === 'ship' ? 0.05 : 0.09 + deep * 0.08, t, 0.6);
  oceanGain.gain.setTargetAtTime(mode === 'ship' ? 0.12 : 0.05 * (1 - deep), t, 0.6);
  oceanFilter.frequency.setTargetAtTime(mode === 'ship' ? 700 : 240, t, 0.6);
}

// helpers -------------------------------------------------------------------
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function osc(type, freq, t, dur, peak, dest = sfx, attack = 0.005) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  const g = ac.createGain(); env(g, t, attack, peak, dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + attack + dur + 0.05);
  return o;
}
function noise(t, dur, peak, type = 'lowpass', freq = 1000, q = 1, dest = sfx, attack = 0.005) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  const g = ac.createGain(); env(g, t, attack, peak, dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
  return { s, f, g };
}
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// public SFX -----------------------------------------------------------------
export function sfxPlay(name, a = 0) {
  if (!ac || !sfxOn) return;
  const t = ac.currentTime + 0.005;
  switch (name) {
    case 'ui': osc('triangle', 660, t, 0.08, 0.15); osc('sine', 990, t + 0.03, 0.06, 0.08); break;
    case 'buy':
      osc('triangle', 523, t, 0.1, 0.18); osc('triangle', 784, t + 0.06, 0.14, 0.18); osc('sine', 1568, t + 0.1, 0.2, 0.06); break;
    case 'deny': osc('square', 110, t, 0.15, 0.08); osc('square', 104, t + 0.08, 0.15, 0.08); break;
    case 'coin':
      osc('square', 988, t, 0.06, 0.06); osc('square', 1319, t + 0.06, 0.18, 0.06); break;
    case 'aim': osc('sine', 200 + a * 120, t, 0.03, 0.03); break;
    case 'fire': {
      noise(t, 0.35, 0.7, 'lowpass', 1800);
      const o = osc('sine', 140, t, 0.4, 0.8); o.frequency.exponentialRampToValueAtTime(40, t + 0.35);
      noise(t + 0.05, 0.6, 0.15, 'bandpass', 3000, 2);
      break;
    }
    case 'splash': noise(t, 0.5, 0.35, 'lowpass', 900); noise(t, 0.25, 0.15, 'highpass', 3000); break;
    case 'hit': {
      const n = 64 + Math.min(a, 12) * 2;
      osc('triangle', NOTE(n), t, 0.35, 0.3); osc('sine', NOTE(n + 12), t, 0.5, 0.12); osc('sine', NOTE(n + 19), t + 0.02, 0.6, 0.05);
      noise(t, 0.08, 0.2, 'highpass', 4000);
      break;
    }
    case 'combo': {
      const lvl = Math.min(a, 10);
      const scale = [0, 3, 7, 10, 12, 15, 19, 22, 24, 27, 31];
      for (let i = 0; i <= Math.min(lvl, 6); i++) osc('sawtooth', NOTE(52 + scale[i] + lvl), t + i * 0.045, 0.25, 0.05);
      const s = osc('sine', NOTE(28 + lvl), t, 0.6 + lvl * 0.08, 0.5); s.frequency.exponentialRampToValueAtTime(NOTE(16), t + 0.6);
      if (lvl >= 4) noise(t, 0.8, 0.25, 'bandpass', 600 + lvl * 200, 4);
      if (lvl >= 6) for (let i = 0; i < 4; i++) osc('sine', NOTE(76 + scale[i]), t + 0.2 + i * 0.07, 0.8, 0.05);
      break;
    }
    case 'ichor': osc('sine', 1200, t, 0.1, 0.1); osc('sine', 1800, t + 0.04, 0.12, 0.06); break;
    case 'bump': noise(t, 0.3, 0.5, 'lowpass', 400); osc('sine', 70, t, 0.3, 0.6); break;
    case 'jelly': { const o = osc('sine', 500, t, 0.4, 0.15); o.frequency.exponentialRampToValueAtTime(150, t + 0.4); break; }
    case 'pickup': osc('sine', 880, t, 0.1, 0.12); osc('sine', 1320, t + 0.05, 0.2, 0.1); break;
    case 'zone': {
      osc('sine', 55, t, 2.5, 0.35, sfx, 0.02); osc('triangle', 110, t, 2, 0.12, sfx, 0.02); osc('sine', 164.8, t + 0.05, 2.2, 0.08, sfx, 0.02);
      noise(t, 1.5, 0.08, 'bandpass', 220, 6);
      break;
    }
    case 'ratchet': {
      const now = performance.now();
      if (now - lastRatchet < 50) return;
      lastRatchet = now;
      noise(t, 0.025, 0.12 + a * 0.12, 'bandpass', 2400 + a * 1500, 6);
      break;
    }
    case 'strain': { const o = osc('sawtooth', 70 + a * 60, t, 0.15, 0.06); o.frequency.linearRampToValueAtTime(90 + a * 80, t + 0.15); break; }
    case 'snap': {
      noise(t, 0.4, 0.8, 'highpass', 2000); const o = osc('sawtooth', 800, t, 0.4, 0.3); o.frequency.exponentialRampToValueAtTime(60, t + 0.4);
      break;
    }
    case 'growl': {
      const o = osc('sawtooth', 48, t, 1.0, 0.35, sfx, 0.1); o.frequency.linearRampToValueAtTime(38, t + 1);
      noise(t, 1.0, 0.25, 'lowpass', 300, 4, sfx, 0.1);
      break;
    }
    case 'surface': noise(t, 0.6, 0.4, 'lowpass', 1500); osc('triangle', 392, t + 0.1, 0.3, 0.1); osc('triangle', 523, t + 0.2, 0.4, 0.1); break;
    case 'crack': noise(t, 0.06 + Math.random() * 0.05, 0.5, 'highpass', 2500 + Math.random() * 2000); break;
    case 'riser': {
      const dur = a || 1.5;
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(900, t + dur);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + 0.1);
      const n = noise(t, dur, 0.12, 'bandpass', 500, 3, sfx, dur * 0.9);
      n.f.frequency.exponentialRampToValueAtTime(6000, t + dur);
      break;
    }
    case 'heartbeat': osc('sine', 60, t, 0.15, 0.6); osc('sine', 55, t + 0.22, 0.2, 0.45); break;
    case 'reveal': revealSting(a, t); break;
    case 'tentacle': { noise(t, 1.2, 0.4, 'lowpass', 220, 6, sfx, 0.2); const o = osc('sawtooth', 35, t, 1.2, 0.3, sfx, 0.2); o.frequency.linearRampToValueAtTime(28, t + 1.2); break; }
    case 'slap': noise(t, 0.12, 0.6, 'bandpass', 900, 1); osc('sine', 160, t, 0.12, 0.4); break;
    case 'omen': for (let i = 0; i < 3; i++) osc('triangle', NOTE(45 + i * 7), t + i * 0.12, 1.4, 0.12, sfx, 0.05); break;
    case 'whisper': noise(t, 1.6, 0.12, 'bandpass', 1800, 8, sfx, 0.4); noise(t + 0.3, 1.2, 0.08, 'bandpass', 2600, 10, sfx, 0.4); break;
  }
}

const CHORDS = [
  [0, 4, 7], [0, 4, 7, 12], [0, 4, 7, 11, 14], [0, 3, 7, 10, 14],
  [0, 3, 6, 10, 15], [0, 1, 6, 10, 13], [0, 1, 5, 6, 11, 13], [0, 6, 11, 13, 18, 23],
];
function revealSting(r, t) {
  const root = 57 - r * 2;
  const ch = CHORDS[r] || CHORDS[0];
  ch.forEach((iv, i) => {
    osc(r >= 4 ? 'sawtooth' : 'triangle', NOTE(root + iv), t + i * 0.03, 0.9 + r * 0.25, 0.07 + r * 0.008, sfx, 0.01);
  });
  osc('sine', NOTE(root + 24), t, 1.2, 0.08);
  const b = osc('sine', NOTE(root - 12), t, 1 + r * 0.3, 0.4 + r * 0.05);
  b.frequency.exponentialRampToValueAtTime(NOTE(root - 24), t + 1);
  noise(t, 0.4, 0.3 + r * 0.04, 'lowpass', 1200);
  if (r >= 5) { // choir pad
    for (let i = 0; i < 6; i++) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(root + 12 + ch[i % ch.length]) * (1 + (Math.random() - 0.5) * 0.01);
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
      const g = ac.createGain(); env(g, t, 0.4, 0.05, 2.4);
      o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 3);
    }
  }
  if (r >= 6) { const o = osc('sine', 30, t, 3, 0.6, sfx, 0.05); o.frequency.linearRampToValueAtTime(22, t + 3); }
}

export function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}
export function audioReady() { return !!ac; }
export { ctx };
