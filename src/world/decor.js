// Life & props: walking operators, storage racks, material flow overlay.
import * as THREE from 'three';
import { M, paint } from './materials.js';
import * as T from './textures.js';
import { box, cyl, group, mesh, G, mergeStatic, pallet, tote, sphere } from '../equipment/common.js';

// ---------------------------------------------------------------------------
export class Person {
  constructor(parent, path, { vest = 0xf2c318, speed = 1.1, helmet = 0xffffff, phase = 0 } = {}) {
    const m = M();
    this.g = group(parent);
    this.g.userData.person = true;
    const vestM = paint(vest, { rough: 0.7, metal: 0 });
    const pants = paint(0x2a3440, { rough: 0.8, metal: 0 });
    const skin = paint(0xd9a282, { rough: 0.7, metal: 0 });
    this.legs = [-1, 1].map((s) => { const l = group(this.g, 0, 0.9, s * 0.1); box(l, 0.13, 0.9, 0.14, pants, 0, -0.9, 0); box(l, 0.16, 0.08, 0.26, m.charcoal, 0.05, -0.9, 0); return l; });
    box(this.g, 0.3, 0.58, 0.42, vestM, 0, 0.9, 0);
    box(this.g, 0.305, 0.05, 0.425, paint(0xdde3e8, { rough: 0.3 }), 0, 1.2, 0);
    this.arms = [-1, 1].map((s) => { const a = group(this.g, 0, 1.44, s * 0.26); box(a, 0.1, 0.55, 0.1, vestM, 0, -0.55, 0); sphere(a, 0.05, skin, 0, -0.6, 0, 8); return a; });
    sphere(this.g, 0.11, skin, 0, 1.62, 0, 12);
    const hm = paint(helmet, { rough: 0.35, metal: 0 });
    mesh(this.g, new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 1.66, 0);
    box(this.g, 0.12, 0.02, 0.2, hm, 0.1, 1.65, 0);
    [...this.legs, ...this.arms].forEach((l) => { l.userData.dynamic = true; mergeStatic(l); });
    mergeStatic(this.g);
    this.path = path.map(([x, z]) => new THREE.Vector2(x, z));
    this.i = 0; this.t = phase; this.speed = speed;
    this.pos = this.path[0].clone();
    this.pause = 0;
  }
  update(dt) {
    if (this.pause > 0) { this.pause -= dt; this.legs.forEach((l) => (l.rotation.z *= 0.8)); return; }
    const a = this.path[this.i], b = this.path[(this.i + 1) % this.path.length];
    const d = b.clone().sub(a);
    const len = d.length();
    this.t += (this.speed * dt) / len;
    if (this.t >= 1) { this.t = 0; this.i = (this.i + 1) % this.path.length; if (Math.random() < 0.35) this.pause = 1 + Math.random() * 4; return; }
    this.pos.copy(a).addScaledVector(d, this.t);
    this.g.position.set(this.pos.x, 0, this.pos.y);
    const target = Math.atan2(-d.y, d.x);
    let dh = target - this.g.rotation.y;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.g.rotation.y += dh * Math.min(1, dt * 6);
    const sw = Math.sin(performance.now() * 0.001 * this.speed * 7) * 0.45;
    this.legs[0].rotation.z = sw; this.legs[1].rotation.z = -sw;
    this.arms[0].rotation.z = -sw * 0.8; this.arms[1].rotation.z = sw * 0.8;
  }
}

