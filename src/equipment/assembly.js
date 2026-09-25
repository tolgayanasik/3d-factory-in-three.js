// Automated assembly line: twin-belt pallet transfer loop with RFID carriers,
// seven stations (robots, SCARA, screwdriving portal, vision tunnel, cobot),
// cartoning, palletizing robot and turntable stretch wrapper.
import * as THREE from 'three';
import { M, paint } from '../world/materials.js';
import { Equipment, box, rbox, cyl, group, mesh, G, hmi, cabinet, easeInOut, lerp, clamp, pallet, fence, part, mergeStatic } from './common.js';
import { buildConveyorPath, pointOnSegs } from './conveyor.js';
import { makeHousing, registerProgram } from './robots.js';
import { makeCover } from './imm.js';
import { LOOP } from '../../shared/catalog.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BELT_H = 0.9;
const CARRIER_TOP = BELT_H + 0.06;

export function makeCarton() {
  const g = new THREE.Group();
  box(g, 0.55, 0.35, 0.45, M().cardboard, 0, 0, 0);
  g.userData.dynamic = true;
  return g;
}

function makeProduct() {
  const m = M();
  const g = new THREE.Group();
  const housing = makeHousing();
  housing.scale.setScalar(0.9);
  g.add(housing);
  const din = group(g);
  din.userData.dynamic = true;
  part(din, 'din', [[0.4, 0.02, 0.05, 0, 0.012, 0]], m.dinRail);
  part(din, 'terminals', Array.from({ length: 8 }, (_, i) => [0.035, 0.08, 0.07, -0.14 + i * 0.04, 0.03, 0]), m.terminal);
  const cover = makeCover(1.3, m.cover);
  cover.position.y = 0.145;
  g.add(cover);
  const screws = group(g);
  screws.userData.dynamic = true;
  part(screws, 'screws', [[-0.19, -0.13], [0.19, -0.13], [-0.19, 0.13], [0.19, 0.13]].map(([x, z]) => [0.024, 0.012, 0.024, x, 0.211, z]), m.chrome);
  const ok = mesh(g, G.box(0.03, 0.012, 0.03), M().ledWhite, 0.14, 0.215, 0.1);
  const lbl = mesh(g, G.box(0.14, 0.004, 0.08), m.white, -0.08, 0.216, 0.06);
  ok.userData.noMerge = true; lbl.userData.noMerge = true;
  g.userData.dynamic = true;
  g.userData.parts = { housing, din, cover, screws, ok, lbl };
  return g;
}
function setStage(prod, stage, nok = false) {
  const p = prod.userData.parts;
  prod.visible = stage > 0;
  p.din.visible = stage >= 2 && stage < 3;
  p.cover.visible = stage >= 3;
  p.screws.visible = stage >= 4;
  p.ok.visible = stage >= 5;
  p.ok.material = nok ? M().laserRed : M().ledCyan;
  p.lbl.visible = stage >= 6;
}

