// Utilities & auxiliaries: material dryer, compressors, chiller, transformer, CMM.
import * as THREE from 'three';
import { M, paint } from '../world/materials.js';
import { Equipment, box, rbox, cyl, group, mesh, G, hmi, cabinet, pipe, fence, easeInOut, lerp } from './common.js';

export class Dryer extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 5.2;
    box(st, 6.4, 0.2, 2.4, m.darkGrey, 0, 0, 0);
    // 4 drying hoppers
    for (let i = 0; i < 4; i++) {
      const x = -2.4 + i * 1.6;
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(st, 0.06, 1.2, 0.06, m.darkGrey, x + dx, 0.2, dz);
      mesh(st, G.cyl(0.55, 0.12, 0.6, 24), m.steel, x, 1.7, 0);
      cyl(st, 0.55, 1.8, m.steel, x, 2.9, 0, 'y', 24);
      cyl(st, 0.57, 0.08, m.teal, x, 3.2, 0, 'y', 24);
      cyl(st, 0.3, 0.4, m.white, x, 4.0, 0, 'y', 20);
    }
    cabinet(st, 1.2, 1.9, 0.8, 0, 1.6, Math.PI, m.white, 0.2);
    hmi(st, 1.0, 1.5, 1.15, 0, '#13a8a8');
    // vacuum pump / blower
    rbox(st, 1.0, 1.0, 0.8, m.toteBlue, 2.8, 0.2, -1.6, 0.05);
    // conveying lines to each IMM hopper
    const tg = def.params.targets || [];
    tg.forEach(([x, z, h], i) => {
      const [ox, oz] = def.pos;
      const sx = -2.4 + i * 1.6;
      pipe(st, [[sx, 4.2, 0], [sx, 6.3 + i * 0.25, 0], [x - ox, 6.3 + i * 0.25, 0], [x - ox, 6.3 + i * 0.25, z - oz], [x - ox, h + 0.2, z - oz]], 0.045, m.steel);
    });
    this.andon(3.0, 0.2, 1.1);
  }
}

export class Compressor extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 2.6;
    rbox(st, 2.6, 1.9, 1.4, paint(0x2a4d7a, { rough: 0.45 }), 0, 0, 0, 0.06);
    box(st, 2.62, 0.3, 1.42, m.charcoal, 0, 0, 0);
    for (let i = 0; i < 8; i++) box(st, 0.9, 0.03, 0.01, m.charcoal, 0.7, 0.6 + i * 0.12, 0.705);
    hmi(st, -0.8, 1.35, 0.72, 0, '#2a4d7a');
    // air receiver
    cyl(st, 0.45, 2.4, m.galv, 1.9, 1.3, -0.4, 'y', 24);
    mesh(st, G.sphere(0.45, 20), m.galv, 1.9, 2.5, -0.4);
    pipe(st, [[1.2, 1.6, -0.4], [1.9, 1.6, -0.4]], 0.05, m.toteBlue);
    pipe(st, [[1.9, 2.9, -0.4], [1.9, 4.5, -0.4], [1.9, 4.5, 2.5]], 0.06, m.toteBlue);
    this.fan = this.dyn(this.root, 0, 1.92, 0);
    for (let i = 0; i < 4; i++) box(this.fan, 0.7, 0.01, 0.12, m.darkGrey, 0, 0, 0, [0, (i * Math.PI) / 4, 0]);
    this.andon(-1.1, 1.9, 0.5);
  }
  update(dt) { this.fan.rotation.y += dt * 12; }
}

