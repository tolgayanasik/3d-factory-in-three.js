// Injection moulding machine with toggle clamp, injection unit, and a
// Cartesian take-out robot (registered as its own equipment item).
import * as THREE from 'three';
import { M, paint } from '../world/materials.js';
import { Equipment, box, rbox, cyl, group, mesh, hmi, G, easeInOut, lerp, cabinet, part } from './common.js';

export function makeCover(scale = 1, mat = M().cover) {
  const g = new THREE.Group();
  const m = part(g, 'cover', [[0.34, 0.05, 0.24, 0, 0, 0], [0.3, 0.02, 0.2, 0, 0.05, 0]], mat);
  m.scale.setScalar(scale);
  g.userData.dynamic = true;
  return g;
}

class Picker extends Equipment {
  constructor(def, ctx, imm) {
    super(def, ctx);
    this.imm = imm;
    const m = M();
    const r = this.root;
    // mounted on top of the fixed platen (local coords of IMM)
    r.position.set(-1.75, 0, 0);
    box(this.static, 1.4, 0.2, 0.3, m.darkGrey, 0.6, 2.8, 0.2);
    box(this.static, 0.3, 0.4, 0.3, m.darkGrey, 0, 2.95, 0.2);
    rbox(this.static, 0.24, 0.26, 3.9, m.white, 0, 3.3, -1.0, 0.04);
    box(this.static, 0.26, 0.05, 3.9, paint(0xf28c28), 0, 3.56, -1.0);
    box(this.static, 0.18, 0.6, 0.2, m.darkGrey, 0, 3.3, -2.95);
    cabinet(this.static, 0.5, 0.5, 0.3, 1.15, 0.75, 0, m.white, 2.95);
    this.car = this.dyn(this.root, 0, 3.3, 0.2);
    rbox(this.car, 0.4, 0.34, 0.32, m.white, 0, -0.1, 0, 0.04);
    cyl(this.car, 0.07, 0.18, m.charcoal, 0, 0.27, 0.0, 'y', 16);
    this.arm = this.dyn(this.car, 0.12, 0, 0);
    rbox(this.arm, 0.12, 1.5, 0.12, m.alu, 0, -1.3, 0, 0.02);
    box(this.arm, 0.03, 1.5, 0.03, paint(0xf28c28), 0.065, -1.3, 0);
    this.eoat = group(this.arm, 0, -1.35, 0);
    box(this.eoat, 0.5, 0.04, 0.35, m.alu, 0, 0, 0);
    for (const [x, z] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]]) cyl(this.eoat, 0.025, 0.05, m.rubber, x, -0.03, z, 'y', 10);
    this.carried = null;
    this.labelHeight = 3.9;
  }
  place() {}
}