export function buildPeople(parent) {
  const routes = [
    { p: [[-58, 7.2], [-22, 7.2], [-22, 20], [-24, 24], [-58, 24], [-58, 7.2]], vest: 0xf2c318 },
    { p: [[-60, -3], [-24, -3], [-24, -10], [-60, -10]], vest: 0xf28c28 },
    { p: [[20, -18.6], [53, -18.6], [53, -13.5], [20, -13.5]], vest: 0x29b36b, helmet: 0x3a78d6 },
    { p: [[-6, 7.3], [30, 7.3], [30, 12], [-6, 12]], vest: 0xf2c318, speed: 1.2 },
    { p: [[-13, 14], [-3, 14], [-3, 21], [-13, 21]], vest: 0xe9edf0, helmet: 0xe9edf0, speed: 0.6 },
    { p: [[40, 12], [58, 12], [58, 36], [40, 36]], vest: 0xf28c28, speed: 1.0 },
    { p: [[15, -30], [60, -30], [60, -28.5], [15, -28.5]], vest: 0xd64545, helmet: 0xf2c318, speed: 0.9 },
  ];
  return routes.map((r, i) => new Person(parent, r.p, { vest: r.vest, helmet: r.helmet, speed: r.speed || 1.1, phase: i * 0.13 }));
}

// ---------------------------------------------------------------------------
export function buildProps(parent) {
  const m = M();
  const g = group(parent);
  // mould storage rack in moulding hall
  const rack = (x, z, w, levels, fill) => {
    for (const dx of [-w / 2, w / 2]) for (const dz of [-0.55, 0.55]) box(g, 0.08, levels * 1.1 + 0.2, 0.08, m.blue, x + dx, 0, z + dz);
    for (let l = 0; l <= levels; l++) for (const dz of [-0.55, 0.55]) box(g, w, 0.1, 0.08, m.rackBeam, x, l * 1.1 + 0.1, z + dz);
    for (let l = 0; l < levels; l++) for (let k = 0; k < Math.floor(w / 1.1); k++) fill(x - w / 2 + 0.6 + k * 1.1, l * 1.1 + 0.2, z, l, k);
  };
  rack(-60.5, -14, 4.4, 3, (x, y, z, l, k) => box(g, 0.8, 0.55 + ((l + k) % 3) * 0.1, 0.7, (l + k) % 2 ? m.steel : m.darkSteel, x, y, z));
  // raw material gaylords
  for (let i = 0; i < 6; i++) {
    const x = -61 + (i % 3) * 1.4, z = -30 + Math.floor(i / 3) * 1.4;
    pallet(g, x, z);
    box(g, 1.1, 1.0, 1.1, i % 2 ? m.cardboardPlain : paint(0x2d3a4a, { rough: 0.8 }), x, 0.13, z);
  }
  // steel sheet bundles and coils in sheet metal shop
  for (let i = 0; i < 4; i++) { box(g, 3.1, 0.12, 1.55, m.wood, -61, 0, 18 + i * 1.8); box(g, 3.0, 0.2 + (i % 2) * 0.2, 1.5, m.sheet, -61, 0.12, 18 + i * 1.8); }
  for (let i = 0; i < 3; i++) {
    const c = mesh(g, new THREE.CylinderGeometry(0.7, 0.7, 0.6, 32), m.steel, -34 + i * 1.8, 0.7, 37, [Math.PI / 2, 0, 0]);
    box(g, 1.6, 0.1, 1.2, m.wood, -34 + i * 1.8, 0, 37);
    c.position.y = 0.8;
  }
  // tool cabinets and workbenches
  for (const [x, z, r] of [[-24, 22, Math.PI / 2], [-60.8, 4.5, Math.PI / 2], [14.8, -20, Math.PI / 2]]) {
    const b = group(g, x, 0, z);
    b.rotation.y = r;
    box(b, 2.0, 0.9, 0.8, m.red, 0, 0, 0);
    box(b, 2.1, 0.05, 0.85, m.wood, 0, 0.9, 0);
    box(b, 2.0, 1.0, 0.05, m.toteBlue, 0, 0.95, -0.38);
  }
  // finished goods staging: wrapped pallets at shipping lanes are dynamic; add a few static ones
  for (let i = 0; i < 6; i++) {
    const x = 38 + (i % 3) * 1.5, z = 30 + Math.floor(i / 3) * 1.6;
    pallet(g, x, z);
    box(g, 1.1, 1.05, 0.95, m.cardboardPlain, x, 0.13, z);
    const f = mesh(g, G.box(1.14, 1.08, 0.99), m.film, x, 0.67, z);
    f.castShadow = false;
  }
  // fire extinguishers on columns
  for (const x of [-48, -32, -16, 0, 16, 32, 48]) {
    cyl(g, 0.09, 0.5, m.red, x + 0.3, 0.55, 8.8 - 0.35, 'y', 12);
    const s = mesh(g, new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ map: T.labelTexture('FIRE', { bg: '#c8352f', fg: '#fff', w: 64, h: 64, font: 18 }), roughness: 0.6 }), x + 0.3, 1.9, 8.8 - 0.21);
    s.castShadow = false;
  }
  // kanban supermarket near assembly
  for (let i = 0; i < 3; i++) {
    const x = 26 + i * 3;
    for (const dx of [-1.2, 1.2]) box(g, 0.06, 1.8, 0.06, m.alu, x + dx, 0, -9);
    for (let l = 0; l < 3; l++) {
      box(g, 2.4, 0.04, 0.8, m.alu, x, 0.4 + l * 0.55, -9, [0.18, 0, 0]);
      for (let k = 0; k < 4; k++) tote(g, [m.toteBlue, m.toteGrey, M().safetyYellow][l], x - 0.9 + k * 0.6, 0.46 + l * 0.55, -9, 0.9);
    }
  }
  mergeStatic(g);
  return g;
}

