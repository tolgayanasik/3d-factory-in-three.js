// Sheet metal shop: fiber lasers, sheet towers, press brakes, presses, crane.
import * as THREE from 'three';
import { M, paint } from '../world/materials.js';
import { Equipment, box, rbox, cyl, group, mesh, hmi, G, easeInOut, lerp, cabinet, fence, pallet, timeline } from './common.js';

// Spark particle system (additive points)
export class Sparks {
  constructor(parent, count = 90, color = 0xffb040) {
    this.count = count;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    mat.color.multiplyScalar(4);
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.origin = new THREE.Vector3();
    this.active = true;
  }
  update(dt) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        if (!this.active) { p[i * 3 + 1] = -100; continue; }
        this.life[i] = 0.15 + Math.random() * 0.35;
        p[i * 3] = this.origin.x; p[i * 3 + 1] = this.origin.y; p[i * 3 + 2] = this.origin.z;
        const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 2.2;
        v[i * 3] = Math.cos(a) * s; v[i * 3 + 1] = -Math.random() * 2.5; v[i * 3 + 2] = Math.sin(a) * s;
      }
      v[i * 3 + 1] -= 9.8 * dt;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
export class LaserCutter extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    const dark = m.charcoal;
    this.labelHeight = 3.2;
    // machine bed
    box(st, 6.4, 0.75, 2.6, m.darkGrey, 0.2, 0, 0);
    // enclosure frame
    const W = 6.8, D = 3.4, H = 2.4, cx = 0.2;
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) box(st, 0.12, H, 0.12, m.white, cx + x, 0, z);
    for (const z of [-D / 2, D / 2]) box(st, W, 0.18, 0.12, m.white, cx, H - 0.18, z);
    for (const x of [-W / 2, W / 2]) box(st, 0.12, 0.18, D, m.white, cx + x, H - 0.18, 0);
    // front: big orange windows, rear panels
    const fw = mesh(st, G.box(W - 0.2, 1.4, 0.02), m.glassOrange, cx, 1.35, D / 2);
    fw.castShadow = false;
    box(st, W - 0.1, 0.62, 0.06, m.white, cx, 0, D / 2);
    box(st, W - 0.1, 0.08, 0.07, paint(0xff7a00), cx, 0.58, D / 2);
    box(st, W - 0.1, H - 0.2, 0.06, m.offWhite, cx, 0, -D / 2);
    box(st, 0.06, H - 0.2, D, m.offWhite, cx + W / 2, 0, 0);
    // roof: glass
    const roof = mesh(st, G.box(W, 0.02, D), m.glassOrange, cx, H, 0);
    roof.castShadow = false;
    // Branding band
    box(st, W, 0.3, 0.02, m.charcoal, cx, H - 0.5, D / 2 + 0.07);
    // shuttle table station on -X side (outside)
    box(st, 3.5, 0.08, 2.0, m.darkGrey, -4.9, 0.55, 0);
    for (const x of [-6.5, -3.3]) for (const z of [-0.95, 0.95]) box(st, 0.12, 0.55, 0.12, m.darkGrey, x, 0, z);
    box(st, 0.2, 1.7, 3.2, m.white, cx - W / 2 + 0.02, 0.6, 0); // side wall w/ opening slot
    // control desk + HMI
    cabinet(st, 0.9, 1.0, 0.6, 3.0, 2.2, 0, m.white);
    hmi(st, 3.0, 1.55, 2.25, 0, '#ff7a00', 'laser');
    // fume extractor + chiller
    cabinet(st, 1.2, 1.9, 0.9, 4.4, -0.7, -Math.PI / 2, m.offWhite);
    cabinet(st, 0.9, 1.3, 0.8, 4.4, 0.8, -Math.PI / 2, m.toteBlue);
    cyl(st, 0.16, 1.2, m.galv, 3.6, 2.1, -0.9, 'x', 16);
    // laser source cabinet
    cabinet(st, 0.8, 1.6, 0.8, -1.4, -2.2, 0, m.charcoal);
    this.andon(cx + W / 2 - 0.2, H + 0.05, D / 2 - 0.2);
    // gantry (moves in X), head (moves in Z)
    this.gantry = this.dyn(this.root, 0, 0, 0);
    box(this.gantry, 0.28, 0.35, 2.7, m.charcoal, 0, 1.55, 0);
    box(this.gantry, 0.3, 0.06, 2.72, paint(0xff7a00), 0, 1.9, 0);
    for (const z of [-1.3, 1.3]) box(this.gantry, 0.4, 0.8, 0.14, dark, 0, 0.8, z);
    this.head = this.dyn(this.gantry, 0.2, 0, 0);
    box(this.head, 0.2, 0.45, 0.22, m.white, 0, 1.2, 0);
    cyl(this.head, 0.05, 0.25, m.chrome, 0, 1.08, 0, 'y', 12, 0.025);
    cyl(this.head, 0.025, 0.6, m.copper, 0, 1.75, 0, 'y', 8);
    this.beam = mesh(this.head, G.cyl(0.004, 0.004, 0.12, 6), m.laserRed, 0, 0.9, 0);
    this.beam.castShadow = false;
    this.beam.userData.noMerge = true;
    // pallets
    this.pallets = [0, 1].map((i) => {
      const p = this.dyn(this.root, 0.2, 0, 0);
      box(p, 3.15, 0.06, 1.6, m.darkSteel, 0, 0.0, 0);
      for (let k = -7; k <= 7; k++) box(p, 0.02, 0.12, 1.55, m.steel, k * 0.2, 0.06, 0);
      const sheet = box(p, 3.05, 0.012, 1.52, m.sheet, 0, 0.19, 0);
      sheet.castShadow = false;
      p.userData.sheet = sheet;
      return p;
    });
    this.pallets[0].position.set(0.2, 0.62, 0);
    this.pallets[1].position.set(-4.9, 0.64, 0);
    this.sparks = new Sparks(this.root, 110);
    this.t = 0;
    this.state = 'cut';
    this.cutTime = 14;
    this.active = 0;
  }
  update(dt, t, rawDt) {
    this.sparks.active = false;
    if (dt > 0) {
      this.t += dt;
      if (this.state === 'cut') {
        // Nest of rectangles + circles traced by the head
        const u = this.t / this.cutTime;
        const k = (u * 9) % 1, n = Math.floor(u * 9);
        const cx = -1.1 + (n % 3) * 1.1, cz = -0.45 + Math.floor(n / 3) * 0.45;
        let x, z;
        if (n % 2 === 0) { const a = k * Math.PI * 2; x = cx + Math.cos(a) * 0.35; z = cz + Math.sin(a) * 0.17; }
        else { const e = k * 4; const s = Math.floor(e), f = e - s; const pts = [[-0.4, -0.18], [0.4, -0.18], [0.4, 0.18], [-0.4, 0.18], [-0.4, -0.18]]; x = cx + lerp(pts[s][0], pts[s + 1][0], f); z = cz + lerp(pts[s][1], pts[s + 1][1], f); }
        this.gantry.position.x = x;
        this.head.position.z = z;
        this.head.position.x = 0.2;
        this.sparks.active = true;
        if (this.t > this.cutTime) { this.state = 'exchange'; this.t = 0; }
      } else {
        const k = easeInOut(Math.min(1, this.t / 5));
        const a = this.pallets[this.active], b = this.pallets[1 - this.active];
        a.position.x = lerp(0.2, -4.9, k); a.position.y = 0.62 + Math.sin(k * Math.PI) * 0.12;
        b.position.x = lerp(-4.9, 0.2, k); b.position.y = 0.64 - Math.sin(k * Math.PI) * 0.2;
        this.gantry.position.x = lerp(this.gantry.position.x, 2.6, 0.05);
        if (this.t > 5) {
          a.position.y = 0.64; b.position.y = 0.62;
          this.active = 1 - this.active;
          this.state = 'cut'; this.t = 0;
          this.ctx.get(this.def.params.tower)?.load?.();
        }
      }
    }
    this.beam.visible = this.sparks.active;
    this.head.updateMatrixWorld();
    this.root.worldToLocal(this.head.getWorldPosition(this.sparks.origin)).y = 0.83;
    this.sparks.origin.y = 0.82;
    this.sparks.update(rawDt || 0.016);
  }
}

