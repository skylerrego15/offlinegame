// Harpoon cages: the thing at the end of the line that eggs get scooped into.
import { IMG } from './assets.js';
import { TAU, rgba } from './util.js';

// Buy once, keep forever (even through the Offering). The equipped cage's boosts apply.
export const CAGES = [
  { name: 'Rusted Cage', cost: 0, aqua: 1, sell: 1, luck: 0, mut: 1, frame: '#5a3d26', bar: '#8a6440', glow: null, lore: 'Your first cage. It creaks when it fills.' },
  { name: 'Iron Cage', cost: 5e5, aqua: 2, sell: 1, luck: 0, mut: 1, frame: '#3d4148', bar: '#8d939c', glow: null, lore: 'Honest iron. Doubles what your aquarium earns.' },
  { name: 'Brass Bell Cage', cost: 5e6, aqua: 2, sell: 1.5, luck: 0.1, mut: 1, frame: '#6b4f12', bar: '#d6a93a', glow: '#ffd34d', dome: true, lore: 'A diving bell, gutted. It still rings.' },
  { name: 'Bone Cage', cost: 5e7, aqua: 3, sell: 1.5, luck: 0.25, mut: 1, frame: '#8c7f66', bar: '#ece2c8', glow: '#e8dcc0', ribs: true, lore: 'Ribcage of something that drowned standing up.' },
  { name: 'Coral Reliquary', cost: 5e8, aqua: 4, sell: 2, luck: 0.35, mut: 1.25, frame: '#1d5a5a', bar: '#ff7a95', glow: '#3dffc8', dome: true, lore: 'Living coral grows the bars back when they break.' },
  { name: 'Obsidian Cage', cost: 5e9, aqua: 6, sell: 3, luck: 0.5, mut: 1.5, frame: '#0d0a14', bar: '#3a2a55', glow: '#b45cff', lore: 'Cut from the glass of a vent that went cold.' },
  { name: 'Blood-Iron Cage', cost: 5e10, aqua: 10, sell: 5, luck: 0.75, mut: 2, frame: '#2a0508', bar: '#a3101e', glow: '#ff2b4a', lore: 'Forged in a furnace fed with something still beating.' },
  { name: 'The Eldritch Cage', cost: 1e12, aqua: 20, sell: 10, luck: 1.5, mut: 3, frame: '#06140f', bar: '#3dffc8', glow: '#3dffc8', eye: true, lore: 'It is not a cage. It is a mouth that agreed to hold things.' },
];

export function cageBonuses(cg) {
  const out = [];
  if (cg.aqua > 1) out.push(`x${cg.aqua} aquarium cash`);
  if (cg.sell > 1) out.push(`x${cg.sell} sell value`);
  if (cg.luck) out.push(`+${Math.round(cg.luck * 100)}% luck`);
  if (cg.mut > 1) out.push(`x${cg.mut} mutation chance`);
  return out.length ? out.join(' · ') : 'no bonus';
}