export class Chiller extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 3.0;
    rbox(st, 5.0, 2.1, 2.0, m.white, 0, 0, 0, 0.05);
    box(st, 5.02, 0.25, 2.02, m.charcoal, 0, 0, 0);
    for (let i = 0; i < 18; i++) box(st, 0.02, 1.2, 0.01, m.lightGrey, -2.2 + i * 0.26, 0.5, 1.005);
    this.fans = [];
    for (const x of [-1.6, 0, 1.6]) {
      cyl(st, 0.62, 0.1, m.darkGrey, x, 2.15, 0, 'y', 28);
      const f = this.dyn(this.root, x, 2.22, 0);
      for (let i = 0; i < 5; i++) box(f, 1.0, 0.01, 0.16, m.charcoal, 0, 0, 0, [0, (i * Math.PI) / 5, 0]);
      cyl(f, 0.1, 0.06, m.charcoal, 0, 0, 0, 'y', 12);
      this.fans.push(f);
    }
    pipe(st, [[-2.4, 0.8, -1.0], [-2.4, 0.8, -1.4], [-2.4, 5.2, -1.4], [-18, 5.2, -1.4]], 0.09, m.toteBlue);
    pipe(st, [[-2.0, 0.6, -1.0], [-2.0, 0.6, -1.7], [-2.0, 5.5, -1.7], [-18, 5.5, -1.7]], 0.09, m.red);
    hmi(st, 2.0, 1.4, 1.1, 0, '#2f8cff');
    this.andon(2.3, 2.1, 0.8);
  }
  update(dt) { this.fans.forEach((f, i) => { f.rotation.y += dt * (9 + i); }); }
}

export class Transformer extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 3.3;
    const col = paint(0x5f6b62, { rough: 0.5, metal: 0.3 });
    box(st, 3.0, 2.4, 2.0, col, 0, 0, 0);
    for (let i = 0; i < 10; i++) box(st, 0.04, 1.8, 0.35, col, -1.35 + i * 0.3, 0.3, 1.15);
    for (let i = 0; i < 3; i++) { cyl(st, 0.1, 0.5, m.plasticDark, -0.8 + i * 0.8, 2.65, 0, 'y', 12); cyl(st, 0.16, 0.05, m.plasticDark, -0.8 + i * 0.8, 2.75, 0, 'y', 12); }
    cabinet(st, 3.0, 2.2, 0.8, 3.4, 0, 0, m.lightGrey);
    cabinet(st, 3.0, 2.2, 0.8, 6.6, 0, 0, m.lightGrey);
    box(st, 9.8, 0.25, 0.5, m.darkGrey, 3.3, 3.4, -0.6);
    fence(st, [[-2.0, 1.6], [-2.0, -1.6], [8.4, -1.6], [8.4, 1.6]], 2.2, { gaps: [] });
    // warning sign
    const s = mesh(st, new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.6 }), -2.02, 1.4, 0, [0, -Math.PI / 2, 0]);
    s.castShadow = false;
    this.andon(1.3, 2.4, 0.9);
  }
}

export class CMM extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    this.labelHeight = 3.1;
    box(st, 2.2, 0.55, 1.4, m.darkGrey, 0, 0, 0);
    box(st, 2.4, 0.3, 1.6, m.granite, 0, 0.55, 0);
    box(st, 0.5, 0.2, 0.4, m.housing, 0.2, 0.85, 0.1);
    box(st, 0.08, 0.1, 1.6, m.alu, -1.05, 0.85, 0); // guideway
    this.bridge = this.dyn(this.root, 0, 0, 0);
    for (const z of [-0.72, 0.72]) box(this.bridge, 0.14, 1.6, 0.14, m.alu, 0, 0.85, z);
    rbox(this.bridge, 0.2, 0.22, 1.6, m.white, 0, 2.45, 0, 0.04);
    this.carriage = this.dyn(this.bridge, 0, 0, 0);
    box(this.carriage, 0.28, 0.35, 0.26, m.white, 0, 2.35, 0);
    this.ram = this.dyn(this.carriage, 0, 0, 0);
    box(this.ram, 0.09, 1.2, 0.09, m.alu, 0, 1.4, 0);
    cyl(this.ram, 0.04, 0.12, m.charcoal, 0, 1.33, 0, 'y', 12);
    cyl(this.ram, 0.004, 0.1, m.steel, 0, 1.24, 0, 'y', 6);
    mesh(this.ram, G.sphere(0.012, 10), m.red, 0, 1.19, 0);
    // PC workstation
    box(st, 1.2, 0.75, 0.6, m.white, 1.9, 0, 0.9);
    hmi(st, 1.9, 1.05, 0.75, Math.PI, '#29b36b', 'cmm');
    this.andon(1.1, 0.85, -0.7);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    this.bridge.position.x = Math.sin(t * 0.5) * 0.35;
    this.carriage.position.z = Math.sin(t * 0.37 + 1) * 0.35;
    this.ram.position.y = -0.08 - Math.max(0, Math.sin(t * 1.3)) * 0.12;
  }
}