export class SheetTower extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 5.8;
    for (const [x, z] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) box(st, 0.18, 5.2, 0.18, m.pbBlue, x, 0, z);
    box(st, 3.5, 0.2, 2.4, m.pbBlue, 0, 5.0, 0);
    for (let i = 0; i < 12; i++) {
      const y = 0.25 + i * 0.36;
      box(st, 3.1, 0.05, 2.1, m.darkGrey, 0, y, 0);
      if (i % 3 !== 2) box(st, 3.0, 0.03 + (i % 4) * 0.02, 1.5, m.sheet, 0, y + 0.05, 0);
      box(st, 0.08, 0.06, 2.1, m.rackBeam, 1.5, y, 0);
    }
    box(st, 3.3, 0.06, 0.06, m.safetyYellow, 0, 1.2, 1.2);
    // loader bridge extends toward the laser (+X) at the top
    box(st, 5.6, 0.25, 0.25, m.pbBlue, 3.4, 4.7, -1.15);
    box(st, 5.6, 0.25, 0.25, m.pbBlue, 3.4, 4.7, 1.15);
    for (const z of [-1.15, 1.15]) box(st, 0.2, 4.7, 0.2, m.pbBlue, 6.2, 0, z);
    this.andon(1.7, 5.2, 1.2);
    this.loader = this.dyn(this.root, 0, 0, 0);
    box(this.loader, 0.5, 0.35, 2.5, m.safetyYellow, 0, 4.45, 0);
    this.frame = this.dyn(this.loader, 0, 4.2, 0);
    box(this.frame, 0.08, 1.2, 0.08, m.chrome, 0, -1.2, 0);
    box(this.frame, 2.6, 0.08, 1.3, m.charcoal, 0, -1.28, 0);
    for (let i = 0; i < 12; i++) cyl(this.frame, 0.04, 0.06, m.rubber, -1.1 + (i % 6) * 0.44, -1.33, i < 6 ? -0.5 : 0.5, 'y', 8);
    this.carried = box(this.frame, 2.9, 0.012, 1.45, m.sheet, 0, -1.4, 0);
    this.carried.visible = false;
    this.carried.userData.noMerge = true;
    this.t = 0;
  }
  load() { this.pending = true; }
  update(dt) {
    this.t += dt;
    const tl = timeline([{ d: 2 }, { d: 1.2, n: 'down' }, { d: 1.2, n: 'up' }, { d: 3, n: 'out' }, { d: 1.2, n: 'down2' }, { d: 1.2, n: 'up2' }, { d: 3, n: 'back' }, { d: 4 }], this.t);
    const k = easeInOut(tl.p);
    const f = this.frame, l = this.loader;
    switch (tl.phase.n) {
      case 'down': f.position.y = lerp(4.2, 2.6, k); break;
      case 'up': f.position.y = lerp(2.6, 4.2, k); this.carried.visible = true; break;
      case 'out': l.position.x = lerp(0, 5.1, k); break;
      case 'down2': f.position.y = lerp(4.2, 2.3, k); break;
      case 'up2': f.position.y = lerp(2.3, 4.2, k); this.carried.visible = false; break;
      case 'back': l.position.x = lerp(5.1, 0, k); break;
      default: break;
    }
  }
}

