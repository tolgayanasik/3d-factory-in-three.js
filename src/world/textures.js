// Procedurally generated canvas textures (no external image assets needed).
import * as THREE from 'three';

let maxAniso = 8;
export function setMaxAnisotropy(a) { maxAniso = a; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Seeded random for repeatable noise
function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function concreteTexture() {
  const [c, g] = canvas(1024, 1024);
  const r = rng(7);
  g.fillStyle = '#9a9c9e';
  g.fillRect(0, 0, 1024, 1024);
  // mottling
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 8 + r() * 60;
    const v = 140 + r() * 30 | 0;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${v},${v + 2},${v + 4},0.10)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // fine grain
  const img = g.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // saw-cut joints at tile edge
  g.strokeStyle = 'rgba(60,60,60,0.55)';
  g.lineWidth = 3;
  g.strokeRect(1, 1, 1022, 1022);
  // a few hairline cracks/stains
  g.strokeStyle = 'rgba(80,80,80,0.18)';
  g.lineWidth = 1;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    let x = r() * 1024, y = r() * 1024;
    g.moveTo(x, y);
    for (let s = 0; s < 12; s++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, { repeat: [1, 1] });
}

export function wallPanelTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#d9dde1';
  g.fillRect(0, 0, 256, 512);
  for (let x = 0; x < 256; x += 32) {
    const grad = g.createLinearGradient(x, 0, x + 32, 0);
    grad.addColorStop(0, '#c4c9ce');
    grad.addColorStop(0.15, '#eef1f3');
    grad.addColorStop(0.3, '#d6dade');
    grad.addColorStop(1, '#d2d6da');
    g.fillStyle = grad;
    g.fillRect(x, 0, 32, 512);
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 510, 256, 2);
  return tex(c);
}

export function meshTexture() {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  return tex(c, { srgb: false });
}

export function hazardTexture() {
  const [c, g] = canvas(128, 32);
  g.fillStyle = '#f5c518';
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#1b1b1b';
  for (let x = -32; x < 160; x += 32) {
    g.beginPath();
    g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0);
    g.fill();
  }
  return tex(c);
}

export function beltTexture() {
  const [c, g] = canvas(64, 256);
  g.fillStyle = '#1d2022';
  g.fillRect(0, 0, 64, 256);
  const r = rng(3);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    g.fillRect(r() * 64, r() * 256, 2, 2);
  }
  g.fillStyle = '#2c3134';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 5);
  return tex(c, { repeat: [1, 1] });
}

export function rollerTexture() {
  const [c, g] = canvas(64, 64);
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#8d949b');
  grad.addColorStop(0.5, '#e4e8ec');
  grad.addColorStop(1, '#7b828a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}

export function screenTexture(kind = 'hmi', accent = '#1ba6a6') {
  const [c, g] = canvas(256, 160);
  g.fillStyle = '#0b1622';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = accent;
  g.fillRect(0, 0, 256, 18);
  g.fillStyle = '#e8f1f8';
  g.font = 'bold 12px sans-serif';
  g.fillText(kind === 'hmi' ? 'AUTO  ●  CYCLE' : kind.toUpperCase(), 8, 13);
  const r = rng(kind.length * 13 + accent.length);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#16283a';
    g.fillRect(8 + i * 62, 26, 56, 40);
    g.fillStyle = ['#29b36b', '#f2c318', '#3a9bff', '#e8f1f8'][i];
    g.font = 'bold 16px sans-serif';
    g.fillText(String((r() * 99) | 0), 16 + i * 62, 54);
  }
  g.strokeStyle = '#3a9bff';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x < 240; x += 6) g.lineTo(8 + x, 130 - Math.sin(x / 18) * 14 - r() * 12);
  g.stroke();
  g.fillStyle = '#29b36b';
  g.fillRect(8, 146, 60, 8);
  g.fillStyle = '#1e3040';
  g.fillRect(74, 146, 174, 8);
  return tex(c, { wrap: false });
}

export function signTexture(text, { bg = '#16222f', fg = '#ffffff', accent = '#f2c318', w = 1024, h = 192, sub = '' } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = accent;
  g.fillRect(0, 0, 22, h);
  g.fillStyle = fg;
  g.font = `bold ${Math.round(h * 0.42)}px "Inter", "Segoe UI", sans-serif`;
  g.textBaseline = 'middle';
  g.fillText(text, 48, sub ? h * 0.4 : h * 0.52);
  if (sub) {
    g.globalAlpha = 0.7;
    g.font = `${Math.round(h * 0.2)}px "Inter", "Segoe UI", sans-serif`;
    g.fillText(sub, 50, h * 0.78);
  }
  return tex(c, { wrap: false });
}

export function labelTexture(text, { bg = '#f5c518', fg = '#111', w = 256, h = 64, font = 30 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `bold ${font}px "Inter", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 1);
  return tex(c, { wrap: false });
}

export function woodTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#b98d5a';
  g.fillRect(0, 0, 128, 128);
  const r = rng(11);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(90,60,30,${0.1 + r() * 0.2})`;
    g.beginPath();
    const y = r() * 128;
    g.moveTo(0, y);
    g.bezierCurveTo(40, y + r() * 6, 80, y - r() * 6, 128, y);
    g.stroke();
  }
  return tex(c);
}

export function cardboardTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#c29a64';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#a57f4c';
  g.fillRect(0, 58, 128, 12);
  g.fillStyle = '#2a2a2a';
  g.font = 'bold 14px sans-serif';
  g.fillText('EB-200', 10, 30);
  g.fillRect(90, 85, 28, 28);
  g.fillStyle = '#c29a64';
  g.fillRect(94, 89, 6, 6); g.fillRect(106, 97, 6, 6); g.fillRect(96, 103, 5, 5);
  return tex(c, { wrap: false });
}

export function asphaltTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#3b3e42';
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  const r = rng(21);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 30;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}

export function gradientTexture(stops) {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return tex(c, { wrap: false });
}

// Animated dashed arrow texture for material flow lines
export function flowArrowTexture(color) {
  const [c, g] = canvas(128, 32);
  g.clearRect(0, 0, 128, 32);
  g.fillStyle = color;
  g.globalAlpha = 0.95;
  for (let x = 0; x < 128; x += 64) {
    g.beginPath();
    g.moveTo(x + 8, 6); g.lineTo(x + 38, 6); g.lineTo(x + 54, 16); g.lineTo(x + 38, 26); g.lineTo(x + 8, 26); g.lineTo(x + 24, 16);
    g.closePath();
    g.fill();
  }
  return tex(c, { repeat: [1, 1] });
}
