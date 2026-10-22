// Realistic branching lightning: midpoint-displaced main channel + forks,
// rendered in layered additive passes (wide halo -> glow -> hot core).
import { rand } from './util.js';

function channel(x0, y0, x1, y1, rough, detail) {
  let pts = [[x0, y0], [x1, y1]];
  let amp = Math.hypot(x1 - x0, y1 - y0) * rough;
  for (let lvl = 0; lvl < detail; lvl++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      const o = (Math.random() - 0.5) * amp;
      next.push([mx - (dy / l) * o, my + (dx / l) * o], pts[i + 1]);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}

export function makeBolt(x0, y0, x1, y1, depth = 2) {
  const main = channel(x0, y0, x1, y1, 0.22, 7);
  const paths = [{ pts: main, w: 1, a: 1 }];
  if (depth > 0) {
    const forks = 3 + Math.floor(Math.random() * 4);
    for (let f = 0; f < forks; f++) {
      const i = Math.floor(rand(0.1, 0.8) * main.length);
      const [sx, sy] = main[i];
      const [nx, ny] = main[Math.min(main.length - 1, i + 4)];
      const ang = Math.atan2(ny - sy, nx - sx) + (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.9);
      const len = Math.hypot(x1 - x0, y1 - y0) * rand(0.12, 0.32);
      const sub = makeBolt(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, depth - 1);
      for (const p of sub.paths) paths.push({ pts: p.pts, w: p.w * 0.45, a: p.a * 0.6 });
    }
  }
  return { paths, born: performance.now() };
}

function stroke(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
}

// intensity 0..1 ; tint = halo colour
export function drawBolt(c, bolt, intensity = 1, tint = '#9fc8ff', scale = 1) {
  if (intensity <= 0.01) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round'; c.lineJoin = 'round';
  const passes = [
    [26, 0.045, tint], [13, 0.09, tint], [6, 0.22, '#cfe4ff'], [2.6, 0.75, '#f4f8ff'], [1.1, 1, '#ffffff'],
  ];
  for (const [w, a, col] of passes) {
    c.strokeStyle = col;
    for (const p of bolt.paths) {
      c.globalAlpha = Math.min(1, a * p.a * intensity);
      c.lineWidth = Math.max(0.6, w * p.w * scale);
      stroke(c, p.pts);
    }
  }
  c.restore();
}