// ---------------------------------------------------------------------------
export class PressBrake extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    const blue = m.pbBlue;
    this.labelHeight = 3.6;
    // side frames (C-shape plates)
    for (const x of [-1.75, 1.75]) {
      const g = group(st, x, 0, 0);
      box(g, 0.14, 3.2, 1.6, blue, 0, 0, -0.35);
      box(g, 0.14, 0.9, 0.5, blue, 0, 0, 0.5);
      cyl(g, 0.16, 0.9, m.chrome, 0, 2.55, 0.1, 'y', 20); // cylinder
    }
    box(st, 3.65, 0.35, 0.5, blue, 0, 2.95, 0.05); // top
    box(st, 3.3, 0.8, 0.35, blue, 0, 0, 0.1); // lower beam
    box(st, 3.2, 0.1, 0.12, m.steel, 0, 0.8, 0.1); // die holder
    box(st, 3.1, 0.1, 0.08, m.chrome, 0, 0.9, 0.1); // die
    // front support arms
    for (const x of [-0.8, 0.8]) box(st, 0.08, 0.05, 0.6, m.alu, x, 0.93, 0.55);
    // back gauge
    box(st, 2.8, 0.08, 0.1, m.darkGrey, 0, 1.0, -0.6);
    // controller pendant
    hmi(st, 1.95, 1.6, 0.9, -0.3, '#234a8c');
    box(st, 0.05, 1.6, 0.05, m.darkGrey, 1.95, 0, 0.9);
    // hydraulics box at the back
    cabinet(st, 1.6, 1.4, 0.6, 0, -1.2, Math.PI, m.offWhite);
    this.andon(1.8, 3.2, -0.2);
    // ram
    this.ram = this.dyn(this.root, 0, 0, 0);
    box(this.ram, 3.35, 0.9, 0.3, blue, 0, 1.75, 0.1);
    box(this.ram, 3.3, 0.08, 0.2, paint(0xf2c318), 0, 2.2, 0.1);
    box(this.ram, 3.1, 0.18, 0.06, m.chrome, 0, 1.54, 0.1);
    this.ramY = 0;
    this.state = 'idle'; this.t = 0;
    this.flap = null;
  }
  bend(flap) { this.state = 'down'; this.t = 0; this.flap = flap; }
  get done() { return this.state === 'idle'; }
  update(dt) {
    if (this.state === 'idle') return;
    this.t += dt;
    if (this.state === 'down') {
      const k = easeInOut(Math.min(1, this.t / 0.9));
      this.ram.position.y = -0.5 * k;
      if (this.t > 0.9) { this.state = 'bend'; this.t = 0; }
    } else if (this.state === 'bend') {
      const k = easeInOut(Math.min(1, this.t / 1.0));
      this.ram.position.y = -0.5 - 0.03 * k;
      if (this.flap) this.flap.rotation.x = -k * Math.PI / 2 * this.flap.userData.dir;
      if (this.t > 1.0) { this.state = 'up'; this.t = 0; }
    } else if (this.state === 'up') {
      const k = easeInOut(Math.min(1, this.t / 0.8));
      this.ram.position.y = -0.53 * (1 - k);
      if (this.t > 0.8) { this.state = 'idle'; }
    }
  }
}

