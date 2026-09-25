// Articulated 6-axis robot + SCARA with analytic inverse kinematics and a small
// motion-program runner (world-space targets, joint-space interpolation).
import * as THREE from 'three';
import { M, paint } from '../world/materials.js';
import { box, rbox, cyl, group, mesh, G, easeInOut, clamp } from './common.js';

const _v = new THREE.Vector3();

export class RobotArm {
  constructor(parent, { scale = 1, color = 0xf28c28, accent = null, tool = 'gripper', pedestal = 0 } = {}) {
    const m = M();
    const body = paint(color, { rough: 0.35, metal: 0.15 });
    const dark = m.charcoal;
    const acc = accent ? paint(accent, { rough: 0.4, metal: 0.1 }) : dark;
    this.scale = scale;
    this.root = group(parent);
    this.root.userData.dynamic = true;
    // Pedestal
    if (pedestal > 0) {
      box(this.root, 0.7 * scale, pedestal, 0.7 * scale, m.darkGrey, 0, 0, 0);
      box(this.root, 0.9 * scale, 0.03, 0.9 * scale, m.grey, 0, pedestal - 0.03, 0);
    }
    this.base = group(this.root, 0, pedestal, 0);
    this.base.scale.setScalar(scale);
    const b = this.base;
    cyl(b, 0.34, 0.12, dark, 0, 0.06, 0, 'y', 28);
    cyl(b, 0.27, 0.1, body, 0, 0.16, 0, 'y', 28);
    // J1 turret
    this.j1 = group(b, 0, 0.2, 0);
    const j1 = this.j1;
    rbox(j1, 0.46, 0.34, 0.42, body, 0.04, 0, 0, 0.06);
    cyl(j1, 0.1, 0.2, dark, -0.16, 0.3, 0.0, 'y', 16); // J1 motor
    // J2 shoulder
    this.sr = 0.18; this.sh = 0.2 + 0.4;
    this.a = 0.85; this.b = 0.9;
    this.j2 = group(j1, this.sr, 0.4, 0);
    const j2 = this.j2;
    cyl(j2, 0.17, 0.46, body, 0, 0, 0, 'z', 28);
    cyl(j2, 0.11, 0.1, dark, 0, 0, 0.28, 'z', 20);
    cyl(j2, 0.11, 0.1, acc, 0, 0, -0.28, 'z', 20);
    rbox(j2, 0.22, this.a, 0.22, body, 0, 0, 0, 0.07);
    // counterweight / spring
    cyl(j2, 0.05, 0.55, m.darkGrey, -0.14, 0.25, 0.14, 'y', 12);
    // J3 elbow
    this.j3 = group(j2, 0, this.a, 0);
    const j3 = this.j3;
    cyl(j3, 0.15, 0.36, body, 0, 0, 0, 'z', 24);
    rbox(j3, 0.26, 0.3, 0.26, body, 0, -0.18, 0, 0.06); // rear housing w/ motors
    cyl(j3, 0.08, 0.14, dark, 0, -0.2, 0.18, 'z', 16);
    mesh(j3, G.cyl(0.08, 0.11, this.b - 0.1, 20), body, 0, (this.b - 0.1) / 2 + 0.05, 0);
    // J5 wrist
    this.j5 = group(j3, 0, this.b, 0);
    const j5 = this.j5;
    cyl(j5, 0.075, 0.2, body, 0, 0, 0, 'z', 20);
    // J6 flange + tool
    this.j6 = group(j5, 0, 0.1, 0);
    cyl(this.j6, 0.05, 0.05, dark, 0, 0.025, 0, 'y', 16);
    this.tool = group(this.j6, 0, 0.05, 0);
    this.toolLen = this.buildTool(tool, m);
    this.tipLen = 0.15 + this.toolLen; // wrist centre → tool tip
    this.tip = group(this.tool, 0, this.toolLen, 0);
    for (const g of [this.base, this.j1, this.j2, this.j3, this.j5, this.j6, this.tool, this.tip]) g.userData.dynamic = true;
    this.fingers.forEach(([f]) => (f.userData.dynamic = true));
    this.q = [0, 0.1, 1.4, 0]; // j1, theta1, phi(abs forearm), roll
    this.apply(this.q);
    this.queue = [];
    this.step = null;
    this.payload = null;
    this.gripOpen = 1;
  }

