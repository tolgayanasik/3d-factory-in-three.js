// Automated storage & retrieval system: high-bay rack (instanced), stacker
// cranes with telescopic forks, and the pick & drop I/O conveyors.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, paint } from '../world/materials.js';
import { Equipment, box, rbox, cyl, group, mesh, G, easeInOut, lerp, cabinet, fence, tote } from './common.js';
import { Track } from './conveyor.js';
import { ASRS } from '../../shared/catalog.js';

export const TOTE_SCALE = 1.6;
const bayW = (ASRS.zMax - ASRS.zMin) / ASRS.bays;
export const slotZ = (bay) => ASRS.zMin + (bay + 0.5) * bayW;
export const slotY = (lvl) => ASRS.baseH + lvl * ASRS.levelH;
export const rowX = (aisle, side) => ASRS.aisles[aisle] + side * (ASRS.aisleWidth / 2 + ASRS.rackDepth / 2);
export const IO_BAY = ASRS.bays - 1; // first bay, bottom level of left row = P&D position

let _toteGeo = null;
function toteGeometry() {
  if (_toteGeo) return _toteGeo;
  const g = tote(null, M().toteBlue, 0, 0, 0, TOTE_SCALE);
  g.updateMatrixWorld(true);
  const geos = [];
  g.traverse((o) => { if (o.isMesh) { const c = o.geometry.clone(); c.applyMatrix4(o.matrixWorld); geos.push(c); } });
  _toteGeo = mergeGeometries(geos);
  _toteGeo.rotateY(Math.PI / 2);
  return _toteGeo;
}

export function makeTote(color = 0x2f6fd1, withParts = true, partMat) {
  const g = tote(null, paint(color, { rough: 0.55, metal: 0 }), 0, 0, 0, TOTE_SCALE);
  if (withParts) box(g, 0.52, 0.16, 0.34, partMat || M().housing, 0, 0.04, 0);
  g.userData.dynamic = true;
  return g;
}