// Bendable sheet: a held plate + a hinged flap
export function makeBendSheet() {
  const m = M();
  const g = new THREE.Group();
  box(g, 0.9, 0.01, 0.45, m.sheet, 0, 0, 0.225);
  const flap = new THREE.Group();
  g.add(flap);
  box(flap, 0.9, 0.01, 0.25, m.sheet, 0, 0, -0.125);
  flap.userData.dir = 1;
  g.userData.flap = flap;
  return g;
}

// ---------------------------------------------------------------------------
export class HydraulicPress extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    const green = m.green;
    this.labelHeight = 6.2;
    box(st, 3.4, 0.9, 2.6, green, 0, 0, 0); // bed
    box(st, 2.2, 0.15, 1.6, m.darkSteel, 0, 0.9, 0); // bolster
    box(st, 1.4, 0.2, 1.0, m.steel, 0, 1.05, 0); // lower die
    for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) cyl(st, 0.13, 4.6, m.chrome, x, 3.2, z, 'y', 20);
    rbox(st, 3.4, 1.2, 2.6, green, 0, 4.9, 0, 0.08); // crown
    cyl(st, 0.45, 0.8, m.darkSteel, 0, 6.3, 0, 'y', 28);
    cyl(st, 0.3, 0.5, green, 0, 6.9, 0, 'y', 24);
    // hydraulic power unit
    const hpu = group(st, 2.6, 0, -0.4);
    box(hpu, 1.2, 1.1, 1.6, green, 0, 0, 0);
    cyl(hpu, 0.22, 0.6, m.darkGrey, 0, 1.4, 0.3, 'x', 20);
    cyl(hpu, 0.05, 4.6, m.darkSteel, -0.3, 3.4, -0.5, 'y', 8);
    // light curtains (front)
    for (const x of [-1.65, 1.65]) {
      box(st, 0.08, 1.9, 0.08, m.safetyYellow, x, 0.2, 1.5);
      const lc = mesh(st, G.box(0.02, 1.6, 0.02), m.laserRed, x + (x < 0 ? 0.05 : -0.05), 1.2, 1.5);
      lc.castShadow = false;
    }
    fence(st, [[-1.8, 1.4], [-1.8, -1.6], [1.9, -1.6]], 2.2);
    cabinet(st, 1.0, 1.9, 0.5, -2.4, 0.6, Math.PI / 2, m.offWhite);
    hmi(st, -1.9, 1.5, 1.6, 0.3, '#2e7d4f');
    this.andon(1.5, 5.5, 1.1);
    this.slide = this.dyn(this.root, 0, 0, 0);
    box(this.slide, 2.5, 0.5, 1.9, green, 0, 3.4, 0);
    box(this.slide, 1.4, 0.25, 1.0, m.steel, 0, 3.15, 0);
    for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) cyl(this.slide, 0.2, 0.55, m.darkSteel, x, 3.65, z, 'y', 16);
    this.state = 'idle'; this.t = 0;
  }
  cycle() { this.state = 'run'; this.t = 0; }
  get done() { return this.state === 'idle'; }
  update(dt) {
    if (this.state !== 'run') return;
    this.t += dt;
    const tl = timeline([{ d: 0.7 }, { d: 0.9 }, { d: 0.3 }, { d: 0.8 }], this.t);
    const y = [(p) => -1.5 * easeInOut(p), (p) => -1.5 - 0.35 * p, () => -1.85, (p) => -1.85 * (1 - easeInOut(p))][tl.i](tl.p);
    this.slide.position.y = y;
    if (this.t >= tl.total) { this.state = 'idle'; this.slide.position.y = 0; }
  }
}

