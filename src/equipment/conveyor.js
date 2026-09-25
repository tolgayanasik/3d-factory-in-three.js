// Belt / roller conveyors along a polyline with accumulating item transport.
import * as THREE from 'three';
import { M } from '../world/materials.js';
import { Equipment, box, mesh, G, tote, group } from './common.js';

const rollerGeo = new THREE.CylinderGeometry(0.032, 0.032, 1, 12);
rollerGeo.rotateZ(Math.PI / 2);

// Build conveyor segments; returns {beltMat, length, segs}
export function buildConveyorPath(eq, parent, pts, { width = 0.6, height = 0.8, kind = 'belt', legs = true, frameMat } = {}) {
  const m = M();
  const fm = frameMat || m.alu;
  const beltMat = m.belt.clone();
  beltMat.map = m.belt.map.clone();
  beltMat.map.needsUpdate = true;
  const segs = [];
  let total = 0;
  const rollers = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(pts[i][0], 0, pts[i][1]);
    const b = new THREE.Vector3(pts[i + 1][0], 0, pts[i + 1][1]);
    const d = b.clone().sub(a);
    const len = d.length();
    const dir = d.clone().normalize();
    const ang = Math.atan2(-dir.x, -dir.z);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    segs.push({ a, b, len, dir, s0: total });
    total += len;
    const g = group(parent, mid.x, 0, mid.z);
    g.rotation.y = ang;
    // local frame: travel along -Z, width along X
    box(g, 0.06, 0.16, len, fm, -width / 2 - 0.03, height - 0.12, 0);
    box(g, 0.06, 0.16, len, fm, width / 2 + 0.03, height - 0.12, 0);
    box(g, 0.02, 0.05, len, m.safetyYellow, -width / 2 - 0.05, height + 0.04, 0);
    box(g, 0.02, 0.05, len, m.safetyYellow, width / 2 + 0.05, height + 0.04, 0);
    if (kind === 'belt') {
      const pg = new THREE.PlaneGeometry(width, len);
      const uv = pg.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (len / 0.6));
      pg.rotateX(-Math.PI / 2);
      const belt = mesh(g, pg, beltMat, 0, height + 0.001, 0);
      belt.castShadow = false;
      box(g, width, 0.06, len, m.darkGrey, 0, height - 0.07, 0);
    } else {
      const n = Math.floor(len / 0.12);
      for (let k = 0; k < n; k++) rollers.push({ g, z: -len / 2 + (k + 0.5) * (len / n), width, y: height - 0.03 });
    }
    if (legs) {
      const nl = Math.max(2, Math.ceil(len / 1.8) + 1);
      for (let k = 0; k < nl; k++) {
        const z = -len / 2 + 0.1 + (len - 0.2) * (k / (nl - 1));
        for (const sx of [-1, 1]) box(g, 0.05, height - 0.15, 0.05, m.grey, sx * (width / 2 + 0.02), 0, z);
        box(g, width, 0.04, 0.04, m.grey, 0, 0.25, z);
        box(g, 0.14, 0.02, 0.1, m.darkGrey, -width / 2 - 0.02, 0, z);
        box(g, 0.14, 0.02, 0.1, m.darkGrey, width / 2 + 0.02, 0, z);
      }
    }
    if (i === 0) box(g, width * 0.5, 0.25, 0.35, m.darkGrey, width / 2 + 0.2, height - 0.35, len / 2 - 0.3); // drive motor
    if (i > 0) box(parent, width + 0.12, 0.12, width + 0.12, fm, a.x, height - 0.12, a.z); // corner transfer
  }
  if (rollers.length) {
    const im = new THREE.InstancedMesh(rollerGeo, m.steel, rollers.length);
    const mm = new THREE.Matrix4();
    const tmp = new THREE.Object3D();
    parent.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    rollers.forEach((r, k) => {
      r.g.updateMatrixWorld(true);
      tmp.position.set(0, r.y, r.z);
      tmp.scale.set(r.width, 1, 1);
      tmp.updateMatrix();
      mm.multiplyMatrices(inv, r.g.matrixWorld).multiply(tmp.matrix);
      im.setMatrixAt(k, mm);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    parent.add(im);
  }
  return { beltMat, length: total, segs, height, width };
}

export function pointOnSegs(segs, s, out = new THREE.Vector3()) {
  for (const sg of segs) {
    if (s <= sg.s0 + sg.len + 1e-6) {
      const k = Math.max(0, s - sg.s0);
      return { p: out.copy(sg.a).addScaledVector(sg.dir, k), dir: sg.dir };
    }
  }
  const l = segs[segs.length - 1];
  return { p: out.copy(l.b), dir: l.dir };
}

// Item transport along a built conveyor path (accumulating, zero-pressure)
export class Track {
  constructor(eq, parent, pts, opts = {}) {
    this.opts = opts;
    this.path = buildConveyorPath(eq, parent, pts, opts);
    this.itemsGroup = eq.dyn(eq.root);
    this.speedMs = opts.speed || 0.45;
    this.spacing = opts.spacing || 0.7;
    this.items = [];
    this.arrived = 0;
    this.onArrive = null;
    this.sink = !!opts.sink;
  }
  get length() { return this.path.length; }
  canAdd() { return !this.items.length || this.items[this.items.length - 1].s > this.spacing; }
  addItem(obj, s = 0) {
    this.itemsGroup.attach(obj);
    obj.rotation.set(0, 0, 0);
    const it = { obj, s };
    this.items.push(it);
    this.items.sort((a, b) => b.s - a.s);
    this.placeItem(it);
    return it;
  }
  placeItem(it) {
    const { p, dir } = pointOnSegs(this.path.segs, it.s);
    it.obj.position.set(p.x, this.path.height + 0.005, p.z);
    it.obj.rotation.y = Math.atan2(-dir.z, dir.x) + (this.opts.itemYaw || 0);
  }
  update(dt) {
    this.path.beltMat.map.offset.y -= (this.speedMs * dt) / 0.6;
    const L = this.path.length;
    let ahead = Infinity;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const end = this.sink ? L + 0.4 : L - (this.opts.endMargin ?? 0.35);
      const limit = i === 0 ? end : ahead - this.spacing;
      it.s = Math.min(it.s + this.speedMs * dt, Math.max(it.s, limit));
      this.placeItem(it);
      ahead = it.s;
    }
    if (this.sink && this.items.length && this.items[0].s >= L + 0.3) {
      const it = this.items.shift();
      it.obj.parent?.remove(it.obj);
      this.arrived++;
      this.onArrive?.(it);
    }
  }
  atEnd() {
    const it = this.items[0];
    return it && it.s >= this.path.length - (this.opts.endMargin ?? 0.35) - 0.02 ? it : null;
  }
  take() {
    const it = this.items.shift();
    return it ? it.obj : null;
  }
}