// draw a cage centred at (x, y), w px wide, holding `eggs` (array of tiers)
export function drawCage(c, x, y, w, idx, eggs = [], t = 0, tilt = 0) {
  const cg = CAGES[idx] || CAGES[0];
  const h = w * 0.82;
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  if (cg.glow) {
    const g = c.createRadialGradient(0, 0, w * 0.2, 0, 0, w * 1.1);
    g.addColorStop(0, rgba(cg.glow, 0.28 + 0.08 * Math.sin(t * 3)));
    g.addColorStop(1, rgba(cg.glow, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, w * 1.1, 0, TAU); c.fill();
  }
  const L = -w / 2, T = -h / 2, R = w / 2, B = h / 2;
  // back bars
  c.strokeStyle = rgba(cg.bar, 0.45); c.lineWidth = Math.max(1, w * 0.03);
  for (let i = 1; i < 5; i++) { const bx = L + (w * i) / 5 + w * 0.05; c.beginPath(); c.moveTo(bx, T); c.lineTo(bx, B); c.stroke(); }
  // eggs piled inside (lowest tier first so the best sit on top)
  if (eggs.length) {
    const sorted = eggs.slice().sort((a, b) => a - b);
    const n = sorted.length;
    const iw = w * 0.86, ih = h * 0.8;
    const s = Math.max(w * 0.14, w * 0.36 * Math.min(1, Math.sqrt(5 / n)));
    const cols = Math.max(1, Math.floor(iw / (s * 0.62)));
    c.save();
    c.beginPath(); c.rect(L + w * 0.07, T + h * 0.06, iw, h * 0.9); c.clip();
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const off = row % 2 ? s * 0.3 : 0;
      const ex = L + w * 0.07 + s * 0.38 + off + col * ((iw - s * 0.76 - s * 0.3) / Math.max(1, cols - 1 || 1));
      const ey = B - h * 0.06 - s * 0.42 - row * s * 0.5;
      if (ey < T - s) break;
      const im = IMG.eggs[sorted[i]];
      if (!im) continue;
      const eh = s, ew = (eh * im.naturalWidth) / im.naturalHeight;
      c.save(); c.translate(ex, ey); c.rotate(Math.sin(i * 2.3 + t * 2) * 0.12);
      c.drawImage(im, -ew / 2, -eh / 2, ew, eh);
      c.restore();
    }
    c.restore();
  }
  // frame
  c.lineJoin = 'round';
  c.fillStyle = cg.frame;
  const plate = Math.max(2, h * 0.11);
  c.fillRect(L - w * 0.04, B - plate, w * 1.08, plate);
  if (cg.dome) {
    c.strokeStyle = cg.bar; c.lineWidth = Math.max(1.5, w * 0.05);
    c.beginPath(); c.ellipse(0, T, w * 0.52, h * 0.32, 0, Math.PI, TAU); c.stroke();
  }
  c.fillRect(L - w * 0.04, T - plate * 0.5, w * 1.08, plate);
  // front bars
  c.strokeStyle = cg.bar; c.lineWidth = Math.max(1.5, w * 0.045); c.lineCap = 'round';
  for (let i = 0; i <= 4; i++) {
    const bx = L + (w * i) / 4;
    c.beginPath();
    if (cg.ribs) { c.moveTo(bx, B - plate); c.quadraticCurveTo(bx + (i < 2 ? -1 : i > 2 ? 1 : 0) * w * 0.08, 0, bx, T); }
    else { c.moveTo(bx, B - plate); c.lineTo(bx, T); }
    c.stroke();
  }
  c.lineWidth = Math.max(1, w * 0.03);
  c.beginPath(); c.moveTo(L, 0); c.lineTo(R, 0); c.stroke();
  // shackle on top
  c.strokeStyle = cg.frame === '#0d0a14' ? '#5a4a7a' : cg.bar; c.lineWidth = Math.max(1.5, w * 0.05);
  const top = cg.dome ? T - h * 0.32 : T - plate * 0.5;
  c.beginPath(); c.arc(0, top - w * 0.07, w * 0.08, 0, TAU); c.stroke();
  if (cg.eye) {
    const open = 0.6 + 0.4 * Math.abs(Math.sin(t * 0.8));
    c.fillStyle = '#e9dcc0'; c.beginPath(); c.ellipse(0, B - plate / 2, w * 0.16, plate * 0.45 * open, 0, 0, TAU); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, B - plate / 2, w * 0.025, plate * 0.4 * open, 0, 0, TAU); c.fill();
  }
  c.restore();
  return top - w * 0.07; // y offset of the shackle (for the line)
}

const iconCache = {};
export function cageIcon(idx) {
  if (iconCache[idx]) return iconCache[idx];
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 96;
  drawCage(cv.getContext('2d'), 48, 54, 62, idx, [], 0);
  return (iconCache[idx] = cv.toDataURL());
}