// ---------------------------------------------------------------------------
export class ServoPress extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    const col = paint(0x3a5a78, { rough: 0.4, metal: 0.25 });
    this.labelHeight = 5.6;
    // straight side press
    for (const x of [-1.5, 1.5]) box(st, 0.5, 4.8, 1.8, col, x, 0, 0);
    box(st, 3.5, 1.0, 1.8, col, 0, 0, 0);
    box(st, 2.6, 0.15, 1.2, m.darkSteel, 0, 1.0, 0);
    box(st, 2.3, 0.25, 0.9, m.steel, 0, 1.15, 0);
    rbox(st, 3.6, 1.0, 2.0, col, 0, 4.4, 0, 0.08);
    cyl(st, 0.45, 0.4, m.charcoal, 1.9, 4.9, 0, 'x', 28);
    cyl(st, 0.45, 0.4, m.charcoal, -1.9, 4.9, 0, 'x', 28);
    box(st, 3.4, 0.25, 0.04, paint(0xf2c318), 0, 4.3, 1.02);
    // coil line on -X side
    const dc = group(st, -5.8, 0, 0);
    box(dc, 1.2, 0.6, 1.6, m.darkGrey, 0, 0, 0);
    box(dc, 0.3, 1.5, 0.3, m.darkGrey, 0, 0.6, -0.6);
    this.coil = this.dyn(this.root, -5.8, 1.55, 0);
    mesh(this.coil, new THREE.CylinderGeometry(0.75, 0.75, 0.6, 40, 1, false), m.steel, 0, 0, 0, [Math.PI / 2, 0, 0]);
    mesh(this.coil, new THREE.CylinderGeometry(0.3, 0.3, 0.62, 20), m.darkSteel, 0, 0, 0, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) box(this.coil, 0.08, 1.3, 0.05, m.rackBeam, 0, 0, 0.33, [0, 0, (i * Math.PI) / 4]);
    // straightener / feeder
    const sf = group(st, -3.1, 0, 0);
    box(sf, 1.4, 1.0, 1.2, col, 0, 0, 0);
    box(sf, 1.3, 0.5, 0.9, m.white, 0, 1.0, 0);
    for (let i = 0; i < 5; i++) cyl(sf, 0.06, 0.8, m.chrome, -0.5 + i * 0.25, 1.28 + (i % 2) * 0.12, 0, 'z', 12);
    hmi(sf, 0.8, 1.6, 0.7, 0.4, '#3a5a78');
    // strip: coil → loop → feeder → die
    const strip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.8, 0.82, 0), new THREE.Vector3(-4.9, 0.4, 0), new THREE.Vector3(-4.2, 0.5, 0), new THREE.Vector3(-3.8, 1.3, 0),
    ]), 20, 0.02, 4), m.sheet);
    strip.scale.z = 12;
    st.add(strip);
    box(st, 3.2, 0.01, 0.3, m.sheet, -1.2, 1.3, 0);
    // output chute + bin
    box(st, 0.8, 0.05, 0.6, m.steel, 2.2, 1.0, 0, [0, 0, -0.4]);
    this.bin = group(st, 2.9, 0, 0);
    box(this.bin, 1.0, 0.7, 0.9, m.toteBlue, 0, 0, 0);
    this.fill = box(this.dyn(this.root, 2.9, 0, 0), 0.9, 0.5, 0.8, m.dinRail, 0, 0.25, 0);
    this.fill.userData.noMerge = true;
    fence(st, [[-2.1, 1.6], [-2.1, 1.4], [2.1, 1.4]], 2.0);
    cabinet(st, 2.0, 2.0, 0.6, 0, -1.6, Math.PI, m.offWhite);
    this.andon(1.6, 5.0, 0.9);
    this.slide = this.dyn(this.root, 0, 0, 0);
    box(this.slide, 2.5, 0.8, 1.2, col, 0, 2.6, 0);
    box(this.slide, 2.3, 0.3, 0.9, m.steel, 0, 2.3, 0);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const ph = (this.t * 0.9) % 1;
    this.slide.position.y = -0.7 * Math.pow(Math.sin(ph * Math.PI), 2);
    this.coil.rotation.z -= dt * 0.25;
    this.fill.scale.y = 0.2 + ((this.t / 40) % 1) * 0.8;
  }
}