export class Rack extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    this.labelHeight = 11.6;
    const H = slotY(ASRS.levels) + 0.35;
    const rows = [];
    ASRS.aisles.forEach((ax, a) => [-1, 1].forEach((side) => rows.push({ a, side, x: rowX(a, side) })));
    this.rows = rows;
    const tmp = new THREE.Object3D();
    const up = [], beams = [], braces = [];
    for (const r of rows) {
      for (let b = 0; b <= ASRS.bays; b++) {
        const z = ASRS.zMin + b * bayW;
        for (const dx of [-0.55, 0.55]) up.push([r.x + dx, H / 2, z]);
        for (let k = 0; k < 7; k++) braces.push([r.x, 0.8 + k * 1.45, z, k % 2 ? 0.8 : -0.8]);
      }
      for (let b = 0; b < ASRS.bays; b++) {
        const z = slotZ(b);
        for (let l = 0; l < ASRS.levels + 1; l++) for (const dx of [-0.55, 0.55]) beams.push([r.x + dx, slotY(l) - 0.06, z]);
      }
    }
    const inst = (geo, mat, list, f) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((v, i) => { f(tmp, v); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); });
      im.castShadow = true; im.receiveShadow = true;
      this.root.add(im);
      return im;
    };
    inst(G.box(0.09, H, 0.08), m.blue, up, (o, v) => { o.position.set(v[0], v[1], v[2]); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); });
    inst(G.box(0.06, 0.12, bayW - 0.08), m.rackBeam, beams, (o, v) => { o.position.set(v[0], v[1], v[2]); o.rotation.set(0, 0, 0); });
    inst(G.box(1.1, 0.04, 0.03), m.blue, braces, (o, v) => { o.position.set(v[0], v[1], v[2]); o.rotation.set(0, 0, v[3]); });
    // top ties & base rails per aisle
    for (const ax of ASRS.aisles) {
      box(this.static, 0.18, 0.06, ASRS.zMax - ASRS.zMin + 1.6, m.steel, ax, 0, (ASRS.zMin + ASRS.zMax) / 2 - 0.4);
      box(this.static, 0.2, 0.2, ASRS.zMax - ASRS.zMin + 1.6, m.darkGrey, ax, H + 0.1, (ASRS.zMin + ASRS.zMax) / 2 - 0.4);
      for (let z = ASRS.zMin; z <= ASRS.zMax; z += bayW * 4) box(this.static, ASRS.aisleWidth + 2.4, 0.15, 0.1, m.darkGrey, ax, H + 0.1, z);
    }
    // sprinkler lines
    for (const r of rows) if (r.side === 1) cyl(this.static, 0.04, ASRS.zMax - ASRS.zMin, m.red, r.x + 0.6, H - 0.4, (ASRS.zMin + ASRS.zMax) / 2, 'z', 8);
    // safety fence around the rack block (front stays open for P&D)
    const x0 = ASRS.aisles[0] - 2.8, x1 = ASRS.aisles[ASRS.aisles.length - 1] + 2.8;
    fence(this.static, [[x0, ASRS.zMax + 0.5], [x0, ASRS.zMin - 1.4], [x1, ASRS.zMin - 1.4], [x1, ASRS.zMax + 0.5]], 2.4);
    // Totes
    this.slots = [];
    rows.forEach((r) => { for (let b = 0; b < ASRS.bays; b++) for (let l = 0; l < ASRS.levels; l++) this.slots.push({ a: r.a, side: r.side, bay: b, lvl: l, x: r.x, occ: false }); });
    this.totes = new THREE.InstancedMesh(toteGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.55 }), this.slots.length);
    this.totes.castShadow = true; this.totes.receiveShadow = true;
    const palette = [0x2f6fd1, 0x2f6fd1, 0x2f6fd1, 0x5d6770, 0xf2c318, 0x2f6fd1, 0x29a36b];
    const c = new THREE.Color();
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.slots.forEach((s, i) => {
      s.occ = !(s.a !== undefined && s.side === -1 && s.bay === IO_BAY && s.lvl === 0) && rnd() < 0.74;
      if (s.side === -1 && s.bay === IO_BAY && s.lvl === 0) s.io = true;
      this.totes.setColorAt(i, c.setHex(palette[(rnd() * palette.length) | 0]));
      this.setSlot(i, s.occ);
    });
    this.root.add(this.totes);
    this.andon(x0 + 0.3, 2.4, ASRS.zMax + 0.5);
  }
  place() { this.root.position.set(0, 0, 0); }
  setSlot(i, occ) {
    const s = this.slots[i];
    s.occ = occ;
    const tmp = new THREE.Object3D();
    tmp.position.set(s.x, slotY(s.lvl) + 0.005, slotZ(s.bay));
    tmp.scale.setScalar(occ ? 1 : 0.0001);
    tmp.updateMatrix();
    this.totes.setMatrixAt(i, tmp.matrix);
    this.totes.instanceMatrix.needsUpdate = true;
  }
  get occupancy() {
    const n = this.slots.filter((s) => !s.io).length;
    return this.slots.filter((s) => s.occ && !s.io).length / n;
  }
  pick(aisle, wantOcc) {
    const list = this.slots.map((s, i) => [s, i]).filter(([s]) => s.a === aisle && !s.io && s.occ === wantOcc);
    if (!list.length) return -1;
    return list[(Math.random() * list.length) | 0][1];
  }
}

