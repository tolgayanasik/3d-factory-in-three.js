// Generates a blueprint-style general-arrangement drawing (front / side / top
// orthographic views + isometric) directly from the equipment's 3D model,
// with overall dimensions and a title block.
import * as THREE from 'three';

let renderer = null;
const edgeCache = new WeakMap();
const cache = new Map();
const BG = '#0c2a4d';
const LINE = 0xe8f4ff;
const FILL = 0x16406e;

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setSize(1600, 1040);
  }
  return renderer;
}

function edgesFor(geo) {
  let e = edgeCache.get(geo);
  if (!e) {
    e = new THREE.EdgesGeometry(geo, 24);
    edgeCache.set(geo, e);
  }
  return e;
}

function buildDrawingScene(root) {
  const scene = new THREE.Scene();
  const fillMat = new THREE.MeshBasicMaterial({ color: FILL, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const lineMat = new THREE.LineBasicMaterial({ color: LINE });
  const holder = new THREE.Group();
  scene.add(holder);
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const scale = new THREE.Vector3();
  root.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  const sm = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z);
  root.traverse((o) => {
    if (!o.visible) return;
    let p = o; let vis = true;
    while (p && p !== root) { if (!p.visible) { vis = false; break; } p = p.parent; }
    if (!vis) return;
    if (!(o.isMesh)) return;
    const m = new THREE.Matrix4().multiplyMatrices(sm, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const geo = o.geometry;
    if (o.isInstancedMesh) {
      const im = new THREE.InstancedMesh(geo, fillMat, o.count);
      const tmp = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, tmp); im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, tmp)); }
      holder.add(im);
      if (o.count <= 400) {
        const eg = edgesFor(geo);
        for (let i = 0; i < o.count; i += 1) {
          o.getMatrixAt(i, tmp);
          const s = new THREE.Vector3(); tmp.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
          if (s.x < 0.01) continue;
          const ls = new THREE.LineSegments(eg, lineMat);
          ls.matrixAutoUpdate = false;
          ls.matrix.multiplyMatrices(m, tmp);
          holder.add(ls);
        }
      }
      return;
    }
    if (o.material?.transparent && o.material.opacity < 0.3) {
      const ls = new THREE.LineSegments(edgesFor(geo), new THREE.LineBasicMaterial({ color: 0x7fb3e0, transparent: true, opacity: 0.35 }));
      ls.matrixAutoUpdate = false; ls.matrix.copy(m);
      holder.add(ls);
      return;
    }
    const mesh = new THREE.Mesh(geo, fillMat);
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(m);
    holder.add(mesh);
    const ls = new THREE.LineSegments(edgesFor(geo), lineMat);
    ls.matrixAutoUpdate = false; ls.matrix.copy(m);
    holder.add(ls);
  });
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  return { scene, box, dispose: () => { fillMat.dispose(); lineMat.dispose(); } };
}

function renderView(r, scene, box, dir, up, vp) {
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
  cam.up.copy(up);
  const dist = size.length() * 2 + 10;
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.lookAt(c);
  cam.updateMatrixWorld();
  // fit projected bbox
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of corners) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const w = maxX - minX, h = maxY - minY;
  const aspect = vp.w / vp.h;
  let hw = (w / 2) * 1.12, hh = (h / 2) * 1.12;
  if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  cam.left = cx - hw; cam.right = cx + hw; cam.top = cy + hh; cam.bottom = cy - hh;
  cam.near = 0.01; cam.far = dist * 3;
  cam.updateProjectionMatrix();
  r.setViewport(vp.x, 1040 - vp.y - vp.h, vp.w, vp.h);
  r.setScissor(vp.x, 1040 - vp.y - vp.h, vp.w, vp.h);
  r.setScissorTest(true);
  r.render(scene, cam);
  // pixels per metre, and projected extents in canvas px
  const ppm = vp.w / (2 * hw);
  return { ppm, x0: vp.x + (minX - (cx - hw)) * ppm, x1: vp.x + (maxX - (cx - hw)) * ppm, y0: vp.y + ((cy + hh) - maxY) * ppm, y1: vp.y + ((cy + hh) - minY) * ppm };
}

