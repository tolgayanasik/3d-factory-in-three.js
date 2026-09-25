// Factory building: floor with painted markings, walls (auto cut-away),
// columns, roof trusses, high-bay lighting, rooms, signage and exterior.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, paint, emissive } from './materials.js';
import * as T from './textures.js';
import { box, cyl, group, mesh, G, mergeStatic, cabinet, pipe } from '../equipment/common.js';
import { PLANT, ZONES, AISLE, ASRS, LOOP } from '../../shared/catalog.js';

const B = PLANT.building;
const W = B.maxX - B.minX, D = B.maxZ - B.minZ, H = B.height;
export const COLUMN_X = [-48, -32, -16, 0, 16, 32, 48];
export const COLUMN_Z = [-1.2, 8.8];

function floorMarkings() {
  const PX = 32;
  const c = document.createElement('canvas');
  c.width = 4096; c.height = 2560;
  const g = c.getContext('2d');
  const X = (x) => (x - B.minX) * PX, Zc = (z) => (z - B.minZ) * PX;
  const rect = (x0, z0, x1, z1) => [X(x0), Zc(z0), X(x1) - X(x0), Zc(z1) - Zc(z0)];
  g.clearRect(0, 0, c.width, c.height);
  // zone tints
  const tint = { 'Injection Moulding Hall': 'rgba(27,166,166,0.08)', 'Sheet Metal Shop': 'rgba(224,137,43,0.07)', 'Central AS/RS': 'rgba(58,120,214,0.08)', 'Assembly Hall': 'rgba(138,92,240,0.07)', 'Quality Lab': 'rgba(41,179,107,0.12)', 'Control Room': 'rgba(41,179,107,0.12)', Shipping: 'rgba(123,135,148,0.10)', Utilities: 'rgba(214,69,69,0.08)' };
  for (const z of ZONES) {
    if (!tint[z.key]) continue;
    g.fillStyle = tint[z.key];
    g.fillRect(...rect(...z.rect));
    g.strokeStyle = 'rgba(245,197,24,0.85)';
    g.lineWidth = 4;
    g.strokeRect(...rect(...z.rect));
  }
  // aisles
  const aisle = (x0, z0, x1, z1) => {
    g.fillStyle = 'rgba(70,74,80,0.25)';
    g.fillRect(...rect(x0, z0, x1, z1));
    g.strokeStyle = '#f2c318';
    g.lineWidth = 5;
    g.strokeRect(...rect(x0, z0, x1, z1));
  };
  aisle(B.minX + 1, AISLE.mainZ - 3, B.maxX - 1, AISLE.mainZ + 3);
  aisle(AISLE.westX - 2.5, B.minZ + 1, AISLE.westX + 2.5, AISLE.mainZ - 3);
  aisle(AISLE.westX - 2.5, AISLE.mainZ + 3, AISLE.westX + 2.5, B.maxZ - 1);
  aisle(AISLE.eastX - 2.5, B.minZ + 1, AISLE.eastX + 2.5, AISLE.mainZ - 3);
  aisle(AISLE.eastX - 2.5, AISLE.mainZ + 3, AISLE.eastX + 2.5, B.maxZ - 1);
  aisle(AISLE.shipX - 2.5, AISLE.mainZ + 3, AISLE.shipX + 2.5, 36);
  // AGV lanes (blue dotted) + direction arrows
  g.setLineDash([22, 18]);
  g.strokeStyle = 'rgba(47,125,255,0.75)';
  g.lineWidth = 4;
  for (const off of [-AISLE.laneOffset, AISLE.laneOffset]) {
    g.beginPath(); g.moveTo(X(B.minX + 3), Zc(AISLE.mainZ + off)); g.lineTo(X(B.maxX - 3), Zc(AISLE.mainZ + off)); g.stroke();
  }
  g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let x = B.minX + 8; x < B.maxX - 6; x += 12) {
    for (const [off, dir] of [[-AISLE.laneOffset, -1], [AISLE.laneOffset, 1]]) {
      const cx = X(x), cz = Zc(AISLE.mainZ + off);
      g.beginPath();
      g.moveTo(cx + dir * 30, cz); g.lineTo(cx - dir * 10, cz - 14); g.lineTo(cx - dir * 10, cz + 14);
      g.fill();
    }
  }
  // pedestrian walkway (green) along south of main aisle
  g.fillStyle = 'rgba(41,179,107,0.35)';
  g.fillRect(...rect(B.minX + 1, AISLE.mainZ + 3.3, B.maxX - 1, AISLE.mainZ + 4.3));
  g.fillStyle = 'rgba(255,255,255,0.8)';
  for (let x = B.minX + 4; x < B.maxX - 2; x += 1.2) g.fillRect(X(x), Zc(AISLE.mainZ + 3.3), 0.5 * PX, 1.0 * PX);
  // hatched keep-clear zones
  const hatch = (x0, z0, x1, z1, col = '#f2c318') => {
    g.save();
    g.beginPath(); g.rect(...rect(x0, z0, x1, z1)); g.clip();
    g.strokeStyle = col; g.lineWidth = 9;
    for (let k = -2000; k < 4000; k += 28) { g.beginPath(); g.moveTo(X(x0) + k, Zc(z0)); g.lineTo(X(x0) + k + 600, Zc(z0) + 600); g.stroke(); }
    g.restore();
    g.strokeStyle = col; g.lineWidth = 5; g.strokeRect(...rect(x0, z0, x1, z1));
  };
  hatch(ASRS.aisles[0] - 2.8, ASRS.zMax + 0.5, ASRS.aisles[2] + 2.8, ASRS.ioZ[1] + 0.6);
  [1, 4, 7].forEach((x) => hatch(x - 0.7, 7.6, x + 0.7, 9.4, '#29b36b'));
  hatch(54.8, -4.3, 57.6, -1.2);
  for (const z of [14, 20, 26, 32]) for (let k = 0; k < 4; k++) { g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(...rect(49.5 + k * 1.5, z - 0.65, 50.9 + k * 1.5, z + 0.65)); }
  // station stop markers along assembly loop
  g.fillStyle = 'rgba(138,92,240,0.35)';
  LOOP.stations.forEach((x) => g.fillRect(...rect(x - 2.1, LOOP.zFwd - 4.9, x + 2.1, LOOP.zFwd + 1.4)));
  // zone names painted on floor
  g.font = 'bold 72px "Inter", "Segoe UI", sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.textAlign = 'left';
  for (const z of ZONES) {
    if (z.key === 'Logistics') continue;
    g.fillText(z.key.toUpperCase(), X(z.rect[0]) + 20, Zc(z.rect[3]) - 22);
  }
  // column grid labels
  g.font = 'bold 40px sans-serif';
  g.fillStyle = 'rgba(245,197,24,0.8)';
  COLUMN_X.forEach((x, i) => COLUMN_Z.forEach((z, j) => g.fillText(`${String.fromCharCode(65 + j)}${i + 1}`, X(x) + 18, Zc(z) - 18)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Building {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'Building';
    scene.add(this.root);
    const m = M();
    this.walls = [];
    this.roofParts = [];
    this.lampMats = [];
    this.buildGround();
    this.buildFloor();
    this.buildWalls();
    this.buildStructure();
    this.buildRooms();
    this.buildSigns();
    this.buildServices();
  }

  buildGround() {
    const asph = T.asphaltTexture();
    asph.repeat.set(28, 28);
    const ground = mesh(this.root, new THREE.CircleGeometry(140, 64), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.95, color: 0x8a8f96 }), 0, -0.05, 0, [-Math.PI / 2, 0, 0]);
    ground.castShadow = false;
    const grass = mesh(this.root, new THREE.RingGeometry(140, 1300, 64, 1), new THREE.MeshStandardMaterial({ color: 0x4d6b3a, roughness: 1 }), 0, -0.05, 0, [-Math.PI / 2, 0, 0]);
    grass.castShadow = false;
    grass.receiveShadow = false;
    // parking lines & trucks at east docks
    const lines = group(this.root);
    for (let i = 0; i < 12; i++) box(lines, 0.15, 0.01, 6, M().white, B.maxX + 20 + i * 3, -0.04, -24);
    for (const z of [14, 20, 26, 32]) this.truck(B.maxX + 1.2, z, z === 26);
    mergeStatic(lines);
  }

  truck(x, z, cab) {
    const m = M();
    const g = group(this.root, x, 0, z);
    box(g, 13.6, 2.9, 2.5, paint(0xdfe4e8, { rough: 0.5, metal: 0.2 }), 7.1, 1.1, 0);
    box(g, 13.6, 0.3, 2.5, m.darkGrey, 7.1, 0.8, 0);
    for (const dx of [10.5, 11.8, 13]) for (const s of [-1, 1]) cyl(g, 0.5, 0.35, m.rubber, dx, 0.5, s * 1.05, 'z', 20);
    box(g, 13.62, 0.4, 0.02, paint(0x1ba6a6), 7.1, 3.2, 1.26);
    if (cab) {
      box(g, 2.6, 2.8, 2.5, paint(0x1c3a6b), 15.6, 0.7, 0);
      box(g, 0.05, 1.0, 2.2, m.glass, 16.92, 2.2, 0);
      for (const s of [-1, 1]) cyl(g, 0.5, 0.35, m.rubber, 15.8, 0.5, s * 1.05, 'z', 20);
    }
    mergeStatic(g);
  }

  buildFloor() {
    const conc = T.concreteTexture();
    conc.repeat.set(W / 8, D / 8);
    const floorMat = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.42, metalness: 0.0, color: 0xc8cacc, envMapIntensity: 0.6 });
    const floor = mesh(this.root, new THREE.PlaneGeometry(W, D), floorMat, (B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2, [-Math.PI / 2, 0, 0]);
    floor.castShadow = false;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.floor = floor;
    const mk = new THREE.MeshStandardMaterial({ map: floorMarkings(), transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const marks = mesh(this.root, new THREE.PlaneGeometry(W, D), mk, (B.minX + B.maxX) / 2, 0.004, (B.minZ + B.maxZ) / 2, [-Math.PI / 2, 0, 0]);
    marks.castShadow = false;
    marks.receiveShadow = true;
    marks.renderOrder = 1;
    marks.name = 'marks';
    // plinth / slab edge
    const slab = mesh(this.root, G.box(W + 0.6, 0.3, D + 0.6), M().darkGrey, (B.minX + B.maxX) / 2, -0.16, (B.minZ + B.maxZ) / 2);
    slab.castShadow = false;
  }

  buildWalls() {
    const m = M();
    const tex = T.wallPanelTexture();
    const panel = (len) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(len / 2, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide });
    };
    const defs = [
      { side: 'N', a: [B.minX, B.minZ], b: [B.maxX, B.minZ], n: [0, 1] },
      { side: 'S', a: [B.minX, B.maxZ], b: [B.maxX, B.maxZ], n: [0, -1] },
      { side: 'W', a: [B.minX, B.minZ], b: [B.minX, B.maxZ], n: [1, 0] },
      { side: 'E', a: [B.maxX, B.minZ], b: [B.maxX, B.maxZ], n: [-1, 0] },
    ];
    for (const d of defs) {
      const g = group(this.root);
      g.name = `wall-${d.side}`;
      const len = Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]);
      const along = d.side === 'N' || d.side === 'S';
      const cx = (d.a[0] + d.b[0]) / 2, cz = (d.a[1] + d.b[1]) / 2;
      const rotY = along ? 0 : Math.PI / 2;
      const seg = (y0, h, mat, off = 0, l = len, center = 0) => {
        const w = mesh(g, G.box(l, h, 0.25), mat, along ? cx + center : cx + off, y0 + h / 2, along ? cz + off : cz + center, [0, rotY, 0]);
        return w;
      };
      // concrete plinth, lower cladding, window band, upper cladding
      seg(0, 1.2, m.lightGrey);
      const doors = d.side === 'E' ? [14, 20, 26, 32] : d.side === 'S' ? [12] : d.side === 'W' ? [23] : [];
      // lower cladding with door openings
      const lower = panel(len);
      const pieces = [];
      let cur = along ? d.a[0] : d.a[1];
      const end = along ? d.b[0] : d.b[1];
      const dw = d.side === 'E' ? 3.2 : 6;
      for (const dc of doors) { pieces.push([cur, dc - dw / 2]); cur = dc + dw / 2; }
      pieces.push([cur, end]);
      const cc = along ? cx : cz;
      for (const [p0, p1] of pieces) seg(1.2, 6.0, lower, 0, p1 - p0, (p0 + p1) / 2 - cc);
      for (const dc of doors) {
        const dh = d.side === 'E' ? 3.4 : 5.0;
        seg(1.2 + dh - 1.2, 7.2 - dh, lower, 0, dw, dc - cc);
        // sectional door (partly open) + frame
        const door = mesh(g, G.box(dw - 0.1, 1.2, 0.08), m.offWhite, along ? dc : cx + d.n[0] * 0.05, dh - 0.6, along ? cz + d.n[1] * 0.05 : dc, [0, rotY, 0]);
        box(g, along ? dw + 0.3 : 0.3, 0.25, along ? 0.3 : dw + 0.3, m.safetyYellow, along ? dc : cx, dh, along ? cz : dc);
        if (d.side === 'E') {
          // dock leveller + seal
          box(g, 0.3, 3.2, 3.6, m.charcoal, cx + 0.2, 0.3, dc);
          box(g, 1.8, 0.05, 2.6, m.hazard, cx - 1.0, 0.0, dc);
        }
      }
      // window band
      const glass = mesh(g, G.box(len, 2.2, 0.06), m.glass, along ? cx : cx, 8.3, along ? cz : cz, [0, rotY, 0]);
      glass.castShadow = false;
      for (let k = 0; k <= Math.floor(len / 4); k++) {
        const p = -len / 2 + k * 4;
        box(g, along ? 0.08 : 0.3, 2.2, along ? 0.3 : 0.08, m.darkGrey, along ? cx + p : cx, 7.2, along ? cz : cz + p);
      }
      seg(7.2, 0.12, m.darkGrey);
      seg(9.4, 0.12, m.darkGrey);
      seg(9.5, H - 9.5 + 0.3, panel(len));
      seg(H + 0.3, 0.4, m.darkGrey);
      mergeStatic(g);
      g.userData.normal = new THREE.Vector2(...d.n);
      g.userData.pos = new THREE.Vector2(along ? cx : d.a[0], along ? d.a[1] : cz);
      this.walls.push(g);
    }
  }

  buildStructure() {
    const m = M();
    const st = group(this.root);
    // I-beam columns (interior rows + perimeter)
    const colGeo = (() => {
      const s = new THREE.Shape();
      const w = 0.3, h = 0.4, t = 0.03, tw = 0.02;
      s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, -h / 2 + t); s.lineTo(tw / 2, -h / 2 + t); s.lineTo(tw / 2, h / 2 - t);
      s.lineTo(w / 2, h / 2 - t); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, h / 2 - t); s.lineTo(-tw / 2, h / 2 - t);
      s.lineTo(-tw / 2, -h / 2 + t); s.lineTo(-w / 2, -h / 2 + t); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const colMat = paint(0x3d5a80, { rough: 0.5, metal: 0.3 });
    const cols = [];
    COLUMN_X.forEach((x) => COLUMN_Z.forEach((z) => cols.push([x, z])));
    for (let x = B.minX; x <= B.maxX; x += 8) { cols.push([x, B.minZ + 0.35]); cols.push([x, B.maxZ - 0.35]); }
    for (let z = B.minZ + 8; z < B.maxZ; z += 8) { cols.push([B.minX + 0.35, z]); cols.push([B.maxX - 0.35, z]); }
    const im = new THREE.InstancedMesh(colGeo, colMat, cols.length);
    const o = new THREE.Object3D();
    cols.forEach(([x, z], i) => { o.position.set(x, 0, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = true; im.receiveShadow = true;
    this.root.add(im);
    // column foot guards (yellow) on interior columns
    COLUMN_X.forEach((x) => COLUMN_Z.forEach((z) => box(st, 0.55, 1.0, 0.6, m.safetyYellow, x, 0, z)));
    // roof trusses spanning Z every 8 m
    const trussMat = paint(0x9aa3ab, { rough: 0.5, metal: 0.6 });
    const trusses = group(this.root);
    for (let x = B.minX + 8; x < B.maxX; x += 8) {
      box(trusses, 0.2, 0.2, D, trussMat, x, H - 1.1, 0);
      box(trusses, 0.2, 0.2, D, trussMat, x, H - 0.1, 0);
      for (let z = B.minZ; z < B.maxZ; z += 2) {
        const dz = 2, len = Math.hypot(dz, 1);
        box(trusses, 0.08, 0.08, len, trussMat, x, H - 0.64, z + 1, [Math.atan2(1, dz) * ((z / 2) % 2 ? 1 : -1), 0, 0]);
      }
    }
    // purlins
    for (let z = B.minZ + 4; z < B.maxZ; z += 4) box(trusses, W, 0.15, 0.1, trussMat, 0, H + 0.02, z);
    // crane runway brackets on interior row
    mergeStatic(st);
    mergeStatic(trusses);
    // high-bay LED lamps (instanced, emissive – bloom)
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff3dc, emissiveIntensity: 3 });
    const lamps = [];
    for (let x = B.minX + 4; x < B.maxX; x += 8) for (let z = B.minZ + 6; z < B.maxZ; z += 8) lamps.push([x, z]);
    const lampGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.32, 0.4, 0.18, 20).translate(0, 0.09, 0),
      new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6).translate(0, 0.6, 0),
    ]);
    const lampBody = new THREE.InstancedMesh(lampGeo, m.darkGrey, lamps.length);
    const lampFace = new THREE.InstancedMesh(new THREE.CircleGeometry(0.33, 20).rotateX(Math.PI / 2), this.lampMat, lamps.length);
    lamps.forEach(([x, z], i) => { o.position.set(x, 9.9, z); o.updateMatrix(); lampBody.setMatrixAt(i, o.matrix); o.position.y = 9.895; o.updateMatrix(); lampFace.setMatrixAt(i, o.matrix); });
    this.root.add(lampBody, lampFace);
    this.roofParts.push(trusses);
    // roof cladding with skylights (shown in walk mode / from inside)
    const roof = group(this.root);
    roof.name = 'roof';
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide });
    this.skyMat = new THREE.MeshStandardMaterial({ color: 0xdfefff, emissive: 0xcfe6ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    for (let z = B.minZ; z < B.maxZ; z += 8) {
      mesh(roof, G.box(W, 0.08, 6), roofMat, 0, H + 0.2, z + 3).castShadow = false;
      mesh(roof, G.box(W, 0.05, 2), this.skyMat, 0, H + 0.24, z + 7).castShadow = false;
    }
    this.roof = roof;
  }

  buildRooms() {
    const m = M();
    const room = (x0, z0, x1, z1, name) => {
      const g = group(this.root);
      const h = 3.2;
      const frame = paint(0x2b3138, { rough: 0.5, metal: 0.5 });
      const edges = [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]];
      for (const [[ax, az], [bx, bz]] of edges) {
        const len = Math.hypot(bx - ax, bz - az);
        const ang = Math.atan2(-(bz - az), bx - ax);
        const cx = (ax + bx) / 2, cz = (az + bz) / 2;
        mesh(g, G.box(len, h - 0.9, 0.03), m.glass, cx, 0.9 + (h - 0.9) / 2, cz, [0, ang, 0]).castShadow = false;
        mesh(g, G.box(len, 0.9, 0.12), m.offWhite, cx, 0.45, cz, [0, ang, 0]);
        mesh(g, G.box(len, 0.1, 0.14), frame, cx, h, cz, [0, ang, 0]);
        for (let k = 0; k <= Math.round(len / 2); k++) {
          const t = k / Math.round(len / 2);
          box(g, 0.08, h, 0.08, frame, ax + (bx - ax) * t, 0, az + (bz - az) * t);
        }
      }
      const ceil = mesh(g, G.box(x1 - x0, 0.12, z1 - z0), m.offWhite, (x0 + x1) / 2, h + 0.06, (z0 + z1) / 2);
      ceil.userData.roomCeiling = true;
      mergeStatic(g);
      return g;
    };
    room(-15, 12, -1, 23.5, 'Quality Lab');
    room(-15, 26.5, -1, 37, 'Control Room');
    // control room interior: desks, video wall
    const cr = group(this.root);
    for (let i = 0; i < 3; i++) {
      box(cr, 3.2, 0.75, 0.9, m.offWhite, -8, 0, 30 + i * 1.8);
      for (let k = -1; k <= 1; k++) {
        const mon = group(cr, -8 + k * 1.0, 0.75, 30 + i * 1.8 - 0.2);
        box(mon, 0.7, 0.42, 0.04, m.charcoal, 0, 0.12, 0);
        mesh(mon, new THREE.PlaneGeometry(0.66, 0.38), (i + k) % 2 ? M().ledBlue : emissive(0x86c5ff, 0.6), 0, 0.33, 0.021).castShadow = false;
      }
      for (let k = -1; k <= 1; k++) this.chair(cr, -8 + k * 1.0, 30.7 + i * 1.8);
    }
    // video wall canvas (updated live from MES)
    this.videoCanvas = document.createElement('canvas');
    this.videoCanvas.width = 1024; this.videoCanvas.height = 384;
    this.videoTex = new THREE.CanvasTexture(this.videoCanvas);
    this.videoTex.colorSpace = THREE.SRGBColorSpace;
    const vw = mesh(cr, new THREE.PlaneGeometry(9, 3.2), new THREE.MeshBasicMaterial({ map: this.videoTex, toneMapped: false }), -8, 1.85, 27.0);
    vw.castShadow = false;
    box(cr, 9.2, 3.4, 0.1, m.charcoal, -8, 0.2, 26.9);
    // quality lab benches
    box(cr, 4, 0.9, 0.8, m.offWhite, -12, 0, 22.6);
    box(cr, 0.8, 0.9, 3, m.offWhite, -14.4, 0, 16);
    for (let i = 0; i < 3; i++) box(cr, 0.4, 0.3, 0.3, m.housing, -12.8 + i * 0.8, 0.9, 22.6);
    mergeStatic(cr);
  }

  chair(parent, x, z) {
    const m = M();
    const g = group(parent, x, 0, z);
    cyl(g, 0.03, 0.45, m.chrome, 0, 0.22, 0, 'y', 8);
    box(g, 0.48, 0.08, 0.46, m.charcoal, 0, 0.45, 0);
    box(g, 0.46, 0.55, 0.06, m.charcoal, 0, 0.55, 0.22);
    return g;
  }

  buildSigns() {
    const signs = [
      ['INJECTION MOULDING', 'Hall A · 4 × all-electric IMM', -42.5, -12, '#1ba6a6'],
      ['SHEET METAL SHOP', 'Hall B · Laser · Bending · Pressing', -42.5, 21, '#e0892b'],
      ['AS/RS HIGH-BAY', '3 aisles · 1188 locations', -9, -4.2, '#3a78d6'],
      ['ASSEMBLY LINE EB-200', 'Hall C · 7 automated stations', 37.5, -12.5, '#8a5cf0'],
      ['QUALITY LAB', 'Metrology · First article', -8, 11.4, '#29b36b'],
      ['CONTROL ROOM', 'MES · SCADA · Fleet manager', -8, 25.9, '#29b36b'],
      ['SHIPPING', 'Docks 1 – 4', 50, 9.8, '#7b8794'],
      ['UTILITIES', 'Compressed air · Chilled water · Power', 34, -30.8, '#d64545'],
    ];
    for (const [t, sub, x, z, col] of signs) {
      const tex = T.signTexture(t, { accent: col, sub, w: 1024, h: 200 });
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, side: THREE.DoubleSide, roughness: 0.6 });
      const s = mesh(this.root, new THREE.PlaneGeometry(6.4, 1.25), mat, x, z > 24 || (z > 9 && z < 12) || z === 25.9 ? 4.2 : 7.6, z);
      s.castShadow = false;
      const y = s.position.y;
      cyl(this.root, 0.01, H - y - 0.6, M().darkGrey, x - 2.8, y + (H - y) / 2, z, 'y', 4).castShadow = false;
      cyl(this.root, 0.01, H - y - 0.6, M().darkGrey, x + 2.8, y + (H - y) / 2, z, 'y', 4).castShadow = false;
    }
  }

  buildServices() {
    const m = M();
    const g = group(this.root);
    // compressed air ring main (blue) and ventilation ducts
    pipe(g, [[B.minX + 1, 6.5, B.minZ + 1], [B.maxX - 1, 6.5, B.minZ + 1], [B.maxX - 1, 6.5, B.maxZ - 1], [B.minX + 1, 6.5, B.maxZ - 1], [B.minX + 1, 6.5, B.minZ + 1.5]], 0.07, m.toteBlue);
    const duct = paint(0xc5ccd3, { rough: 0.35, metal: 0.8 });
    for (const z of [-24, 24]) {
      cyl(g, 0.55, 42, duct, -41, 11.2, z, 'x', 24);
      cyl(g, 0.55, 42, duct, 37, 11.2, z, 'x', 24);
      for (let x = -60; x <= 58; x += 6) if (Math.abs(x + 2) > 20) cyl(g, 0.4, 0.3, duct, x, 10.6, z, 'y', 16);
    }
    // cable trays along the interior column row
    box(g, W - 4, 0.08, 0.5, m.galv, 0, 7.4, -1.2);
    mergeStatic(g);
  }

  // Hide walls between camera and interior; roof only when inside
  update(camera, walkMode) {
    const cp = new THREE.Vector2(camera.position.x, camera.position.z);
    for (const w of this.walls) {
      const n = w.userData.normal, p = w.userData.pos;
      const outside = cp.clone().sub(p).dot(n) < 0;
      w.visible = walkMode || !outside || camera.position.y < 0.5;
    }
    const inside = camera.position.x > B.minX && camera.position.x < B.maxX && camera.position.z > B.minZ && camera.position.z < B.maxZ;
    this.roof.visible = walkMode || (inside && camera.position.y < H);
  }

  setNight(k) {
    this.lampMat.emissiveIntensity = 2.6 + k * 3.5;
    this.skyMat.emissiveIntensity = 0.6 * (1 - k) + 0.02;
    this.skyMat.color.setHSL(0.58, 0.3, 0.85 - k * 0.7);
  }

  drawVideoWall(kpi) {
    const c = this.videoCanvas, g = c.getContext('2d');
    g.fillStyle = '#07111c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1ba6a6'; g.fillRect(0, 0, c.width, 34);
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif';
    g.fillText(`${PLANT.name} · LIVE MES`, 16, 25);
    g.textAlign = 'right'; g.fillText(new Date().toLocaleTimeString(), c.width - 16, 25); g.textAlign = 'left';
    const tiles = [['OEE', `${kpi.oee.toFixed(1)} %`, '#29b36b'], ['OUTPUT', `${kpi.output}`, '#3a9bff'], ['RATE /h', `${kpi.rate.toFixed(0)}`, '#f2c318'], ['ALARMS', `${kpi.alarms}`, kpi.alarms ? '#ff4d4d' : '#29b36b']];
    tiles.forEach(([k, v, col], i) => {
      const x = 16 + i * 252;
      g.fillStyle = '#10243a'; g.fillRect(x, 50, 236, 120);
      g.fillStyle = '#8fa6bb'; g.font = '18px sans-serif'; g.fillText(k, x + 14, 78);
      g.fillStyle = col; g.font = 'bold 54px sans-serif'; g.fillText(v, x + 14, 146);
    });
    g.fillStyle = '#10243a'; g.fillRect(16, 186, 992, 180);
    g.strokeStyle = '#3a9bff'; g.lineWidth = 3; g.beginPath();
    (kpi.trend || []).forEach((v, i, a) => { const x = 24 + (i / Math.max(1, a.length - 1)) * 976, y = 356 - (v / 100) * 160; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = '#8fa6bb'; g.font = '16px sans-serif'; g.fillText('Plant OEE trend', 26, 206);
    this.videoTex.needsUpdate = true;
  }
}