// ---------------------------------------------------------------------------
export class AssemblyLoop extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const { xMin, xMax, zFwd, zRet } = LOOP;
    this.pts = [[xMin, zFwd], [xMax, zFwd], [xMax, zRet], [xMin, zRet], [xMin, zFwd]];
    this.path = buildConveyorPath(this, this.static, this.pts, { width: 0.62, height: BELT_H, kind: 'belt' });
    this.L = this.path.length;
    this.labelHeight = 2.2;
    // carriers
    this.carriers = [];
    this.cg = this.dyn(this.root);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const g = group(this.cg);
      g.userData.dynamic = true;
      box(g, 0.62, 0.05, 0.5, m.alu, 0, 0, 0);
      for (const [x, z] of [[-0.26, -0.2], [0.26, 0.2]]) cyl(g, 0.012, 0.05, m.steel, x, 0.07, z, 'y', 8);
      box(g, 0.06, 0.03, 0.04, m.charcoal, 0.28, 0.0, 0.2);
      const prod = makeProduct();
      prod.position.y = 0.055;
      g.add(prod);
      const c = { g, prod, s: (this.L * 0.45) + i * 1.05, stage: 0, nok: false, id: i + 1 };
      setStage(prod, 0);
      this.carriers.push(c);
    }
    this.speedMs = 0.55;
    this.stations = [];
  }
  place() { this.root.position.set(0, 0, 0); }
  stopS(x) { return x - LOOP.xMin; }
  update(dt) {
    this.path.beltMat.map.offset.y -= (this.speedMs * dt) / 0.6;
    const L = this.L;
    const sorted = [...this.carriers].sort((a, b) => a.s - b.s);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const next = sorted[(i + 1) % sorted.length];
      let gap = next.s - c.s;
      if (gap <= 0) gap += L;
      let adv = this.speedMs * dt;
      adv = Math.min(adv, Math.max(0, gap - 0.8));
      // station stops
      const sc = c.s % L;
      for (const st of this.stations) {
        const stop = this.stopS(st.x);
        if (sc <= stop + 1e-4 && sc + adv >= stop - 1e-4 && st.wants(c)) {
          adv = Math.max(0, stop - sc);
          if (adv < 1e-3) st.arrive(c);
        }
      }
      c.s = (c.s + adv) % L;
    }
    for (const c of this.carriers) {
      const { p, dir } = pointOnSegs(this.path.segs, c.s);
      c.g.position.set(p.x, BELT_H + 0.005, p.z);
      c.g.rotation.y = Math.atan2(-dir.z, dir.x);
      if (dir.x < -0.5) c.g.rotation.y = 0; // keep product orientation on return lane
    }
  }
}