function dimLine(g, x0, y0, x1, y1, text, off = 22, vertical = false) {
  g.save();
  g.strokeStyle = '#ffd24d'; g.fillStyle = '#ffd24d'; g.lineWidth = 1.2;
  g.font = '600 15px "JetBrains Mono", monospace';
  if (!vertical) {
    const y = y1 + off;
    g.beginPath(); g.moveTo(x0, y1 + 4); g.lineTo(x0, y + 6); g.moveTo(x1, y1 + 4); g.lineTo(x1, y + 6); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    for (const [x, d] of [[x0, 1], [x1, -1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + d * 10, y - 4); g.lineTo(x + d * 10, y + 4); g.fill(); }
    g.textAlign = 'center';
    g.fillStyle = BG; const tw = g.measureText(text).width + 10; g.fillRect((x0 + x1) / 2 - tw / 2, y - 10, tw, 20);
    g.fillStyle = '#ffd24d'; g.fillText(text, (x0 + x1) / 2, y + 5);
  } else {
    const x = x1 + off;
    g.beginPath(); g.moveTo(x1 + 4, y0); g.lineTo(x + 6, y0); g.moveTo(x1 + 4, y1); g.lineTo(x + 6, y1); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    for (const [y, d] of [[y0, 1], [y1, -1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + d * 10); g.lineTo(x + 4, y + d * 10); g.fill(); }
    g.translate(x, (y0 + y1) / 2); g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillStyle = BG; const tw = g.measureText(text).width + 10; g.fillRect(-tw / 2, -10, tw, 20);
    g.fillStyle = '#ffd24d'; g.fillText(text, 0, 5);
  }
  g.restore();
}

export function generateDrawing(eq, info) {
  const key = eq.id;
  if (cache.has(key)) return cache.get(key);
  const r = getRenderer();
  const { scene, box, dispose } = buildDrawingScene(eq.root);
  if (box.isEmpty()) return null;
  const out = document.createElement('canvas');
  out.width = 1600; out.height = 1040;
  const g = out.getContext('2d');
  r.setClearColor(0x000000, 0);
  r.setScissorTest(false);
  r.clear();
  // layout: front (TL), side (TR), top (BL), iso (BR)
  const views = [
    { name: 'FRONT VIEW', dir: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0), vp: { x: 40, y: 60, w: 740, h: 380 } },
    { name: 'SIDE VIEW (RIGHT)', dir: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), vp: { x: 830, y: 60, w: 730, h: 380 } },
    { name: 'TOP VIEW', dir: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1), vp: { x: 40, y: 500, w: 740, h: 360 } },
    { name: 'ISOMETRIC', dir: new THREE.Vector3(1, 0.85, 1).normalize(), up: new THREE.Vector3(0, 1, 0), vp: { x: 830, y: 500, w: 730, h: 360 } },
  ];
  const res = views.map((v) => renderView(r, scene, box, v.dir, v.up, v.vp));
  r.setScissorTest(false);
  // compose on 2D canvas: background grid, rendered views, annotations
  g.fillStyle = BG; g.fillRect(0, 0, 1600, 1040);
  g.strokeStyle = 'rgba(160,200,255,0.07)'; g.lineWidth = 1;
  for (let x = 0; x < 1600; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1040); g.stroke(); }
  for (let y = 0; y < 1040; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(1600, y); g.stroke(); }
  g.drawImage(r.domElement, 0, 0);
  g.strokeStyle = '#cfe6ff'; g.lineWidth = 2; g.strokeRect(14, 14, 1572, 1012);
  g.lineWidth = 1; g.strokeRect(20, 20, 1560, 1000);
  const size = box.getSize(new THREE.Vector3());
  const mm = (v) => `${Math.round(v * 1000).toLocaleString('en-US')}`;
  g.font = '700 14px Inter, sans-serif'; g.fillStyle = '#cfe6ff';
  views.forEach((v, i) => { g.textAlign = 'left'; g.fillText(v.name, v.vp.x + 6, v.vp.y - 12); });
  // dimensions
  const [f, s, t] = res;
  dimLine(g, f.x0, f.y0, f.x1, f.y1, `${mm(size.x)}`);
  dimLine(g, f.x0, f.y0, f.x1, f.y1, `${mm(size.y)}`, 26, true);
  dimLine(g, s.x0, s.y0, s.x1, s.y1, `${mm(size.z)}`);
  dimLine(g, t.x0, t.y0, t.x1, t.y1, `${mm(size.z)}`, 26, true);
  // centre lines
  g.setLineDash([18, 6, 4, 6]); g.strokeStyle = 'rgba(255,120,120,0.55)'; g.lineWidth = 1;
  for (const v of [f, t]) { const cx = (v.x0 + v.x1) / 2; g.beginPath(); g.moveTo(cx, v.y0 - 20); g.lineTo(cx, v.y1 + 10); g.stroke(); }
  g.setLineDash([]);
  // title block
  const tb = { x: 1010, y: 880, w: 570, h: 140 };
  g.fillStyle = 'rgba(12,42,77,0.95)'; g.fillRect(tb.x, tb.y, tb.w, tb.h);
  g.strokeStyle = '#cfe6ff'; g.strokeRect(tb.x, tb.y, tb.w, tb.h);
  const rows = [[tb.y + 34], [tb.y + 70], [tb.y + 105]];
  g.beginPath();
  rows.forEach(([y]) => { g.moveTo(tb.x, y); g.lineTo(tb.x + tb.w, y); });
  g.moveTo(tb.x + 330, tb.y + 34); g.lineTo(tb.x + 330, tb.y + tb.h);
  g.moveTo(tb.x + 450, tb.y + 34); g.lineTo(tb.x + 450, tb.y + tb.h);
  g.stroke();
  g.textAlign = 'left';
  g.fillStyle = '#ffffff'; g.font = '800 18px Inter, sans-serif';
  g.fillText(String(info.name).toUpperCase().slice(0, 44), tb.x + 10, tb.y + 24);
  const cell = (lbl, val, x, y) => { g.fillStyle = '#8fb7e0'; g.font = '600 10px Inter, sans-serif'; g.fillText(lbl, x + 8, y + 13); g.fillStyle = '#ffffff'; g.font = '600 13px "JetBrains Mono", monospace'; g.fillText(String(val).slice(0, 38), x + 8, y + 29); };
  cell('DRAWING NO.', info.drawingNo, tb.x, tb.y + 34);
  cell('SCALE', `1:${Math.max(5, Math.round(1000 / f.ppm / 5) * 5)}`, tb.x + 330, tb.y + 34);
  cell('SHEET', '1 / 1', tb.x + 450, tb.y + 34);
  cell('MANUFACTURER / MODEL', `${info.manufacturer} · ${info.model}`, tb.x, tb.y + 70);
  cell('UNITS', 'mm', tb.x + 330, tb.y + 70);
  cell('REV', 'C', tb.x + 450, tb.y + 70);
  cell('ASSET / SERIAL', `${eq.id} · ${info.serial}`, tb.x, tb.y + 105);
  cell('DATE', new Date().toISOString().slice(0, 10), tb.x + 330, tb.y + 105);
  cell('DRAWN', 'DT-GEN', tb.x + 450, tb.y + 105);
  // notes
  g.fillStyle = '#8fb7e0'; g.font = '600 11px Inter, sans-serif';
  const notes = ['NOTES:', '1. GENERAL ARRANGEMENT – GENERATED FROM DIGITAL TWIN MODEL.', `2. OVERALL ENVELOPE ${mm(size.x)} x ${mm(size.z)} x ${mm(size.y)} (L x W x H).`, '3. FOUNDATION & ANCHORING PER SITE STANDARD NX-FS-04.', '4. KEEP 800 mm MAINTENANCE CLEARANCE ON OPERATOR SIDE.', '5. THIRD ANGLE PROJECTION.'];
  notes.forEach((l, i) => g.fillText(l, 40, 900 + i * 18));
  // projection symbol
  g.strokeStyle = '#cfe6ff'; g.beginPath(); g.arc(920, 950, 14, 0, Math.PI * 2); g.arc(920, 950, 6, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(950, 936); g.lineTo(990, 942); g.lineTo(990, 958); g.lineTo(950, 964); g.closePath(); g.stroke();
  dispose();
  const url = out.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function invalidateDrawing(id) { cache.delete(id); }
