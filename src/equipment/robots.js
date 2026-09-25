// Robot equipment wrappers and machine-tending programs.
import * as THREE from 'three';
import { M } from '../world/materials.js';
import { Equipment, box, group, cabinet, fence, part } from './common.js';
import { RobotArm, ScaraRobot } from './robotArm.js';
import { makeBendSheet } from './sheetMetal.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function makeHousing(mat = M().housing) {
  const g = new THREE.Group();
  part(g, 'housing', [[0.5, 0.012, 0.36, 0, 0, 0], [0.5, 0.16, 0.012, 0, 0, 0.174], [0.5, 0.16, 0.012, 0, 0, -0.174], [0.012, 0.16, 0.36, 0.244, 0, 0], [0.012, 0.16, 0.36, -0.244, 0, 0]], mat);
  g.userData.dynamic = true;
  return g;
}

export class RobotEq extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const p = def.params;
    this.arm = new RobotArm(this.root, { scale: p.scale || 1, color: p.color || 0xf28c28, accent: p.accent, tool: p.tool, pedestal: p.pedestal || 0 });
    this.labelHeight = (p.pedestal || 0) + 2.4 * (p.scale || 1);
    // controller cabinet
    if (!def.parent && p.program !== 'palletize') cabinet(this.static, 0.7, 1.5, 0.5, -1.2 * (p.scale || 1), -0.6, 0, M().charcoal);
    this.andon(0.35 * (p.scale || 1), (p.pedestal || 0) + 0.02, 0.35 * (p.scale || 1), this.static, 0.8);
    this.program = null;
  }
  link() {
    const p = this.def.params;
    const prog = PROGRAMS[p.program];
    if (prog) this.program = prog(this);
  }
  update(dt) {
    if (!dt) return;
    this.arm.update(dt);
    if (!this.arm.busy && this.program) this.program();
  }
}

export class ScaraEq extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    this.arm = new ScaraRobot(this.root, {});
    this.labelHeight = 1.6;
    this.andon(0.14, 0.08, -0.14, this.static, 0.6);
  }
  update(dt) { if (dt) this.arm.update(dt); }
}

// Helper: point in a machine's local frame → world
function wp(eq, x, y, z) { return eq.root.localToWorld(V(x, y, z)); }

export function registerProgram(name, fn) { PROGRAMS[name] = fn; }

const PROGRAMS = {
  bending(robot) {
    const ctx = robot.ctx;
    const pb = ctx.get(robot.def.params.machine);
    if (!pb) return null;
    const arm = robot.arm;
    const m = M();
    const world = ctx.dynamicRoot;
    // blank stack + output pallet in press-brake local frame
    const blankPos = V(-2.3, 0, 2.3), outPos = V(2.3, 0, 2.3);
    const stacks = [blankPos, outPos].map((pos, i) => {
      const g = group(pb.static, pos.x, 0, pos.z);
      box(g, 1.2, 0.12, 1.0, m.wood, 0, 0, 0);
      box(g, 1.0, 0.25, 0.75, i ? m.plasticDark : m.sheet, 0, 0.12, 0);
      return g;
    });
    fence(pb.static, [[-3.2, 0.6], [-3.2, 3.6], [3.2, 3.6], [3.2, 0.6]], 1.8);
    let outCount = 0;
    const outParts = group(null);
    world.add(outParts);
    arm.setHome(wp(pb, 0, 1.6, 2.0));
    const q = new THREE.Quaternion();
    return () => {
      pb.root.getWorldQuaternion(q);
      let sheet;
      arm.moveTo(wp(pb, blankPos.x, 1.2, blankPos.z), 1.1)
        .moveTo(wp(pb, blankPos.x, 0.39, blankPos.z), 0.6)
        .call(() => {
          sheet = makeBendSheet();
          sheet.quaternion.copy(q);
          const tip = arm.tipWorld();
          sheet.position.copy(tip).add(V(0, -0.006, -0.225).applyQuaternion(q));
          world.add(sheet);
          arm.attach(sheet);
        })
        .moveTo(wp(pb, blankPos.x, 1.3, blankPos.z), 0.6)
        .moveTo(wp(pb, 0, 1.15, 1.2), 1.3)
        .moveTo(wp(pb, 0, 1.012, 0.325), 0.7)
        .call(() => pb.bend(sheet.userData.flap))
        .until(() => pb.done)
        .moveTo(wp(pb, 0, 1.2, 1.3), 0.8)
        .moveTo(wp(pb, outPos.x, 1.4, outPos.z), 1.2)
        .moveTo(wp(pb, outPos.x, 0.42 + (outCount % 8) * 0.03, outPos.z), 0.6)
        .call(() => {
          const s = arm.release(outParts);
          outCount++;
          if (outCount % 8 === 0) outParts.clear();
          else if (s) s.userData.keep = true;
        })
        .moveTo(wp(pb, outPos.x, 1.3, outPos.z), 0.5);
    };
  },

  press(robot) {
    const ctx = robot.ctx;
    const pr = ctx.get(robot.def.params.machine);
    const conv = ctx.get('CNV-M01');
    if (!pr) return null;
    const arm = robot.arm;
    const m = M();
    const world = ctx.dynamicRoot;
    // input pallet with bent housings (world coords)
    const inP = V(-31.4, 0, 16.4);
    const g = group(robot.static, 0, 0, 0);
    g.position.copy(robot.root.worldToLocal(inP.clone()));
    box(g, 1.2, 0.12, 1.0, m.wood, 0, 0, 0);
    for (let i = 0; i < 4; i++) { const h = makeHousing(); h.position.set(0, 0.14 + i * 0.17, 0); g.add(h); }
    const convStart = V(-26.6, 0.78, 16.8);
    arm.setHome(wp(pr, 0, 2.0, 2.2));
    return () => {
      let part;
      arm.moveTo(V(inP.x, 1.4, inP.z), 1.0)
        .moveTo(V(inP.x, 0.68, inP.z), 0.6)
        .call(() => {
          part = makeHousing();
          part.position.copy(arm.tipWorld()).add(V(0, -0.012, 0));
          world.add(part);
          arm.attach(part);
        })
        .moveTo(V(inP.x, 1.6, inP.z), 0.6)
        .moveTo(wp(pr, 0, 1.9, 1.7), 1.0)
        .moveTo(wp(pr, 0, 1.265, 0), 0.8)
        .call(() => arm.release(world))
        .moveTo(wp(pr, 0, 1.9, 1.9), 0.7)
        .call(() => pr.cycle())
        .until(() => pr.done)
        .moveTo(wp(pr, 0, 1.265, 0), 0.8)
        .call(() => arm.attach(part))
        .moveTo(wp(pr, 0, 1.9, 1.8), 0.8)
        .moveTo(V(convStart.x, 1.5, convStart.z), 1.0)
        .until(() => !conv || conv.canAdd())
        .moveTo(V(convStart.x, 0.97, convStart.z), 0.5)
        .call(() => {
          const pp = arm.release(world);
          if (conv && pp) conv.addItem(pp); else pp?.parent?.remove(pp);
        })
        .moveTo(V(convStart.x, 1.5, convStart.z), 0.5);
    };
  },
};