// ---------------------------------------------------------------------------
export class Station extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const p = def.params;
    this.kind = p.kind;
    this.x = def.pos[0];
    this.labelHeight = 2.9;
    const st = this.static;
    // cell frame (local coords centred on the stop point)
    const W = 4.2, z0 = -4.9, z1 = 1.4, H = 2.3;
    const prof = m.alu;
    for (const x of [-W / 2, W / 2]) for (const z of [z0, z1]) box(st, 0.06, H, 0.06, prof, x, 0, z);
    for (const z of [z0, z1]) box(st, W, 0.06, 0.06, prof, 0, H, z);
    for (const x of [-W / 2, W / 2]) box(st, 0.06, 0.06, z1 - z0, prof, x, H, (z0 + z1) / 2);
    for (const x of [-W / 2, W / 2]) box(st, 0.06, 0.06, z1 - z0, prof, x, 0.3, (z0 + z1) / 2);
    const pc = (w, h, x, y, z, ry = 0) => { const pm = mesh(st, G.box(w, h, 0.01), m.polycarb, x, y, z, [0, ry, 0]); pm.castShadow = false; };
    pc(W - 0.1, H - 0.4, 0, 0.35 + (H - 0.4) / 2, z0);
    pc(W - 0.1, H - 1.35, 0, 1.3 + (H - 1.35) / 2, z1);
    box(st, W, 0.9, 0.04, m.lightGrey, 0, 0.3, z1);
    for (const x of [-W / 2, W / 2]) pc(z1 - z0 - 1.6, H - 1.3, x, 1.3 + (H - 1.3) / 2, z0 + (z1 - z0 - 1.6) / 2 + 0.05, Math.PI / 2);
    box(st, W - 0.1, 0.03, z1 - z0 - 0.1, m.polycarb, 0, H + 0.01, (z0 + z1) / 2).castShadow = false;
    box(st, W, 0.12, 0.04, paint(0x8a5cf0), 0, H - 0.12, z1 + 0.01);
    hmi(st, 1.2, 1.4, z1 + 0.15, 0, '#8a5cf0');
    cabinet(st, 1.0, 1.6, 0.5, -1.3, z0 + 0.4, 0, m.offWhite);
    this.andon(W / 2 - 0.1, H + 0.05, z1 - 0.1);
    this.busy = null;
    this.t = 0;
    this.phase = 0;
    this.build?.();
    const builders = { load: this.buildLoad, scara: this.buildScara, cover: this.buildCover, screw: this.buildScrew, vision: this.buildVision, label: this.buildLabel, unload: this.buildUnload };
    builders[this.kind]?.call(this, m);
    this.stage = p.index + 1; // carrier stage this station produces
    this.nokCount = 0;
  }
  link() {
    this.loop = this.ctx.get('CNV-L01');
    this.loop.stations.push(this);
    this.robot = this.def.params.robot ? this.ctx.get(this.def.params.robot) : null;
    this.world = this.ctx.dynamicRoot;
    if (this.robot?.arm?.setHome) this.robot.arm.setHome(this.wp(0, 1.6, -0.9));
    this.linkKind?.();
  }
  wp(x, y, z) { return this.root.localToWorld(V(x, y, z)); }
  wants(c) { return c.stage === this.stage - 1 && !(this.busy && this.busy !== c); }
  arrive(c) {
    if (this.busy === c) return;
    if (!this.running) return;
    this.busy = c; this.t = 0; this.phase = 0; this.started = false;
  }
  finish(c) {
    c.stage = this.stage % 7;
    if (this.kind === 'unload') c.stage = 0;
    setStage(c.prod, c.stage, c.nok);
    this.busy = null;
    // count good/scrap for the MES simulation
    this.ctx.events?.emit('cycle', { id: this.id, nok: c.nok && this.kind === 'vision' });
  }
  update(dt) {
    if (!dt) return;
    this.t += dt;
    this.tickKind?.(dt);
    if (!this.busy) return;
    const fn = { load: this.doLoad, scara: this.doScara, cover: this.doCover, screw: this.doScrew, vision: this.doVision, label: this.doLabel, unload: this.doUnload }[this.kind];
    fn?.call(this, this.busy, dt);
  }

  // -------------------------------------------------------------- S1 load
  buildLoad(m) {
    this.buffer = group(this.static, -1.6, 0, -3.6);
    box(this.buffer, 0.9, 0.7, 0.7, m.grey, 0, 0, 0);
    for (let i = 0; i < 3; i++) { const h = makeHousing(); h.position.set(0, 0.72 + i * 0.17, 0); this.buffer.add(h); }
  }
  linkKind() { if (this.kind === 'load') this.infeed = this.ctx.get('CNV-L03'); }
  doLoad(c) {
    const arm = this.robot?.arm;
    if (!arm || this.started) { if (this.started && !arm.busy) this.finish(c); return; }
    const tote = this.infeed?.atEnd();
    let src;
    if (tote) src = tote.obj.getWorldPosition(V(0, 0, 0)).add(V(0, 0.08, 0));
    else if (this.t > 10) src = this.buffer.getWorldPosition(V(0, 0, 0)).add(V(0, 1.24, 0));
    else return; // starved – waiting for kit tote
    this.started = true;
    let part;
    arm.moveTo(src.clone().add(V(0, 0.5, 0)), 0.8).moveTo(src, 0.45)
      .call(() => {
        part = makeHousing(); part.scale.setScalar(0.9);
        part.position.copy(arm.tipWorld()).add(V(0, -0.012, 0));
        this.world.add(part); arm.attach(part);
        if (tote) { tote.obj.userData.picks = (tote.obj.userData.picks || 0) + 1; if (tote.obj.userData.picks >= 3) { const t = this.infeed.take(); t?.parent?.remove(t); } }
      })
      .moveTo(src.clone().add(V(0, 0.5, 0)), 0.45)
      .moveTo(this.wp(0, CARRIER_TOP + 0.5, 0), 0.9)
      .moveTo(this.wp(0, CARRIER_TOP + 0.07, 0), 0.45)
      .call(() => { const p = arm.release(null); p?.parent?.remove(p); c.stage = 1; setStage(c.prod, 1); })
      .moveTo(this.wp(0, CARRIER_TOP + 0.6, 0), 0.4)
      .home(0.7);
  }
  // -------------------------------------------------------------- S2 SCARA
  buildScara(m) {
    this.feeder = group(this.static, 0.55, 0, -1.25);
    box(this.feeder, 0.5, 0.95, 0.4, m.grey, 0, 0, 0);
    box(this.feeder, 0.45, 0.04, 0.35, m.dinRail, 0, 0.95, 0);
    for (let i = 0; i < 6; i++) box(this.feeder, 0.05, 0.08, 0.3, m.terminal, -0.15 + i * 0.06, 0.99, 0);
    box(this.static, 1.2, 0.8, 0.12, m.darkGrey, -0.3, 0, -0.82);
  }
  doScara(c, dt) {
    const arm = this.robot?.arm;
    if (!arm) { if (this.t > 4) this.finish(c); return; }
    if (!this.started) {
      this.started = true;
      const f = this.feeder.getWorldPosition(V(0, 0, 0));
      for (let i = 0; i < 3; i++) {
        arm.moveTo(f.clone().add(V(-0.1 + i * 0.1, 1.05, 0)), 0.45).wait(0.15)
          .moveTo(this.wp(-0.12 + i * 0.12, CARRIER_TOP + 0.1, 0), 0.5).wait(0.2);
      }
      arm.call(() => { c.stage = 2; setStage(c.prod, 2); }).moveTo(this.wp(0.3, 1.2, -0.5), 0.5);
    } else if (!arm.busy) this.finish(c);
  }
  // -------------------------------------------------------------- S3 cover
  buildCover(m) {
    this.rack = group(this.static, 1.35, 0, -1.35);
    box(this.rack, 0.6, 0.85, 0.5, m.grey, 0, 0, 0);
    for (let i = 0; i < 4; i++) { const cv = makeCover(1.3); cv.position.set(0, 0.86 + i * 0.07, 0); this.rack.add(cv); }
  }
  doCover(c) {
    const arm = this.robot?.arm;
    if (!arm) { if (this.t > 4) this.finish(c); return; }
    if (this.started) { if (!arm.busy) this.finish(c); return; }
    this.started = true;
    const src = this.rack.getWorldPosition(V(0, 0, 0)).add(V(0, 0.86 + 3 * 0.07 + 0.09, 0));
    let cv;
    arm.moveTo(src.clone().add(V(0, 0.4, 0)), 0.7).moveTo(src, 0.4)
      .call(() => { cv = makeCover(1.3); cv.position.copy(arm.tipWorld()).add(V(0, -0.09, 0)); this.world.add(cv); arm.attach(cv); })
      .moveTo(src.clone().add(V(0, 0.45, 0)), 0.4)
      .moveTo(this.wp(0, CARRIER_TOP + 0.6, 0), 0.8)
      .moveTo(this.wp(0, CARRIER_TOP + 0.29, 0), 0.5)
      .call(() => { const p = arm.release(null); p?.parent?.remove(p); c.stage = 3; setStage(c.prod, 3); })
      .wait(0.3).moveTo(this.wp(0, CARRIER_TOP + 0.7, 0), 0.4).home(0.6);
  }
  // -------------------------------------------------------------- S4 screw
  buildScrew(m) {
    for (const x of [-0.9, 0.9]) for (const z of [-0.6, 0.6]) box(this.static, 0.08, 2.05, 0.08, m.alu, x, 0, z);
    for (const z of [-0.6, 0.6]) box(this.static, 1.9, 0.12, 0.1, m.alu, 0, 1.95, z);
    this.gx = this.dyn(this.root, 0, 1.95, 0);
    box(this.gx, 0.16, 0.14, 1.3, m.darkGrey, 0, 0, 0);
    this.gz = this.dyn(this.gx, 0, 0, 0);
    box(this.gz, 0.2, 0.25, 0.2, m.white, 0, -0.1, 0);
    this.spindle = this.dyn(this.gz, 0, -0.3, 0);
    cyl(this.spindle, 0.04, 0.5, m.charcoal, 0, -0.1, 0, 'y', 12);
    cyl(this.spindle, 0.008, 0.2, m.chrome, 0, -0.45, 0, 'y', 8);
    box(this.static, 0.4, 0.5, 0.3, m.grey, 1.4, 0, -1.2); // screw presenter
    cyl(this.static, 0.012, 1.5, m.toteBlue, 1.4, 1.2, -0.6, 'x', 6);
  }
  doScrew(c) {
    const pts = [[-0.17, -0.12], [0.17, -0.12], [0.17, 0.12], [-0.17, 0.12]];
    const T = 1.2;
    const i = Math.floor(this.t / T), k = (this.t % T) / T;
    if (i >= 4) { this.gx.position.x = lerp(this.gx.position.x, 0, 0.1); this.spindle.position.y = -0.3; if (this.t > 4 * T + 0.5) { c.stage = 4; this.finish(c); } return; }
    if (i === 2 && !c.screwed) { c.screwed = true; }
    const [x, z] = pts[i];
    this.gx.position.x = lerp(this.gx.position.x, x, 0.25);
    this.gz.position.z = lerp(this.gz.position.z, z, 0.25);
    this.spindle.position.y = -0.3 - 0.35 * Math.sin(clamp((k - 0.2) / 0.7, 0, 1) * Math.PI);
    this.spindle.rotation.y += 0.8;
    if (i === 3 && k > 0.8) setStage(c.prod, 4);
  }
  // -------------------------------------------------------------- S5 vision
  buildVision(m) {
    const hood = group(this.static);
    box(hood, 1.7, 0.05, 1.0, m.charcoal, 0, 2.0, 0);
    for (const x of [-0.85, 0.85]) box(hood, 0.05, 1.1, 1.0, m.charcoal, x, 0.95, 0);
    box(hood, 1.7, 1.1, 0.04, m.charcoal, 0, 0.95, -0.5);
    this.lightMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdff4ff, emissiveIntensity: 0.3 });
    const ring = mesh(this.static, new THREE.TorusGeometry(0.28, 0.035, 8, 32), this.lightMat, 0, 1.75, 0, [Math.PI / 2, 0, 0]);
    ring.userData.noMerge = true;
    for (const [x, z, ry] of [[0, 0, 0], [-0.6, 0.35, 0.6], [0.6, 0.35, -0.6]]) {
      const cam = group(this.static, x, 1.85, z);
      box(cam, 0.1, 0.1, 0.16, m.white, 0, 0, 0);
      cyl(cam, 0.035, 0.08, m.black, 0, -0.08, 0, 'y', 12);
    }
    this.cam3d = this.dyn(this.root, 0, 1.5, 0);
    box(this.cam3d, 0.3, 0.08, 0.12, m.toteBlue, 0, 0, 0);
    const screen = hmi(this.static, -1.3, 1.5, 1.55, 0.3, '#29b36b', 'vision');
    this.reject = group(this.static, 1.3, 0, -1.4);
    box(this.reject, 0.6, 0.6, 0.5, m.red, 0, 0, 0);
  }
  doVision(c) {
    this.lightMat.emissiveIntensity = Math.sin(this.t * 30) > 0.3 ? 5 : 0.5;
    this.cam3d.position.z = Math.sin(this.t * 2.5) * 0.3;
    if (this.t > 2.4) {
      this.lightMat.emissiveIntensity = 0.3;
      const q = this.ctx.mesQuality?.(this.id) ?? 99;
      c.nok = Math.random() * 100 > q;
      this.finish(c);
    }
  }
  // -------------------------------------------------------------- S6 cobot label
  buildLabel(m) {
    this.disp = group(this.static, -1.0, 0, -0.6);
    box(this.disp, 0.35, 1.0, 0.3, m.white, 0, 0, 0);
    cyl(this.disp, 0.12, 0.06, m.white, 0, 1.12, 0, 'z', 20);
    this.laserHead = group(this.static, 0.9, 0, -0.1);
    box(this.laserHead, 0.08, 1.6, 0.08, m.alu, 0, 0, -0.5);
    box(this.laserHead, 0.2, 0.2, 0.55, m.charcoal, 0, 1.5, -0.25);
    this.beam = mesh(this.static, G.cyl(0.003, 0.003, 0.5, 6), m.laserRed, 0.9, 1.2, 0.02);
    this.beam.userData.noMerge = true;
    this.beam.visible = false;
  }
  doLabel(c) {
    const arm = this.robot?.arm;
    this.beam.visible = this.t < 1.2 && Math.sin(this.t * 40) > 0;
    if (!arm) { if (this.t > 4) this.finish(c); return; }
    if (this.started) { if (!arm.busy) this.finish(c); return; }
    this.started = true;
    const d = this.disp.getWorldPosition(V(0, 0, 0)).add(V(0, 1.2, 0));
    arm.moveTo(d.clone().add(V(0, 0.2, 0)), 0.7).moveTo(d, 0.4).wait(0.3)
      .moveTo(this.wp(-0.08, CARRIER_TOP + 0.5, 0.06), 0.8)
      .moveTo(this.wp(-0.08, CARRIER_TOP + 0.24, 0.06), 0.5)
      .call(() => setStage(c.prod, 6)).wait(0.2)
      .moveTo(this.wp(-0.08, CARRIER_TOP + 0.6, 0.06), 0.4).home(0.6);
  }
  // -------------------------------------------------------------- S7 unload
  buildUnload(m) {
    this.rejectBin = group(this.static, 1.4, 0, -1.2);
    box(this.rejectBin, 0.6, 0.6, 0.5, m.red, 0, 0, 0);
    box(this.static, 1.0, 0.7, 0.6, m.grey, -1.3, 0, -3.0); // carton erector
  }
  doUnload(c) {
    const arm = this.robot?.arm;
    const conv = this.ctx.get('CNV-L02');
    if (!arm) { if (this.t > 4) this.finish(c); return; }
    if (this.started) { if (!arm.busy) this.finish(c); return; }
    if (conv && !conv.canAdd()) return;
    this.started = true;
    let prod;
    const nok = c.nok;
    const dest = nok ? this.rejectBin.getWorldPosition(V(0, 0, 0)).add(V(0, 0.9, 0)) : V(50.5, 0.8 + 0.4, -25.7);
    arm.moveTo(this.wp(0, CARRIER_TOP + 0.6, 0), 0.6).moveTo(this.wp(0, CARRIER_TOP + 0.3, 0), 0.4)
      .call(() => {
        prod = makeProduct(); setStage(prod, 6, nok);
        prod.position.copy(arm.tipWorld()).add(V(0, -0.24, 0));
        this.world.add(prod); arm.attach(prod);
        setStage(c.prod, 0);
      })
      .moveTo(this.wp(0, CARRIER_TOP + 0.8, 0), 0.4)
      .moveTo(dest.clone().add(V(0, 0.45, 0)), 1.0)
      .moveTo(dest, 0.4)
      .call(() => {
        const p = arm.release(null); p?.parent?.remove(p);
        if (!nok && conv) { const carton = makeCarton(); this.world.add(carton); conv.addItem(carton, 0); }
      })
      .moveTo(dest.clone().add(V(0, 0.5, 0)), 0.4).home(0.8);
  }
}