export class IMM extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const p = def.params;
    const s = p.scale || 1;
    const m = M();
    const accent = paint(p.accent || 0x13a8a8, { rough: 0.4, metal: 0.15 });
    const st = this.static;
    this.root.scale.setScalar(s);
    this.labelHeight = 3.6 * s;
    // Base / frame
    box(st, 8.0, 0.15, 1.7, m.charcoal, 0, 0, 0);
    rbox(st, 7.9, 0.85, 1.6, m.white, 0, 0.15, 0, 0.05);
    box(st, 7.92, 0.08, 1.62, accent, 0, 0.62, 0);
    box(st, 6.2, 0.02, 0.02, m.darkGrey, 0.3, 0.45, 0.81);
    for (let i = 0; i < 6; i++) box(st, 0.35, 0.25, 0.02, m.lightGrey, -3.2 + i * 1.2, 0.25, 0.805);
    // clamp unit
    box(st, 0.4, 1.55, 1.55, m.white, -3.65, 1.0, 0);
    box(st, 0.46, 1.8, 1.75, m.white, -0.6, 1.0, 0);
    box(st, 0.48, 0.1, 1.77, accent, -0.6, 2.72, 0);
    for (const [y, z] of [[1.25, 0.58], [1.25, -0.58], [2.35, 0.58], [2.35, -0.58]]) cyl(st, 0.07, 3.4, m.chrome, -2.1, y, z, 'x', 16);
    // toggle cylinder
    cyl(st, 0.14, 0.9, m.darkSteel, -4.2, 1.8, 0, 'x', 20);
    // stationary mould half
    box(st, 0.35, 0.95, 1.0, m.steel, -1.0, 1.32, 0);
    for (const z of [-0.35, 0.35]) cyl(st, 0.03, 0.4, m.toteBlue, -1.0, 2.35, z, 'y', 8);
    // moving platen + mould half
    this.platen = this.dyn(this.root, -2.9, 0, 0);
    box(this.platen, 0.42, 1.55, 1.5, m.white, 0, 1.0, 0);
    box(this.platen, 0.35, 0.95, 1.0, m.steel, 0.38, 1.32, 0);
    box(this.platen, 0.44, 0.08, 1.52, accent, 0, 2.56, 0);
    for (const z of [-0.35, 0.35]) cyl(this.platen, 0.03, 0.4, m.red, 0.38, 2.35, z, 'y', 8);
    this.toggle = [];
    for (const y of [1.4, 2.2]) {
      const l = this.dyn(this.root, 0, y, 0);
      box(l, 1, 0.12, 0.28, m.darkSteel, 0, -0.06, 0);
      this.toggle.push(l);
    }
    this.partInMould = makeCover(1, m.cover);
    this.partInMould.position.set(0.58, 1.7, 0);
    this.partInMould.rotation.z = Math.PI / 2;
    this.platen.add(this.partInMould);
    // Guards (operator side +Z and rear -Z)
    for (const zs of [1, -1]) {
      box(st, 3.6, 0.06, 0.06, m.darkGrey, -2.1, 2.55, zs * 0.92);
      box(st, 0.06, 1.9, 0.06, m.darkGrey, -3.9, 0.68, zs * 0.92);
      box(st, 0.06, 1.9, 0.06, m.darkGrey, -0.3, 0.68, zs * 0.92);
      const gl = mesh(st, G.box(3.5, 1.8, 0.02), m.polycarb, -2.1, 1.65, zs * 0.92);
      gl.castShadow = false;
    }
    box(st, 0.6, 0.08, 0.04, m.darkGrey, -2.1, 1.7, 0.96); // door handle
    // Injection unit
    box(st, 3.6, 0.12, 0.9, m.darkGrey, 1.9, 0.77, 0);
    this.carriage = this.dyn(this.root, 0, 0, 0);
    const c = this.carriage;
    this.barrelGlow = new THREE.MeshStandardMaterial({ color: 0x3b3f44, emissive: 0xff5a1a, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.6 });
    cyl(c, 0.1, 2.1, m.steel, 0.55, 1.7, 0, 'x', 20);
    for (let i = 0; i < 6; i++) cyl(c, 0.135, 0.18, this.barrelGlow, -0.3 + i * 0.33, 1.7, 0, 'x', 20);
    cyl(c, 0.05, 0.3, m.chrome, -0.6, 1.7, 0, 'x', 12, 0.02);
    rbox(c, 1.3, 0.9, 0.95, m.white, 2.35, 1.25, 0, 0.05);
    box(c, 1.32, 0.06, 0.97, accent, 2.35, 2.0, 0);
    cyl(c, 0.22, 0.6, m.charcoal, 3.2, 1.72, 0, 'x', 24);
    // hopper + dryer loader
    cyl(c, 0.08, 0.35, m.steel, 1.85, 2.05, 0, 'y', 16);
    cyl(c, 0.3, 0.55, m.steel, 1.85, 2.5, 0, 'y', 24, 0.3);
    mesh(c, G.cyl(0.3, 0.08, 0.3, 24), m.steel, 1.85, 2.1, 0);
    cyl(c, 0.22, 0.3, m.white, 1.85, 2.93, 0, 'y', 20);
    box(c, 0.3, 0.12, 0.3, m.darkGrey, 1.85, 3.08, 0);
    // purge guard
    const pg = mesh(st, G.box(0.9, 0.7, 1.1), m.polycarb, 0.1, 1.85, 0);
    pg.castShadow = false;
    // control cabinet & HMI on operator side
    cabinet(st, 1.2, 1.1, 0.5, 2.6, 1.08, 0, m.white, 0);
    hmi(st, 0.6, 1.9, 1.05, 0, '#13a8a8');
    // Hoses from mould temperature controller
    cabinet(st, 0.5, 0.9, 0.6, -2.0, -1.25, Math.PI, m.toteBlue, 0);
    this.andon(-0.6, 2.8, 0.75);
    // Take-out robot as child equipment
    const pdef = ctx.defs.get(p.picker);
    if (pdef) {
      this.picker = new Picker(pdef, ctx, this);
      this.root.add(this.picker.root);
      ctx.register(this.picker);
    }
    this.xOpen = -2.9; this.xClosed = -1.78;
    this.mState = 'close'; this.mT = 0;
    this.pState = 'home'; this.pT = 0;
    this.cycleCount = 0;
    this.partReady = false;
  }

  update(dt) {
    if (!dt) return;
    const P = this.picker;
    const pickerRun = !P || P.running;
    // ---- mould state machine
    this.mT += dt;
    const D = { close: 0.9, inject: 0.9, cool: 1.8, open: 0.9 };
    const mk = (n) => easeInOut(Math.min(1, this.mT / D[n]));
    switch (this.mState) {
      case 'close': this.platenX(lerp(this.xOpen, this.xClosed, mk('close'))); if (this.mT > D.close) this.next('inject'); break;
      case 'inject': {
        const k = Math.sin(Math.min(1, this.mT / D.inject) * Math.PI);
        this.carriage.position.x = -0.08 * k;
        this.barrelGlow.emissiveIntensity = 0.15 + 0.6 * k;
        this.partInMould.visible = true;
        if (this.mT > D.inject) this.next('cool');
        break;
      }
      case 'cool': if (this.mT > D.cool) this.next('open'); break;
      case 'open': this.platenX(lerp(this.xClosed, this.xOpen, mk('open'))); if (this.mT > D.open) { this.next('wait'); this.partReady = true; } break;
      case 'wait': if (!this.partReady) this.next('close'); break;
    }
    // ---- picker state machine
    if (!P) { if (this.mState === 'wait') { this.partInMould.visible = false; this.partReady = false; } return; }
    if (!pickerRun) return;
    this.pT += dt;
    const car = P.car, arm = P.arm;
    const zIn = 0.0, zOut = -2.3, zHome = 0.2;
    const upY = 0, downY = -0.38, dropY = -1.05;
    const step = (dur) => easeInOut(Math.min(1, this.pT / dur));
    switch (this.pState) {
      case 'home': car.position.z = zHome; if (this.partReady) this.pnext('in'); break;
      case 'in': car.position.z = lerp(zHome, zIn, step(0.3)); arm.position.x = lerp(0.12, -0.45, step(0.3)); if (this.pT > 0.3) this.pnext('down'); break;
      case 'down': arm.position.y = lerp(upY, downY, step(0.4)); if (this.pT > 0.4) this.pnext('grip'); break;
      case 'grip':
        if (this.pT > 0.2) {
          this.partInMould.visible = false;
          P.carried = makeCover(1);
          P.eoat.add(P.carried);
          P.carried.position.set(0, -0.08, 0);
          this.partReady = false;
          this.pnext('up');
        }
        break;
      case 'up': arm.position.y = lerp(downY, upY, step(0.4)); arm.position.x = lerp(-0.45, 0.12, step(0.4)); if (this.pT > 0.4) this.pnext('out'); break;
      case 'out': car.position.z = lerp(zIn, zOut, step(0.8)); if (this.pT > 0.8) this.pnext('lower'); break;
      case 'lower': arm.position.y = lerp(upY, dropY, step(0.45)); if (this.pT > 0.45) this.pnext('release'); break;
      case 'release': {
        const conv = this.ctx.get(this.def.params.conveyor);
        if (this.pT > 0.15 && (!conv || conv.canAdd())) {
          if (conv && P.carried) conv.addItem(P.carried);
          else P.carried?.parent?.remove(P.carried);
          P.carried = null;
          this.cycleCount++;
          this.pnext('raise');
        }
        break;
      }
      case 'raise': arm.position.y = lerp(dropY, upY, step(0.45)); if (this.pT > 0.45) this.pnext('back'); break;
      case 'back': car.position.z = lerp(zOut, zHome, step(0.8)); if (this.pT > 0.8) this.pnext('home'); break;
    }
  }
  next(s) { this.mState = s; this.mT = 0; }
  pnext(s) { this.pState = s; this.pT = 0; }
  platenX(x) {
    this.platen.position.x = x;
    const span = x - -3.45;
    this.toggle.forEach((l) => { l.position.x = -3.45 + span / 2; l.scale.x = span; });
  }
}