// ---------------------------------------------------------------------------
export class StackerCrane extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    this.aisle = def.params.aisle;
    this.mode = def.params.mode;
    const H = slotY(ASRS.levels) + 0.1;
    this.labelHeight = H + 1.4;
    this.crane = this.dyn(this.root, 0, 0, 0);
    const c = this.crane;
    // bottom carriage & wheels
    rbox(c, 0.6, 0.5, 2.6, m.safetyYellow, 0, 0.06, -0.8, 0.05);
    for (const z of [-1.8, 0.2]) cyl(c, 0.18, 0.2, m.darkGrey, 0, 0.18, z, 'x', 16);
    box(c, 0.62, 0.05, 2.62, m.hazard, 0, 0.56, -0.8);
    // mast
    rbox(c, 0.42, H + 0.1, 0.34, m.alu, 0, 0.5, -0.8, 0.03);
    box(c, 0.44, 0.35, 0.8, m.safetyYellow, 0, H + 0.4, -0.8);
    cabinet(c, 0.55, 1.4, 0.4, 0, -1.9, 0, m.offWhite, 0.56);
    box(c, 0.1, 0.1, 0.1, m.ledBlue, 0.25, H + 0.8, -0.8);
    // lifting carriage with telescopic fork
    this.lift = this.dyn(c, 0, 0.8, 0);
    box(this.lift, 1.0, 0.14, 1.15, m.darkGrey, 0, -0.14, 0);
    box(this.lift, 0.1, 0.9, 1.15, m.safetyYellow, 0, -0.14, -0.62);
    box(this.lift, 0.6, 0.1, 0.1, m.safetyYellow, 0, 0.7, -0.62);
    this.fork = this.dyn(this.lift, 0, 0, 0);
    for (const z of [-0.3, 0.3]) box(this.fork, 1.05, 0.05, 0.12, m.steel, 0, 0, z);
    this.load = makeTote(0x2f6fd1, true);
    this.load.rotation.y = Math.PI / 2;
    this.load.position.set(0, 0.05, 0);
    this.load.visible = false;
    this.load.userData.dynamic = true;
    this.fork.add(this.load);
    this.cur = { z: -8, y: 0.8 };
    this.task = null;
    this.idleT = 0;
  }
  place() { this.root.position.set(ASRS.aisles[this.aisle], 0, 0); this.setPos(-8, 0.8); }
  setPos(z, y) { this.crane.position.z = z; this.lift.position.y = y; this.cur = { z, y }; }
  link() { this.rack = this.ctx.get('RCK-01'); this.io = this.ctx.get('CNV-A01'); }
  // Build a movement script: go to (z,y) → fork out to side → lift/lower → fork in
  plan(steps) { this.task = { steps, i: 0, t: 0, from: null }; }
  update(dt) {
    if (!this.rack) return;
    if (!this.task) {
      this.idleT += dt;
      const lane = this.io?.lanes[this.aisle];
      const ioZ = slotZ(IO_BAY), ioY = slotY(0) + 0.42;
      if (this.mode === 'in' && lane?.atEnd()) {
        const slot = this.rack.pick(this.aisle, false);
        if (slot < 0) return;
        const s = this.rack.slots[slot];
        this.plan([
          { go: [ioZ, ioY] }, { fork: -1 }, { lift: 0.1, call: () => { const t = lane.take(); t?.parent?.remove(t); this.load.visible = true; } }, { fork: 0 },
          { go: [slotZ(s.bay), slotY(s.lvl) + 0.12] }, { fork: s.side }, { lift: -0.1, call: () => { this.load.visible = false; this.rack.setSlot(slot, true); } }, { fork: 0 },
        ]);
      } else if (this.mode === 'out' && lane && lane.canAdd() && this.io.outDemand(this.aisle)) {
        const slot = this.rack.pick(this.aisle, true);
        if (slot < 0) return;
        const s = this.rack.slots[slot];
        this.plan([
          { go: [slotZ(s.bay), slotY(s.lvl) + 0.02] }, { fork: s.side }, { lift: 0.1, call: () => { this.rack.setSlot(slot, false); this.load.visible = true; } }, { fork: 0 },
          { go: [ioZ, ioY + 0.1] }, { fork: -1 }, { lift: -0.1, call: () => { this.load.visible = false; this.io.pushOut(this.aisle); } }, { fork: 0 },
        ]);
      } else if (this.idleT > 6) {
        // housekeeping: relocate a tote to keep fast movers near the front
        const from = this.rack.pick(this.aisle, true), to = this.rack.pick(this.aisle, false);
        if (from < 0 || to < 0) return;
        const a = this.rack.slots[from], b = this.rack.slots[to];
        this.plan([
          { go: [slotZ(a.bay), slotY(a.lvl) + 0.02] }, { fork: a.side }, { lift: 0.1, call: () => { this.rack.setSlot(from, false); this.load.visible = true; } }, { fork: 0 },
          { go: [slotZ(b.bay), slotY(b.lvl) + 0.12] }, { fork: b.side }, { lift: -0.1, call: () => { this.load.visible = false; this.rack.setSlot(to, true); } }, { fork: 0 },
        ]);
      }
      if (this.task) this.idleT = 0;
      return;
    }
    const T = this.task;
    const st = T.steps[T.i];
    if (!T.from) {
      T.from = { z: this.cur.z, y: this.cur.y, f: this.fork.position.x };
      if (st.go) T.dur = Math.max(Math.abs(st.go[0] - T.from.z) / 3.2, Math.abs(st.go[1] - T.from.y) / 1.3) + 0.6;
      else if (st.fork !== undefined) T.dur = 0.9;
      else T.dur = 0.5;
    }
    T.t += dt;
    const k = easeInOut(Math.min(1, T.t / T.dur));
    if (st.go) this.setPos(lerp(T.from.z, st.go[0], k), lerp(T.from.y, st.go[1], k));
    else if (st.fork !== undefined) this.fork.position.x = lerp(T.from.f, st.fork * (ASRS.aisleWidth / 2 + ASRS.rackDepth / 2), k);
    else if (st.lift !== undefined) this.setPos(this.cur.z, T.from.y + st.lift * k);
    if (T.t >= T.dur) {
      st.call?.();
      T.i++; T.t = 0; T.from = null;
      if (T.i >= T.steps.length) this.task = null;
    }
  }
}