// ---------------------------------------------------------------------------
export class Wrapper extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 3.4;
    cyl(st, 1.0, 0.12, m.darkGrey, 0, 0.06, 0, 'y', 40);
    this.table = this.dyn(this.root, 0, 0.12, 0);
    cyl(this.table, 0.85, 0.06, m.steel, 0, 0.03, 0, 'y', 40);
    box(this.table, 1.4, 0.04, 0.1, m.darkGrey, 0, 0.06, 0);
    box(st, 0.3, 3.0, 0.3, m.white, 1.35, 0, 0);
    box(st, 0.34, 0.2, 0.34, paint(0x2e7d4f), 1.35, 3.0, 0);
    cabinet(st, 0.7, 1.5, 0.45, 1.35, 0.8, Math.PI / 2, m.white);
    this.carriage = this.dyn(this.root, 1.15, 0.4, 0);
    box(this.carriage, 0.25, 0.55, 0.35, paint(0x2e7d4f), 0, 0, 0);
    cyl(this.carriage, 0.06, 0.5, m.film, -0.18, 0.28, 0, 'y', 12);
    this.andon(1.35, 3.2, 0.2);
    fence(st, [[2.0, -2.0], [2.0, 1.6], [0.8, 1.6]], 2.0);
    this.state = 'loading';
    this.t = 0;
    this.newPallet();
  }
  newPallet() {
    this.pallet = new THREE.Group();
    this.pallet.userData.dynamic = true;
    pallet(this.pallet, 0, 0, 0);
    this.table.add(this.pallet);
    this.pallet.position.y = 0.06;
    this.cartons = 0;
    this.film = mesh(this.pallet, new THREE.CylinderGeometry(0.82, 0.82, 1, 8, 1, true), M().film, 0, 0.14, 0, [0, Math.PI / 8, 0]);
    this.film.scale.set(0.95, 0.001, 0.8);
    this.film.castShadow = false;
    this.film.visible = false;
    this.film.userData.noMerge = true;
  }
  slotWorld(i) {
    const l = Math.floor(i / 4), k = i % 4;
    const x = (k % 2 ? 0.29 : -0.29), z = (k < 2 ? -0.24 : 0.24);
    this.table.updateMatrixWorld();
    return this.pallet.localToWorld(V(x, 0.14 + l * 0.35, z));
  }
  addCarton(obj) {
    this.pallet.attach(obj);
    this.cartons++;
    if (this.cartons >= 12) { this.state = 'wrapping'; this.t = 0; }
  }
  get accepting() { return this.state === 'loading' && this.cartons < 12; }
  get palletReady() { return this.state === 'ready'; }
  takePallet() {
    if (this.state !== 'ready') return null;
    const p = this.pallet;
    this.table.remove(p);
    this.state = 'empty'; this.t = 0;
    this.ctx.events?.emit('cycle', { id: this.id });
    return p;
  }
  update(dt) {
    this.t += dt;
    if (this.state === 'wrapping') {
      const k = clamp(this.t / 9, 0, 1);
      this.table.rotation.y += dt * 2.2;
      const h = 0.25 + 1.0 * Math.sin(k * Math.PI);
      this.carriage.position.y = h;
      this.film.visible = true;
      this.film.scale.y = Math.max(this.film.scale.y, Math.min(1.12, h + 0.3));
      this.film.position.y = 0.14 + this.film.scale.y / 2;
      if (k >= 1) { this.state = 'ready'; this.table.rotation.y = 0; }
    } else if (this.state === 'empty' && this.t > 3) {
      this.newPallet(); this.state = 'loading';
    }
  }
}