export class Conveyor extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const p = def.params;
    this.cfg = p;
    this.track = new Track(this, this.static, p.path, { ...p, sink: !!p.bin });
    this.labelHeight = p.height + 1.4;
    if (p.bin) {
      const end = p.path[p.path.length - 1];
      const prev = p.path[p.path.length - 2];
      const d = new THREE.Vector2(end[0] - prev[0], end[1] - prev[1]).normalize();
      const bx = end[0] + d.x * 0.55, bz = end[1] + d.y * 0.55;
      box(this.static, 0.9, 0.3, 0.7, M().grey, bx, 0, bz);
      this.binTote = tote(this.dyn(this.root), M().toteBlue, bx, 0.3, bz, 1.4);
      this.binTote.rotation.y = Math.atan2(-d.y, d.x);
      this.binFill = box(this.binTote, 0.52, 0.2, 0.32, p.fillMat || M().cover, 0, 0.05, 0);
      this.binFill.userData.noMerge = true;
      this.binFill.scale.y = 0.2;
      this.track.onArrive = () => { this.fill = Math.min(1, (this.fill || 0) + 1 / 10); this.updateFill(); };
    }
  }
  updateFill() { if (this.binFill) { this.binFill.scale.y = 0.1 + (this.fill || 0) * 1.1; this.binFill.visible = (this.fill || 0) > 0.02; } }
  // bin handling for AGV pick-up
  get binFull() { return (this.fill || 0) >= 0.5; }
  emptyBin() { this.fill = 0; this.updateFill(); }
  binWorld(target = new THREE.Vector3()) { return this.binTote.getWorldPosition(target); }
  place() { this.root.position.set(0, 0, 0); }
  canAdd() { return this.track.canAdd(); }
  addItem(obj, s) { return this.track.addItem(obj, s); }
  atEnd() { return this.track.atEnd(); }
  take() { return this.track.take(); }
  get items() { return this.track.items; }
  update(dt) { this.track.update(dt); }
}