// ---------------------------------------------------------------------------
export class BridgeCrane extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const p = def.params;
    this.p = p;
    const st = this.static;
    const yl = m.safetyYellow;
    this.labelHeight = p.height + 1.4;
    const len = p.xMax - p.xMin, cx = (p.xMin + p.xMax) / 2;
    for (const z of [p.zMin, p.zMax]) {
      box(st, len, 0.5, 0.35, m.darkGrey, cx, p.height - 0.5, z);
      box(st, len, 0.06, 0.08, m.steel, cx, p.height, z);
    }
    this.bridge = this.dyn(this.root, cx, p.height, 0);
    const span = p.zMax - p.zMin, cz = (p.zMin + p.zMax) / 2;
    for (const dx of [-0.6, 0.6]) {
      box(this.bridge, 0.4, 0.9, span, yl, dx, 0.05, cz);
      box(this.bridge, 0.42, 0.08, span, m.charcoal, dx, 0.93, cz);
    }
    for (const z of [p.zMin, p.zMax]) box(this.bridge, 2.4, 0.5, 0.6, yl, 0, 0.0, z);
    box(this.bridge, 0.7, 0.9, 0.8, m.charcoal, 1.0, -0.8, p.zMin + 1.2); // panel
    this.trolley = this.dyn(this.bridge, 0, 0, cz);
    box(this.trolley, 1.8, 0.7, 1.4, yl, 0, 0.95, 0);
    cyl(this.trolley, 0.3, 1.1, m.darkGrey, 0, 1.2, 0, 'x', 20);
    this.rope = mesh(this.trolley, G.cyl(0.02, 0.02, 1, 6), m.darkSteel, 0, 0, 0);
    this.rope.userData.noMerge = true;
    this.hook = this.dyn(this.trolley, 0, -3, 0);
    box(this.hook, 0.35, 0.4, 0.25, yl, 0, 0, 0);
    mesh(this.hook, G.torus(0.14, 0.035, 16), m.darkSteel, 0, -0.2, 0);
    this.load = this.dyn(this.hook, 0, -0.45, 0);
    mesh(this.load, new THREE.CylinderGeometry(0.6, 0.6, 0.5, 32), m.steel, 0, -0.3, 0, [Math.PI / 2, 0, 0]);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const p = this.p;
    const T = 50;
    const u = (this.t % T) / T;
    const tri = (v) => 1 - Math.abs(2 * v - 1);
    this.bridge.position.x = lerp(p.xMin + 4, p.xMax - 5, easeInOut(tri(u)));
    this.trolley.position.z = lerp(p.zMin + 5, p.zMax - 6, easeInOut(tri((u * 2) % 1)));
    const hy = -3 - 3 * easeInOut(tri((u * 4) % 1));
    this.hook.position.y = hy;
    this.rope.scale.y = -hy + 0.8;
    this.rope.position.y = (hy + 0.8) / 2 + 0.2;
  }
}