  buildTool(tool, m) {
    const t = this.tool;
    this.fingers = [];
    if (tool === 'gripper') {
      box(t, 0.14, 0.08, 0.1, m.darkGrey, 0, 0, 0);
      for (const s of [-1, 1]) {
        const f = group(t, s * 0.045, 0.08, 0);
        box(f, 0.02, 0.1, 0.06, m.alu, 0, 0, 0);
        this.fingers.push([f, s, 0.03, 0.035]);
      }
      return 0.17;
    }
    if (tool === 'vacuum') {
      cyl(t, 0.04, 0.12, m.darkGrey, 0, 0.06, 0, 'y', 12);
      box(t, 0.9, 0.04, 0.05, m.alu, 0, 0.12, 0);
      box(t, 0.05, 0.04, 0.6, m.alu, 0, 0.12, 0);
      for (const [x, z] of [[-0.4, 0], [0.4, 0], [0, -0.28], [0, 0.28], [-0.2, 0], [0.2, 0]]) {
        cyl(t, 0.012, 0.06, m.steel, x, 0.17, z, 'y', 8);
        cyl(t, 0.035, 0.03, m.rubber, x, 0.21, z, 'y', 12, 0.02);
      }
      return 0.225;
    }
    if (tool === 'clamp') {
      box(t, 0.2, 0.12, 0.2, m.darkGrey, 0, 0.06, 0);
      box(t, 0.7, 0.06, 0.5, m.charcoal, 0, 0.15, 0);
      for (const s of [-1, 1]) {
        const f = group(t, s * 0.33, 0.18, 0);
        box(f, 0.03, 0.4, 0.46, m.alu, 0, 0, 0);
        this.fingers.push([f, s, 0.2, 0.13]);
      }
      return 0.52;
    }
    if (tool === 'labeler') {
      box(t, 0.16, 0.14, 0.1, m.white, 0, 0, 0);
      cyl(t, 0.05, 0.03, m.charcoal, 0, 0.07, 0.06, 'z', 16);
      box(t, 0.12, 0.05, 0.08, m.darkGrey, 0, 0.14, 0);
      return 0.19;
    }
    // generic
    box(t, 0.08, 0.15, 0.08, m.darkGrey, 0, 0, 0);
    return 0.15;
  }

  apply(q) {
    this.j1.rotation.y = q[0];
    this.j2.rotation.z = -q[1];
    this.j3.rotation.z = -(q[2] - q[1]);
    this.j5.rotation.z = -(Math.PI - q[2]);
    this.j6.rotation.y = q[3] || 0;
    // fingers
    for (const [f, s, base, travel] of this.fingers) f.position.x = s * (base + travel * this.gripOpen);
  }

  // IK for a tool-down pose at world point p (with tool roll)
  solve(p, roll = 0) {
    _v.copy(p);
    this.base.worldToLocal(_v);
    const x = _v.x, y = _v.y, z = _v.z;
    const j1 = Math.atan2(-z, x);
    const r = Math.hypot(x, z);
    const wr = r - this.sr, wh = y + this.tipLen - this.sh;
    let D = Math.hypot(wr, wh);
    const maxD = this.a + this.b - 0.02;
    const D2 = Math.min(D, maxD);
    const alpha = Math.atan2(wr, wh);
    const cb = clamp((this.a * this.a + D2 * D2 - this.b * this.b) / (2 * this.a * D2), -1, 1);
    const beta = Math.acos(cb);
    const t1 = alpha - beta;
    const er = this.a * Math.sin(t1), eh = this.a * Math.cos(t1);
    const k = D2 / (D || 1);
    const phi = Math.atan2(wr * k - er, wh * k - eh);
    return [j1, t1, phi, j1 - roll];
  }

  // Motion program API
  moveTo(p, dur = 1, opts = {}) { this.queue.push({ p: p.clone ? p.clone() : p, dur, ...opts }); return this; }
  wait(dur) { this.queue.push({ wait: dur }); return this; }
  call(fn) { this.queue.push({ call: fn }); return this; }
  until(fn) { this.queue.push({ until: fn }); return this; }
  grip(open, dur = 0.25) { this.queue.push({ grip: open, dur }); return this; }
  home(dur = 1) { this.queue.push({ q: [...this.homeQ], dur }); return this; }
  get busy() { return this.queue.length > 0 || !!this.step; }
  setHome(p) { this.homeQ = this.solve(p); this.q = [...this.homeQ]; this.apply(this.q); }

  update(dt) {
    if (!this.step) {
      if (!this.queue.length) return;
      const s = this.queue.shift();
      if (s.call) { s.call(); return; }
      if (s.until) { if (!s.until()) this.queue.unshift(s); return; }
      this.step = { ...s, t: 0, q0: [...this.q] };
      if (s.p) this.step.q1 = this.solve(typeof s.p === 'function' ? s.p() : s.p, s.roll || 0);
      if (s.q) this.step.q1 = s.q;
      if (s.grip !== undefined) { this.step.g0 = this.gripOpen; }
      // unwrap j1 & roll to shortest path
      if (this.step.q1) {
        for (const i of [0, 3]) {
          let d = this.step.q1[i] - this.step.q0[i];
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          this.step.q1[i] = this.step.q0[i] + d;
        }
      }
    }
    const s = this.step;
    s.t += dt;
    const d = s.wait ?? s.dur ?? 1;
    const k = easeInOut(Math.min(1, s.t / d));
    if (s.q1) {
      for (let i = 0; i < 4; i++) this.q[i] = s.q0[i] + (s.q1[i] - s.q0[i]) * k;
      this.apply(this.q);
    }
    if (s.grip !== undefined) {
      this.gripOpen = s.g0 + ((s.grip ? 1 : 0) - s.g0) * k;
      this.apply(this.q);
    }
    if (s.t >= d) this.step = null;
  }

