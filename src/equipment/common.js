// Geometry helpers, shared building blocks (andon lights, cabinets, HMIs,
// fences) and the Equipment base class every machine derives from.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { M, screenMat, emissive } from '../world/materials.js';

export const DEG = Math.PI / 180;
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
export const G = {
  box: (w, h, d) => cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r = 0.04) => cached(`rb${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1))),
  cyl: (rt, rb, h, s = 24) => cached(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  sphere: (r, s = 16) => cached(`s${r}|${s}`, () => new THREE.SphereGeometry(r, s, Math.max(8, s * 0.75 | 0))),
  torus: (r, t, s = 24) => cached(`t${r}|${t}|${s}`, () => new THREE.TorusGeometry(r, t, 8, s)),
};

export function mesh(parent, geo, mat, x = 0, y = 0, z = 0, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
// Box whose bottom sits at y
export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, rot) {
  return mesh(parent, G.box(w, h, d), mat, x, y + h / 2, z, rot);
}
export function rbox(parent, w, h, d, mat, x = 0, y = 0, z = 0, r = 0.05, rot) {
  return mesh(parent, G.rbox(w, h, d, r), mat, x, y + h / 2, z, rot);
}
// Cylinder centred at (x,y,z); axis 'x' | 'y' | 'z'
export function cyl(parent, r, h, mat, x = 0, y = 0, z = 0, axis = 'y', seg = 24, rTop = r) {
  const m = mesh(parent, G.cyl(rTop, r, h, seg), mat, x, y, z);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  return m;
}
export function sphere(parent, r, mat, x = 0, y = 0, z = 0, seg = 16) {
  return mesh(parent, G.sphere(r, seg), mat, x, y, z);
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
export function tube(parent, pts, r, mat, seg = 64, radial = 10, curveType = 'catmullrom', tension = 0.1) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), false, curveType, tension);
  return mesh(parent, new THREE.TubeGeometry(curve, seg, r, radial, false), mat);
}
// Orthogonal pipe run with rounded elbows through points
export function pipe(parent, pts, r, mat) {
  const v = pts.map((p) => new THREE.Vector3(...p));
  const path = new THREE.CurvePath();
  const bend = r * 3;
  let prev = v[0].clone();
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1], b = v[i];
    if (i < v.length - 1) {
      const c = v[i + 1];
      const d1 = b.clone().sub(a).normalize();
      const d2 = c.clone().sub(b).normalize();
      const p1 = b.clone().addScaledVector(d1, -bend);
      const p2 = b.clone().addScaledVector(d2, bend);
      path.add(new THREE.LineCurve3(prev, p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
      prev = p2;
    } else {
      path.add(new THREE.LineCurve3(prev, b.clone()));
    }
  }
  return mesh(parent, new THREE.TubeGeometry(path, Math.max(12, v.length * 12), r, 10, false), mat);
}
export function extrude(parent, shapePts, depth, mat, holes = []) {
  const s = new THREE.Shape(shapePts.map(([x, y]) => new THREE.Vector2(x, y)));
  holes.forEach((h) => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return mesh(parent, g, mat);
}

// ---------------------------------------------------------------------------
// Merge static meshes (per material) to keep draw calls low.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const toRemove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noMerge) return;
    // skip meshes that live under another equipment root or a dynamic group
    let p = o.parent;
    while (p && p !== root) {
      if (p.userData.equipmentId || p.userData.dynamic) return;
      p = p.parent;
    }
    const mat = o.material;
    const indexed = !!o.geometry.index;
    const key = mat.uuid + (indexed ? 'i' : 'n') + (o.castShadow ? 's' : '');
    const g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {};
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { mat, geos: [], cast: o.castShadow });
    buckets.get(key).geos.push(g);
    toRemove.push(o);
  });
  toRemove.forEach((o) => o.parent.remove(o));
  for (const { mat, geos, cast } of buckets.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    geos.forEach((g) => g !== merged && g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.merged = true;
    root.add(m);
  }
}

// ---------------------------------------------------------------------------
// Andon stack light (red / amber / green / blue), individual materials per unit
const ANDON_COLORS = { red: 0xff2a1f, amber: 0xffa21a, green: 0x1fdc5a, blue: 0x2f8cff };
export class Andon {
  constructor(parent, x, y, z, scale = 1) {
    this.group = group(parent, x, y, z);
    this.group.scale.setScalar(scale);
    this.group.userData.dynamic = true;
    const m = M();
    cyl(this.group, 0.018, 0.35, m.darkGrey, 0, 0.175, 0, 'y', 8);
    cyl(this.group, 0.045, 0.05, m.charcoal, 0, 0.37, 0, 'y', 16);
    this.lamps = {};
    ['green', 'amber', 'red', 'blue'].forEach((c, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: ANDON_COLORS[c], emissive: ANDON_COLORS[c], emissiveIntensity: 0.05, roughness: 0.3, transparent: true, opacity: 0.92 });
      this.lamps[c] = mat;
      cyl(this.group, 0.042, 0.075, mat, 0, 0.44 + i * 0.08, 0, 'y', 16);
    });
    cyl(this.group, 0.045, 0.03, m.charcoal, 0, 0.77, 0, 'y', 16);
    this.state = 'Running';
  }
  set(state) { this.state = state; }
  update(t) {
    const blink = Math.sin(t * 7) > 0 ? 1 : 0;
    const on = { red: 0, amber: 0, green: 0, blue: 0 };
    switch (this.state) {
      case 'Running': on.green = 1; break;
      case 'Idle': on.amber = 1; break;
      case 'Setup': on.amber = blink; on.blue = 1; break;
      case 'Down': on.red = blink; break;
      case 'Maintenance': on.blue = 1; on.amber = blink * 0.6; break;
      default: break;
    }
    for (const k in on) this.lamps[k].emissiveIntensity = 0.04 + on[k] * 4.5;
  }
}

export function hmi(parent, x, y, z, rotY = 0, accent = '#1ba6a6', kind = 'hmi') {
  const g = group(parent, x, y, z);
  g.rotation.y = rotY;
  const m = M();
  cyl(g, 0.03, 0.5, m.darkGrey, 0, -0.25, -0.05, 'y', 8);
  box(g, 0.46, 0.32, 0.06, m.charcoal, 0, 0, 0);
  const s = mesh(g, new THREE.PlaneGeometry(0.4, 0.26), screenMat(kind, accent), 0, 0.16, 0.031);
  s.castShadow = false;
  return g;
}

export function cabinet(parent, w, h, d, x, z, rotY = 0, mat = M().offWhite, y = 0) {
  const g = group(parent, x, y, z);
  g.rotation.y = rotY;
  const m = M();
  box(g, w, 0.1, d, m.charcoal, 0, 0, 0);
  box(g, w, h - 0.1, d, mat, 0, 0.1, 0);
  const doors = Math.max(1, Math.round(w / 0.8));
  for (let i = 0; i < doors; i++) {
    const dx = -w / 2 + (w / doors) * (i + 0.5);
    box(g, 0.012, h - 0.3, 0.01, m.darkGrey, dx - w / doors / 2 + 0.01, 0.2, d / 2 + 0.004);
    box(g, 0.025, 0.18, 0.03, m.charcoal, dx + w / doors / 2 - 0.08, h * 0.55, d / 2 + 0.012);
    box(g, w / doors - 0.2, 0.12, 0.01, m.darkGrey, dx, h - 0.35, d / 2 + 0.004);
  }
  return g;
}

// Safety fence along a polyline (x,z pairs), posts + transparent mesh panels
export function fence(parent, pts, height = 2.0, { closed = false, gaps = [] } = {}) {
  const m = M();
  const list = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < list.length - 1; i++) {
    const [x1, z1] = list[i], [x2, z2] = list[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 1.4));
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const cx = x1 + (x2 - x1) * (t0 + t1) / 2, cz = z1 + (z2 - z1) * (t0 + t1) / 2;
      if (gaps.some(([gi, gk]) => gi === i && gk === k)) continue;
      const seg = len / n;
      const p = mesh(parent, G.box(seg - 0.06, height - 0.15, 0.01), m.fenceMesh, cx, height / 2 + 0.08, cz, [0, ang, 0]);
      p.castShadow = false;
      p.userData.noMerge = false;
      box(parent, seg - 0.06, 0.03, 0.03, m.safetyYellow, cx, height - 0.05, cz, [0, ang, 0]);
    }
    for (let k = 0; k <= n; k++) {
      const px = x1 + (x2 - x1) * (k / n), pz = z1 + (z2 - z1) * (k / n);
      box(parent, 0.05, height, 0.05, m.safetyYellow, px, 0, pz);
    }
  }
}

// Stack of simple floor pallet with parts
export function pallet(parent, x, z, rotY = 0, y = 0) {
  const m = M();
  const g = group(parent, x, y, z);
  g.rotation.y = rotY;
  part(g, 'pallet', [...[-0.5, 0, 0.5].map((dz) => [1.2, 0.1, 0.12, 0, 0, dz]), ...[-0.55, -0.28, 0, 0.28, 0.55].map((dx) => [0.12, 0.03, 1.1, dx, 0.1, 0])], m.wood);
  return g;
}

// Build a geometry once from box specs [w,h,d,x,yBottom,z] and cache it
const partCache = new Map();
export function partGeometry(key, boxes) {
  if (!partCache.has(key)) {
    const geos = boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z));
    partCache.set(key, mergeGeometries(geos));
  }
  return partCache.get(key);
}
export function part(parent, key, boxes, mat) {
  const m = new THREE.Mesh(partGeometry(key, boxes), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const TOTE_BOXES = [[0.6, 0.04, 0.4, 0, 0, 0], [0.6, 0.28, 0.03, 0, 0.02, 0.185], [0.6, 0.28, 0.03, 0, 0.02, -0.185], [0.03, 0.28, 0.4, 0.285, 0.02, 0], [0.03, 0.28, 0.4, -0.285, 0.02, 0]];
export function tote(parent, mat = M().toteBlue, x = 0, y = 0, z = 0, s = 1) {
  const g = group(parent, x, y, z);
  g.scale.setScalar(s);
  part(g, 'tote', TOTE_BOXES, mat);
  return g;
}

// ---------------------------------------------------------------------------
export class Equipment {
  constructor(def, ctx) {
    this.def = def;
    this.id = def.id;
    this.ctx = ctx;
    this.root = new THREE.Group();
    this.root.name = def.id;
    this.root.userData.equipmentId = def.id;
    this.static = new THREE.Group();
    this.static.name = 'static';
    this.root.add(this.static);
    this.andons = [];
    this.status = 'Running';
    this.speed = 1;
    this.labelHeight = 3;
    this.children = [];
  }
  place(x = this.def.pos[0], z = this.def.pos[1], rot = this.def.rot || 0) {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = rot * DEG;
  }
  dyn(parent = this.root, x = 0, y = 0, z = 0) {
    const g = group(parent, x, y, z);
    g.userData.dynamic = true;
    return g;
  }
  andon(x, y, z, parent = this.static, scale = 1) {
    const a = new Andon(parent, x, y, z, scale);
    this.andons.push(a);
    return a;
  }
  finalize() {
    mergeStatic(this.static);
    // also compact the rigid content of every animated group
    const groups = [];
    this.root.traverse((o) => { if (o !== this.root && o.userData.dynamic && !o.userData.noCompact) groups.push(o); });
    groups.forEach((g) => mergeStatic(g));
  }
  setStatus(s) {
    this.status = s;
    this.andons.forEach((a) => a.set(s));
  }
  get running() { return this.status === 'Running'; }
  tick(dt, t) {
    for (const a of this.andons) a.update(t);
    this.update(this.running ? dt * this.speed : 0, t, dt);
  }
  update() {}
}

// Smooth helpers
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const easeInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Piecewise timeline: phases [{d, ...}] – returns {i, p (0..1), phase}
export function timeline(phases, t) {
  const total = phases.reduce((s, p) => s + p.d, 0);
  let tt = ((t % total) + total) % total;
  for (let i = 0; i < phases.length; i++) {
    if (tt < phases[i].d) return { i, p: tt / phases[i].d, phase: phases[i], total };
    tt -= phases[i].d;
  }
  return { i: phases.length - 1, p: 1, phase: phases[phases.length - 1], total };
}

export { emissive };