// Palletizer program (runs on PAL-01 robot)
registerProgram('palletize', (robot) => {
  const arm = robot.arm;
  const conv = robot.ctx.get('CNV-L02');
  const wr = robot.ctx.get('SWR-01');
  const world = robot.ctx.dynamicRoot;
  arm.setHome(V(57.8, 2.4, -8.6));
  return () => {
    const it = conv?.atEnd();
    if (!it || !wr?.accepting) return;
    const src = it.obj.getWorldPosition(V(0, 0, 0)).add(V(0, 0.36, 0));
    const slot = wr.cartons;
    let carton;
    arm.moveTo(src.clone().add(V(0, 0.6, 0)), 0.9).moveTo(src, 0.5)
      .grip(false, 0.3)
      .call(() => { carton = conv.take(); if (carton) { carton.rotation.y = 0; arm.attach(carton); } })
      .moveTo(src.clone().add(V(0, 1.0, 0)), 0.6)
      .call(() => {})
      .moveTo(() => wr.slotWorld(slot).add(V(0, 0.36 + 0.7, 0)), 1.2)
      .moveTo(() => wr.slotWorld(slot).add(V(0, 0.36, 0)), 0.6)
      .grip(true, 0.3)
      .call(() => { const c = arm.release(null); if (c) { wr.addCarton(c); } })
      .moveTo(() => wr.slotWorld(slot).add(V(0, 1.2, 0)), 0.5)
      .home(0.8);
  };
});