// ---------------------------------------------------------------------------
// Animated material-flow overlay (plastic, metal, kits, assembly, finished)
export class FlowOverlay {
  constructor(parent) {
    this.group = group(parent);
    this.group.visible = false;
    this.group.name = 'flow-overlay';
    this.mats = [];
    const H = 5.2;
    const flows = [
      ['plastic', '#19d3d3', [[-53.7, -3], [-44.7, -1], [-35.7, -1], [-26.7, -1], [-18, 2], [-14.4, 1.5], [-14.4, -4]]],
      ['metal', '#ff9a2e', [[-55, 15], [-49, 15], [-39.5, 15.5], [-29, 15.5], [-24.3, 12], [-24.3, 6], [-12, 2.5], [-10.4, -4]]],
      ['metal', '#ff9a2e', [[-33, 32], [-26, 26], [-24.3, 18]]],
      ['kits', '#5aa0ff', [[-6.4, -4], [-6.4, 2.5], [5, 3.5], [18.8, 2], [18.8, -12], [21, -25]]],
      ['assembly', '#b48cff', [[21, -22], [30, -22.3], [40, -22.3], [50.5, -22.3], [52, -25.5]]],
      ['finished', '#3ee07a', [[52, -25.7], [59.2, -25.7], [59.2, -11], [56.2, -5.4], [56.2, 2], [44, 5], [44, 20], [50, 26]]],
    ];
    for (const [key, col, pts] of flows) {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z], i) => new THREE.Vector3(x, H + Math.sin((i / (pts.length - 1)) * Math.PI) * 0.6, z)), false, 'catmullrom', 0.3);
      const tex = T.flowArrowTexture(col);
      const len = curve.getLength();
      tex.repeat.set(len / 2.2, 1);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, color: 0xffffff });
      mat.color.multiplyScalar(1.6);
      this.mats.push(mat);
      const tubeGeo = new THREE.TubeGeometry(curve, Math.ceil(len * 2), 0.22, 6, false);
      const t = new THREE.Mesh(tubeGeo, mat);
      t.renderOrder = 5;
      this.group.add(t);
      const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.ceil(len), 0.05, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2), toneMapped: false }));
      this.group.add(glow);
      // drop lines to floor at ends
      for (const p of [pts[0], pts[pts.length - 1]]) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H, 6), glow.material);
        d.position.set(p[0], H / 2, p[1]);
        this.group.add(d);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2), glow.material);
        ring.position.set(p[0], 0.03, p[1]);
        this.group.add(ring);
      }
    }
  }
  update(dt) { if (this.group.visible) for (const m of this.mats) m.map.offset.x -= dt * 0.8; }
}