  // Keeps the object's current world transform while it rides on the tool
  attach(obj) {
    this.payload = obj;
    this.tip.attach(obj);
  }
  release(worldParent) {
    const o = this.payload;
    if (!o) return null;
    this.payload = null;
    if (worldParent) worldParent.attach(o);
    else o.parent?.remove(o);
    return o;
  }
  tipWorld(target = new THREE.Vector3()) { return this.tip.getWorldPosition(target); }
}

// ---------------------------------------------------------------------------
export class ScaraRobot {
  constructor(parent, { color = 0xe9edf0 } = {}) {
    const m = M();
    const body = paint(color, { rough: 0.35, metal: 0.1 });
    this.root = group(parent);
    this.root.userData.dynamic = true;
    box(this.root, 0.36, 0.08, 0.36, m.charcoal, 0, 0, 0);
    rbox(this.root, 0.28, 0.7, 0.3, body, 0, 0.08, 0, 0.05);
    this.l1 = 0.45; this.l2 = 0.4; this.h = 0.86;
    this.a1 = group(this.root, 0, this.h, 0);
    rbox(this.a1, this.l1 + 0.18, 0.14, 0.2, body, this.l1 / 2, -0.07, 0, 0.06);
    cyl(this.a1, 0.1, 0.16, m.charcoal, 0, 0.0, 0, 'y', 20);
    this.a2 = group(this.a1, this.l1, 0, 0);
    rbox(this.a2, this.l2 + 0.14, 0.12, 0.16, body, this.l2 / 2, 0.02, 0, 0.05);
    cyl(this.a2, 0.08, 0.14, m.charcoal, 0, 0.04, 0, 'y', 20);
    this.quill = group(this.a2, this.l2, 0, 0);
    cyl(this.quill, 0.02, 0.7, m.chrome, 0, 0, 0, 'y', 12);
    box(this.quill, 0.08, 0.06, 0.08, m.darkGrey, 0, -0.38, 0);
    for (const s of [-1, 1]) box(this.quill, 0.015, 0.06, 0.04, m.alu, s * 0.025, -0.47, 0);
    this.tip = group(this.quill, 0, -0.47, 0);
    for (const g of [this.a1, this.a2, this.quill, this.tip]) g.userData.dynamic = true;
    this.q = [0.6, 1.2, 0];
    this.queue = []; this.step = null; this.payload = null;
    this.apply();
  }
  apply() {
    this.a1.rotation.y = this.q[0];
    this.a2.rotation.y = this.q[1];
    this.quill.position.y = -this.q[2];
  }
  solve(p) {
    _v.copy(p); this.root.worldToLocal(_v);
    const x = _v.x, z = -_v.z;
    const d = Math.min(Math.hypot(x, z), this.l1 + this.l2 - 0.01);
    const c2 = clamp((d * d - this.l1 * this.l1 - this.l2 * this.l2) / (2 * this.l1 * this.l2), -1, 1);
    const q2 = Math.acos(c2);
    const q1 = Math.atan2(z, x) - Math.atan2(this.l2 * Math.sin(q2), this.l1 + this.l2 * Math.cos(q2));
    const drop = clamp(this.h - 0.47 - _v.y, 0, 0.3);
    return [q1, q2, drop];
  }
  moveTo(p, dur = 0.6) { this.queue.push({ p: p.clone(), dur }); return this; }
  wait(d) { this.queue.push({ wait: d }); return this; }
  call(fn) { this.queue.push({ call: fn }); return this; }
  until(fn) { this.queue.push({ until: fn }); return this; }
  get busy() { return this.queue.length > 0 || !!this.step; }
  update(dt) {
    if (!this.step) {
      if (!this.queue.length) return;
      const s = this.queue.shift();
      if (s.call) { s.call(); return; }
      if (s.until) { if (!s.until()) this.queue.unshift(s); return; }
      this.step = { ...s, t: 0, q0: [...this.q], q1: s.p ? this.solve(s.p) : null };
    }
    const s = this.step;
    s.t += dt;
    const d = s.wait ?? s.dur;
    const k = easeInOut(Math.min(1, s.t / d));
    if (s.q1) { for (let i = 0; i < 3; i++) this.q[i] = s.q0[i] + (s.q1[i] - s.q0[i]) * k; this.apply(); }
    if (s.t >= d) this.step = null;
  }
  attach(obj) { this.payload = obj; this.tip.attach(obj); }
  release(worldParent) { const o = this.payload; this.payload = null; if (o) { if (worldParent) worldParent.attach(o); else o.parent?.remove(o); } return o; }
}