// ---------------------------------------------------------------------------
export class AsrsIO extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    this.labelHeight = 2.2;
    const z1 = slotZ(IO_BAY), z0 = ASRS.ioZ[1];
    this.lanes = ASRS.aisles.map((ax, i) => {
      const x = rowX(i, -1);
      const out = i === ASRS.aisles.length - 1;
      const pts = out ? [[x, z1], [x, z0]] : [[x, z0], [x, z1]];
      const tr = new Track(this, this.static, pts, { width: 1.0, height: 0.75, kind: 'roller', spacing: 1.25, speed: 0.6, endMargin: 0.02, itemYaw: Math.PI / 2 });
      box(this.static, 0.06, 1.6, 0.06, M().safetyYellow, x + 0.6, 0, z0 + 0.2);
      box(this.static, 0.06, 1.6, 0.06, M().safetyYellow, x - 0.6, 0, z0 + 0.2);
      box(this.static, 1.3, 0.06, 0.06, M().safetyYellow, x, 1.55, z0 + 0.2);
      return tr;
    });
    this.andon(rowX(0, -1) - 0.7, 1.6, z0 + 0.2);
    this.pendingOut = [0, 0, 0];
  }
  place() { this.root.position.set(0, 0, 0); }
  outDemand(a) { return this.lanes[a].items.length < 2; }
  pushOut(a) {
    const t = makeTote(0x2f6fd1, true, M().housing);
    const lane = this.lanes[a];
    this.dynamicAdd(t);
    lane.addItem(t, 0);
  }
  dynamicAdd(o) { this.root.add(o); }
  // AGV interface: position of the lane mouth (towards the aisle)
  mouth(a) { const x = rowX(a, -1); return new THREE.Vector3(x, 0, ASRS.ioZ[1]); }
  update(dt) { this.lanes.forEach((l) => l.update(dt)); }
}
