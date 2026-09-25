// Lightweight canvas charts: OEE gauge ring and dual-series trend chart.
import { oeeColor } from './util.js';

function fit(canvas, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = w ?? canvas.clientWidth, ch = h ?? canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [g, cw, ch];
}

export function drawGauge(canvas, value, label = 'OEE') {
  const [g, w, h] = fit(canvas, 136, 136);
  g.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = 54;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  g.lineCap = 'round';
  g.lineWidth = 11;
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
  // world-class band markers
  for (const [v, c] of [[60, '#f2b418'], [85, '#29d17a']]) {
    const a = a0 + (a1 - a0) * (v / 100);
    g.strokeStyle = c; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (r + 9), cy + Math.sin(a) * (r + 9)); g.lineTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); g.stroke();
  }
  const v = Math.max(0, Math.min(100, value || 0));
  const col = oeeColor(v);
  const grad = g.createLinearGradient(0, h, w, 0);
  grad.addColorStop(0, col); grad.addColorStop(1, '#ffffff');
  g.strokeStyle = col;
  g.lineWidth = 11;
  g.shadowColor = col; g.shadowBlur = 10;
  g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * (v / 100)); g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#e6eef6';
  g.textAlign = 'center';
  g.font = '800 26px Inter, sans-serif';
  g.fillText(`${v.toFixed(1)}`, cx, cy + 6);
  g.font = '600 10px Inter, sans-serif';
  g.fillStyle = '#8fa3b8';
  g.fillText(`${label} %`, cx, cy + 22);
  g.fillText('world class 85', cx, cy + 50);
}

export function drawTrend(canvas, series, { max1 = 100, max2 = null, labels = [] } = {}) {
  const [g, w, h] = fit(canvas);
  g.clearRect(0, 0, w, h);
  const pad = { l: 30, r: 34, t: 8, b: 16 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.lineWidth = 1;
  g.font = '9px Inter, sans-serif';
  g.fillStyle = '#5d7187';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (ih * i) / 4;
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke();
    g.textAlign = 'right'; g.fillText(`${Math.round(max1 * (1 - i / 4))}`, pad.l - 5, y + 3);
    if (max2) { g.textAlign = 'left'; g.fillText(`${Math.round(max2 * (1 - i / 4))}`, w - pad.r + 5, y + 3); }
  }
  series.forEach((s, si) => {
    const data = s.data;
    if (data.length < 2) return;
    const mx = si === 0 ? max1 : max2 || max1;
    const pts = data.map((v, i) => [pad.l + (i / (data.length - 1)) * iw, pad.t + ih - (Math.max(0, Math.min(mx, v)) / mx) * ih]);
    if (s.fill) {
      const grad = g.createLinearGradient(0, pad.t, 0, pad.t + ih);
      grad.addColorStop(0, s.fill); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(pts[0][0], pad.t + ih);
      pts.forEach(([x, y]) => g.lineTo(x, y));
      g.lineTo(pts[pts.length - 1][0], pad.t + ih); g.closePath(); g.fill();
    }
    g.strokeStyle = s.color; g.lineWidth = 1.8;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    const [lx, ly] = pts[pts.length - 1];
    g.fillStyle = s.color; g.beginPath(); g.arc(lx, ly, 2.8, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = '#5d7187'; g.textAlign = 'left';
  if (labels[0]) g.fillText(labels[0], pad.l, h - 3);
  g.textAlign = 'right';
  if (labels[1]) g.fillText(labels[1], w - pad.r, h - 3);
}
