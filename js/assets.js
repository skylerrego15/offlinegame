import { CREATURES } from './data.js';

export const IMG = { creatures: {}, eggs: [] };
const mutCache = new Map();
const urlCache = new Map();

function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => { console.warn('missing', src); res(null); };
    im.src = src;
  });
}

export async function loadAssets(onProgress) {
  const jobs = [];
  let done = 0;
  const total = CREATURES.length + 8;
  const tick = () => { done++; onProgress && onProgress(done / total); };
  for (const c of CREATURES) {
    jobs.push(loadImg(`assets/creatures/${c.id}.webp`).then((im) => { IMG.creatures[c.id] = im; tick(); }));
  }
  for (let i = 1; i <= 8; i++) {
    jobs.push(loadImg(`assets/eggs/egg${i}.webp`).then((im) => { IMG.eggs[i] = im; tick(); }));
  }
  await Promise.all(jobs);
}

// ---------------------------------------------------------------------------
// Mutation recolors, baked once per creature+mutation into a canvas
// ---------------------------------------------------------------------------
function ramp(stops, t) {
  // stops: [[t, r,g,b], ...]
  if (t <= stops[0][0]) return stops[0].slice(1);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
    }
  }
  return stops[stops.length - 1].slice(1);
}
const RAMPS = {
  gilded: [[0, 40, 20, 0], [0.35, 150, 90, 10], [0.7, 255, 205, 70], [1, 255, 252, 225]],
  bloodborn: [[0, 15, 0, 2], [0.4, 120, 0, 15], [0.75, 235, 30, 50], [1, 255, 190, 190]],
  abyssal: [[0, 6, 0, 20], [0.4, 50, 10, 120], [0.75, 140, 70, 255], [1, 230, 205, 255]],
  spectral: [[0, 0, 40, 60], [0.5, 60, 200, 240], [1, 230, 255, 255]],
};
function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t];
    case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q];
  }
}

export function creatureImg(id, mut) {
  const base = IMG.creatures[id];
  if (!base || !mut || mut === 'normal') return base;
  const key = id + ':' + mut;
  if (mutCache.has(key)) return mutCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = base.naturalWidth; cv.height = base.naturalHeight;
  const c = cv.getContext('2d');
  c.drawImage(base, 0, 0);
  let data;
  try { data = c.getImageData(0, 0, cv.width, cv.height); } catch (e) { mutCache.set(key, base); return base; }
  const d = data.data, W = cv.width;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const L = Math.min(1, 0.299 * r + 0.587 * g + 0.114 * b);
    let o;
    if (mut === 'albino') {
      const v = 0.35 + L * 0.75;
      o = [v * 255, v * 248, v * 242];
    } else if (mut === 'iridescent') {
      const x = (i / 4) % W;
      const h = (x / W + L * 0.5) % 1;
      o = hsv2rgb(h, 0.65, 0.35 + L * 0.7).map((v) => Math.min(255, v * 255));
    } else if (mut === 'void') {
      const v = Math.pow(L, 3.2);
      o = [v * 255 + 8, v * 240 + 4, v * 255 + 18];
      if (Math.random() < 0.0035) o = [255, 255, 255];
    } else {
      const rp = RAMPS[mut];
      o = rp ? ramp(rp, Math.min(1, L * 1.25)) : [d[i], d[i + 1], d[i + 2]];
      if (mut === 'spectral') d[i + 3] = d[i + 3] * (0.55 + L * 0.4);
    }
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
  }
  c.putImageData(data, 0, 0);
  mutCache.set(key, cv);
  return cv;
}

// data-URL for DOM <img> usage (cached)
export function creatureURL(id, mut) {
  if (!mut || mut === 'normal') return `assets/creatures/${id}.webp`;
  const key = id + ':' + mut;
  if (urlCache.has(key)) return urlCache.get(key);
  const im = creatureImg(id, mut);
  let url = `assets/creatures/${id}.webp`;
  try {
    // shrink for DOM use
    const cv = document.createElement('canvas');
    const s = Math.min(1, 260 / im.width);
    cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    url = cv.toDataURL('image/png');
  } catch (e) {}
  urlCache.set(key, url);
  return url;
}
export const eggURL = (tier) => `assets/eggs/egg${tier}.webp`;
