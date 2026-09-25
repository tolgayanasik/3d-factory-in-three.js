// AGV fleet: roller-top AMRs + autonomous forklift, charging stations,
// graph routing on the aisle network with right-hand lanes and simple
// collision avoidance, and the logistics missions tying the plant together.
import * as THREE from 'three';
import { M, paint, emissive } from '../world/materials.js';
import { Equipment, box, rbox, cyl, group, mesh, G, lerp, clamp, easeInOut } from './common.js';
import { makeTote, TOTE_SCALE } from './asrs.js';
import { AISLE } from '../../shared/catalog.js';

// ---------------------------------------------------------------------------
// Aisle graph
const Z = AISLE.mainZ;
const nodes = new Map();
const edges = new Map();
function N(id, x, z) { nodes.set(id, new THREE.Vector2(x, z)); edges.set(id, []); }
function E(a, b, spur = false) { edges.get(a).push({ to: b, spur }); edges.get(b).push({ to: a, spur }); }
const mainXs = [-60, -53.7, -44.7, -35.7, -26.7, -24.3, -20, -14.4, -10.4, -6.4, 1, 4, 7, 12, 18.8, 30, 44, 56.2, 61];
mainXs.forEach((x) => N(`M${x}`, x, Z));
for (let i = 0; i < mainXs.length - 1; i++) E(`M${mainXs[i]}`, `M${mainXs[i + 1]}`);
[1, 4, 7].forEach((x, i) => { N(`CHG${i}`, x, 8.3); E(`M${x}`, `CHG${i}`, true); });
N('WRAP', 56.2, -3.9); E('M56.2', 'WRAP', true);
const shipZ = [14, 20, 26, 32];
let prev = 'M44';
shipZ.forEach((z, i) => { N(`S${z}`, AISLE.shipX, z); E(prev, `S${z}`); prev = `S${z}`; N(`D${i}`, 48.6, z); E(`S${z}`, `D${i}`, true); });
// west / east north-south aisles (used for parking)
N('W-N', -20, -30); E('M-20', 'W-N');
N('E-N', 12, -30); E('M12', 'E-N');
N('E-S', 12, 30); E('M12', 'E-S');

function route(from, to) {
  const dist = new Map([[from, 0]]);
  const prevN = new Map();
  const open = new Set([from]);
  while (open.size) {
    let u = null, best = Infinity;
    for (const n of open) if (dist.get(n) < best) { best = dist.get(n); u = n; }
    open.delete(u);
    if (u === to) break;
    for (const e of edges.get(u)) {
      const d = best + nodes.get(u).distanceTo(nodes.get(e.to));
      if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); prevN.set(e.to, { n: u, spur: e.spur }); open.add(e.to); }
    }
  }
  const out = [{ n: to }];
  let c = to;
  while (prevN.has(c)) { const p = prevN.get(c); out[0].spur = p.spur; out.unshift({ n: p.n }); c = p.n; }
  return out; // [{n, spur(of edge arriving here)}]
}

function nearestNode(p) {
  let best = null, bd = Infinity;
  for (const [id, v] of nodes) {
    if (id.startsWith('CHG') || id === 'WRAP' || id.startsWith('D')) continue;
    const d = v.distanceTo(p);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// Convert a node route into an offset, filleted polyline
function buildPath(start, rt) {
  const segs = [];
  for (let i = 0; i < rt.length - 1; i++) {
    const a = nodes.get(rt[i].n), b = nodes.get(rt[i + 1].n);
    const d = b.clone().sub(a).normalize();
    const off = rt[i + 1].spur ? 0 : AISLE.laneOffset;
    const r = new THREE.Vector2(-d.y, d.x).multiplyScalar(off);
    segs.push({ a: a.clone().add(r), b: b.clone().add(r), d });
  }
  const pts = [start.clone()];
  if (!segs.length) {
    const n = nodes.get(rt[rt.length - 1].n).clone();
    if (rt[rt.length - 1].n.startsWith('M') && Math.abs(start.y - n.y) < AISLE.laneOffset + 0.3) n.y = start.y;
    const len = start.distanceTo(n);
    return len < 0.01 ? { pts: [start.clone(), start.clone().add(new THREE.Vector2(0.001, 0))], cum: [0, 0.001], len: 0.001 } : { pts: [start.clone(), n], cum: [0, len], len };
  }
  pts.push(segs[0].a);
  for (let i = 0; i < segs.length - 1; i++) {
    const s1 = segs[i], s2 = segs[i + 1];
    const cross = s1.d.x * s2.d.y - s1.d.y * s2.d.x;
    if (Math.abs(cross) < 1e-3) { pts.push(s1.b); continue; }
    const t = ((s2.a.x - s1.a.x) * s2.d.y - (s2.a.y - s1.a.y) * s2.d.x) / cross;
    pts.push(s1.a.clone().addScaledVector(s1.d, t));
  }
  pts.push(segs[segs.length - 1].b);
  // remove duplicates
  const clean = [pts[0]];
  for (const p of pts) if (p.distanceTo(clean[clean.length - 1]) > 0.05) clean.push(p);
  // fillet corners
  const out = [clean[0]];
  for (let i = 1; i < clean.length - 1; i++) {
    const p0 = clean[i - 1], p = clean[i], p1 = clean[i + 1];
    const d1 = p.clone().sub(p0), d2 = p1.clone().sub(p);
    const l1 = d1.length(), l2 = d2.length();
    d1.normalize(); d2.normalize();
    if (Math.abs(d1.x * d2.y - d1.y * d2.x) < 0.05 && d1.dot(d2) > 0) { out.push(p); continue; }
    const r = Math.min(1.3, l1 / 2, l2 / 2);
    const a = p.clone().addScaledVector(d1, -r), b = p.clone().addScaledVector(d2, r);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      out.push(new THREE.Vector2(
        (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * p.x + t * t * b.x,
        (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * p.y + t * t * b.y,
      ));
    }
  }
  out.push(clean[clean.length - 1]);
  const cum = [0];
  for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + out[i].distanceTo(out[i - 1]));
  return { pts: out, cum, len: cum[cum.length - 1] };
}

function samplePath(path, s) {
  const { pts, cum } = path;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = clamp((s - cum[i - 1]) / seg, 0, 1);
  const p = pts[i - 1].clone().lerp(pts[i], t);
  const d = pts[i].clone().sub(pts[i - 1]).normalize();
  return { p, d };
}

// ---------------------------------------------------------------------------
export const FLEET = [];

export class AGV extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    this.fork = def.type === 'forklift';
    this.body = this.dyn(this.root, 0, 0, 0);
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x00e0ff, emissiveIntensity: 3.5 });
    if (this.fork) this.buildForklift(m); else this.buildAMR(m);
    // blue safety spot projected on the floor ahead
    const spotMat = new THREE.MeshBasicMaterial({ color: 0x2f7dff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.spot = mesh(this.body, new THREE.CircleGeometry(0.22, 24), spotMat, this.fork ? -2.4 : 2.2, 0.012, 0, [-Math.PI / 2, 0, 0]);
    this.spot.castShadow = false;
    this.spot.userData.noMerge = true;
    this.labelHeight = this.fork ? 3.2 : 1.6;
    this.battery = Number(def.mes?.battery) || 80;
    this.mission = def.params.mission;
    this.state = 'idle';
    this.path = null; this.s = 0; this.v = 0;
    this.heading = 0;
    this.wait = 0; this.blockedT = 0; this.ignoreT = 0;
    this.load = null;
    this.stateText = 'Idle';
    this.pos2 = new THREE.Vector2(def.pos[0], def.pos[1] - AISLE.laneOffset);
    this.jobs = [];
    FLEET.push(this);
  }
  buildAMR(m) {
    const b = this.body;
    rbox(b, 1.6, 0.3, 1.0, m.safetyYellow, 0, 0.06, 0, 0.06);
    box(b, 1.62, 0.07, 1.02, m.charcoal, 0, 0.02, 0);
    box(b, 1.64, 0.04, 1.04, this.ledMat, 0, 0.18, 0);
    box(b, 1.4, 0.06, 0.9, m.darkGrey, 0, 0.36, 0);
    for (let i = 0; i < 9; i++) cyl(b, 0.035, 0.86, m.steel, -0.64 + i * 0.16, 0.43, 0, 'z', 10);
    for (const [x, z] of [[0.72, 0.42], [-0.72, -0.42]]) { cyl(b, 0.07, 0.1, m.charcoal, x, 0.3, z, 'y', 16); cyl(b, 0.055, 0.03, m.ledCyan, x, 0.36, z, 'y', 12); }
    box(b, 0.3, 0.03, 0.2, m.charcoal, 0.4, 0.4, 0.41);
    box(b, 0.04, 0.12, 0.2, m.red, -0.81, 0.2, 0.3); // e-stop
    this.carry = group(b, 0, 0.47, 0);
    this.carry.userData.dynamic = true;
  }
  buildForklift(m) {
    const b = this.body;
    const yl = paint(0xf2c318, { rough: 0.4, metal: 0.15 });
    // chassis: forks point to -X (drives forward in +X, docks by reversing?) – we keep forks forward (-X local = front)
    rbox(b, 1.9, 0.9, 1.1, yl, 0.35, 0.12, 0, 0.08);
    rbox(b, 0.8, 0.65, 1.0, m.charcoal, 0.95, 1.02, 0, 0.06);
    box(b, 1.92, 0.06, 1.12, this.ledMat, 0.35, 0.95, 0);
    for (const [x, z] of [[-0.3, 0.5], [-0.3, -0.5], [1.0, 0.5], [1.0, -0.5]]) cyl(b, 0.2, 0.18, m.rubber, x, 0.2, z, 'z', 20);
    // mast
    for (const z of [-0.35, 0.35]) box(b, 0.1, 2.4, 0.1, m.darkGrey, -0.7, 0.1, z);
    box(b, 0.12, 0.1, 0.8, m.darkGrey, -0.7, 2.45, 0);
    cyl(b, 0.09, 0.14, m.charcoal, 0.95, 1.8, 0, 'y', 16); // lidar
    cyl(b, 0.05, 0.1, m.ledBlue, 0.95, 1.95, 0, 'y', 12);
    this.forks = group(b, -0.78, 0.12, 0);
    this.forks.userData.dynamic = true;
    box(this.forks, 0.08, 0.7, 0.9, m.charcoal, 0, 0, 0);
    for (const z of [-0.25, 0.25]) box(this.forks, 1.15, 0.05, 0.12, m.darkSteel, -0.6, 0, z);
    this.carry = group(this.forks, -0.6, 0.05, 0);
    this.carry.rotation.y = Math.PI / 2;
    this.carry.userData.dynamic = true;
  }
  place() { this.root.position.set(0, 0, 0); this.setPose(this.pos2, 0); }
  setPose(p, heading) {
    this.pos2.copy(p);
    this.body.position.set(p.x, 0, p.y);
    this.heading = heading;
    this.body.rotation.y = this.fork ? heading + Math.PI : heading;
  }
  // world anchor for labels / camera follow
  get worldPos() { return this.body.position; }
  link() {
    this.ctx.fleetTime = 0;
    this.nodeHere = nearestNode(this.pos2);
    this.setPose(nodes.get(this.nodeHere).clone().add(new THREE.Vector2(0, -AISLE.laneOffset)), 0);
  }
  goTo(nodeId, then) {
    const from = nearestNode(this.pos2);
    const rt = route(from, nodeId);
    this.path = buildPath(this.pos2.clone(), rt);
    this.s = 0;
    this.state = 'drive';
    this.target = nodeId;
    this.onArrive = then;
  }
  reverseTo(nodeId, then) {
    const target = nodes.get(nodeId).clone();
    this.path = { pts: [this.pos2.clone(), target], cum: [0, this.pos2.distanceTo(target)], len: this.pos2.distanceTo(target) };
    this.s = 0; this.state = 'drive'; this.reverse = true; this.onArrive = then;
  }
  doFor(sec, text, then) { this.state = 'work'; this.wait = sec; this.stateText = text; this.onDone = then; }

  update(dt, t, rawDt) {
    if (!dt) { this.ledMat.emissive.setHex(this.status === 'Down' ? 0xff2a1f : 0xffa21a); return; }
    const sim = this.ctx;
    if (this.state === 'drive') {
      const vmax = this.fork ? 1.5 : 1.9;
      const remain = this.path.len - this.s;
      let target = Math.min(vmax, Math.sqrt(2 * 0.9 * Math.max(0, remain)) + 0.05);
      // curvature slow-down
      const ahead = samplePath(this.path, Math.min(this.path.len, this.s + 1.2)).d;
      const here = samplePath(this.path, this.s).d;
      if (here.dot(ahead) < 0.9) target = Math.min(target, 0.8);
      // collision avoidance
      this.ignoreT -= dt;
      const blocked = this.ignoreT <= 0 && this.isBlocked(this.reverse ? here.clone().negate() : here);
      if (blocked) { target = 0; this.blockedT += dt; if (this.blockedT > 5) { this.ignoreT = 2.5; this.blockedT = 0; } } else this.blockedT = 0;
      this.v += clamp(target - this.v, -2.5 * dt, 1.2 * dt);
      this.s = Math.min(this.path.len, this.s + this.v * dt);
      const { p, d } = samplePath(this.path, this.s);
      let h = Math.atan2(-d.y, d.x);
      if (this.reverse) h += Math.PI;
      // smooth heading
      let dh = h - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.setPose(p, this.heading + dh * Math.min(1, dt * 8));
      this.battery = Math.max(3, this.battery - dt * 0.05 * (this.load ? 1.4 : 1));
      this.stateText = blocked ? 'Waiting – path blocked' : this.reverse ? 'Reversing' : `Driving → ${this.targetText || this.target}`;
      this.ledMat.emissive.setHex(blocked ? 0xffa21a : 0x00e0ff);
      if (this.s >= this.path.len - 0.01) {
        this.state = 'idle'; this.v = 0; this.reverse = false;
        const cb = this.onArrive; this.onArrive = null; cb?.();
      }
    } else if (this.state === 'work') {
      this.wait -= dt;
      this.ledMat.emissive.setHex(0x2f8cff);
      this.onWork?.(dt);
      if (this.wait <= 0) { this.state = 'idle'; const cb = this.onDone; this.onDone = null; this.onWork = null; cb?.(); }
    } else if (this.state === 'charge') {
      this.battery = Math.min(100, this.battery + dt * 0.8);
      this.ledMat.emissive.setHex(0x1fdc5a);
      this.ledMat.emissiveIntensity = 1.5 + Math.sin(t * 3) * 1.2;
      this.stateText = `Charging ${this.battery.toFixed(0)} %`;
      if (this.battery >= 96) { this.ledMat.emissiveIntensity = 3.5; this.state = 'idle'; this.chargerEq && (this.chargerEq.occupied = null); }
    }
    this.spot.visible = this.state === 'drive' && this.v > 0.1;
    if (this.state === 'idle') this.nextMission();
  }

  isBlocked(dir) {
    const me = this.pos2;
    for (const o of FLEET) {
      if (o === this) continue;
      const rel = o.pos2.clone().sub(me);
      const d = rel.length();
      if (d > 3.0) continue;
      const along = rel.dot(dir);
      const lateral = Math.abs(rel.x * dir.y - rel.y * dir.x);
      if (along > 0.3 && lateral < 1.0) {
        // tie break for mutual blocks: lower id yields
        if (o.state === 'drive' && o.isHeadingTo(me) && this.id > o.id) return false;
        return true;
      }
    }
    for (const p of this.ctx.people || []) {
      const rel = p.pos.clone().sub(me);
      if (rel.length() < 2.6 && rel.dot(dir) > 0.3 && Math.abs(rel.x * dir.y - rel.y * dir.x) < 0.9) return true;
    }
    return false;
  }
  isHeadingTo(p) {
    const d = new THREE.Vector2(Math.cos(this.heading), -Math.sin(this.heading));
    return p.clone().sub(this.pos2).dot(d) > 0;
  }

  // ------------------------------------------------------------ missions
  nextMission() {
    if (this.fork) return this.forkMission();
    if (this.battery < 28) return this.goCharge();
    const get = (id) => this.ctx.get(id);
    const io = get('CNV-A01');
    const mission = this.mission;
    const pickBin = (ids) => {
      let best = null, bf = -1;
      for (const id of ids) { const c = get(id); if (c && c.fill > bf) { bf = c.fill; best = c; } }
      return best && best.fill >= 0.3 ? best : null;
    };
    if (mission === 0 || mission === 1) {
      const ids = mission === 0 ? ['CNV-P01', 'CNV-P02', 'CNV-P03', 'CNV-P04'] : ['CNV-M01'];
      const lane = mission;
      const src = pickBin(ids);
      if (!src) return this.park(mission === 0 ? 'M-44.7' : 'M-24.3', 'Waiting for full tote');
      const x = src.def.params.path[src.def.params.path.length - 1][0];
      this.targetText = src.id;
      this.goTo(`M${x}`, () => this.transfer('load', src.binWorld(), () => {
        src.emptyBin();
        const t = makeTote(0x2f6fd1, true, mission === 0 ? M().cover : M().housing);
        this.pickup(t);
        this.targetText = 'AS/RS P&D';
        this.goTo(mainXsFor(lane), () => {
          const tr = io.lanes[lane];
          this.until(() => tr.canAdd(), 'Waiting for P&D', () => this.transfer('unload', io.mouth(lane).setY(0.76), () => {
            const tt = this.drop(); tr.addItem(tt, 0);
          }));
        });
      }));
    } else if (mission === 2 || mission === 3) {
      const tr = io.lanes[2];
      const inf = get('CNV-L03');
      if (!tr.atEnd()) return this.park(mission === 2 ? 'M1' : 'M4', 'Waiting for kit');
      if (this.ctx.claimed === tr.items[0]) return this.park(mission === 2 ? 'M1' : 'M4', 'Waiting for kit');
      this.ctx.claimed = tr.items[0];
      this.targetText = 'AS/RS outbound';
      this.goTo('M-6.4', () => {
        const t = tr.take();
        this.ctx.claimed = null;
        if (!t) return;
        this.transfer('load', io.mouth(2).setY(0.76), () => this.pickup(t));
        this.onDoneExtra = () => {
          this.targetText = 'Assembly kit infeed';
          this.goTo('M18.8', () => this.until(() => inf.canAdd(), 'Waiting for infeed', () => this.transfer('unload', new THREE.Vector3(18.8, 0.76, 0.6), () => { const tt = this.drop(); inf.addItem(tt, 0); })));
        };
      });
    } else if (mission === 4) {
      // empty tote return from assembly to moulding hall
      const at = this.pos2.x > 0;
      this.targetText = at ? 'Moulding hall' : 'Assembly return';
      this.goTo(at ? 'M-53.7' : 'M30', () => this.doFor(3, 'Transferring empty totes', () => {
        if (this.load) { const o = this.drop(); o?.parent?.remove(o); }
        else { const t = makeTote(0x5d6770, false); this.pickup(t); }
      }));
    }
  }
  park(node, text) {
    if (nearestNode(this.pos2) === node && this.pos2.distanceTo(nodes.get(node)) < 1.5) { this.doFor(1.5, text); return; }
    this.targetText = 'Parking';
    this.goTo(node, () => this.doFor(1, text));
  }
  until(cond, text, then) {
    if (cond()) return then();
    this.doFor(0.5, text, () => this.until(cond, text, then));
  }
  goCharge() {
    const chargers = ['CHG-01', 'CHG-02', 'CHG-03'].map((id) => this.ctx.get(id)).filter(Boolean);
    const free = chargers.find((c) => !c.occupied);
    if (!free) return this.park('M12', 'Waiting for charger');
    free.occupied = this;
    this.chargerEq = free;
    const idx = chargers.indexOf(free);
    this.targetText = free.id;
    this.goTo(`CHG${idx}`, () => { this.state = 'charge'; });
  }
  transfer(kind, worldPoint, then) {
    // animate tote sliding between station and AGV top
    this.doFor(1.6, kind === 'load' ? 'Loading' : 'Unloading', () => { then?.(); const x = this.onDoneExtra; this.onDoneExtra = null; x?.(); });
    this.transferAnim = { kind, from: worldPoint.clone(), t: 0 };
    this.onWork = (dt) => {
      const a = this.transferAnim;
      a.t += dt;
      if (kind === 'unload' && this.load) {
        const k = easeInOut(Math.min(1, a.t / 1.4));
        const start = this.carry.getWorldPosition(new THREE.Vector3());
        this.load.position.copy(this.load.parent.worldToLocal(start.lerp(a.from, k)));
      }
    };
  }
  pickup(obj) {
    this.load = obj;
    this.carry.add(obj);
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, Math.PI / 2, 0);
  }
  drop() {
    const o = this.load;
    this.load = null;
    if (o) { this.ctx.dynamicRoot.attach(o); }
    return o;
  }
  // --------------------------------------------------- forklift mission
  forkMission() {
    const wr = this.ctx.get('SWR-01');
    if (!wr || !wr.palletReady) return this.park('M44', 'Waiting for wrapped pallet');
    const ship = this.ctx.shipping;
    const slot = ship.nextSlot();
    this.targetText = 'Stretch wrapper';
    const lift = (dir) => (dt) => { this.forks.position.y = clamp(this.forks.position.y + dir * dt * 0.3, 0.12, 0.42); };
    this.goTo('WRAP', () => {
      const p = wr.takePallet();
      if (p) { this.load = p; this.carry.add(p); p.position.set(0, -0.06, 0); p.rotation.set(0, 0, 0); }
      this.doFor(1.6, 'Lifting pallet', () => {
        this.reverseTo('M56.2', () => {
          this.targetText = `Shipping lane ${slot.lane + 1}`;
          this.goTo(`D${slot.lane}`, () => {
            this.doFor(1.6, 'Lowering pallet', () => {
              const o = this.load; this.load = null;
              if (o) ship.put(o, slot);
              this.reverseTo(`S${shipZ[slot.lane]}`, () => {});
            });
            this.onWork = lift(-1);
          });
        });
      });
      this.onWork = lift(1);
    });
  }
}
function mainXsFor(lane) { return `M${[-14.4, -10.4, -6.4][lane]}`; }

// ---------------------------------------------------------------------------
export class Charger extends Equipment {
  constructor(def, ctx) {
    super(def, ctx);
    const m = M();
    const st = this.static;
    box(st, 1.3, 0.02, 1.6, m.hazard, 0, 0, -0.9);
    rbox(st, 0.8, 1.1, 0.35, m.white, 0, 0, 0, 0.05);
    box(st, 0.82, 0.1, 0.37, m.charcoal, 0, 1.1, 0);
    box(st, 0.5, 0.06, 0.25, m.copper, 0, 0.1, -0.2);
    this.led = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x1fdc5a, emissiveIntensity: 1.5 });
    box(st, 0.5, 0.05, 0.02, this.led, 0, 0.85, 0.18).userData.noMerge = true;
    this.andon(0.3, 1.2, 0, st, 0.6);
    this.labelHeight = 1.9;
    this.occupied = null;
  }
  update(dt, t) { this.led.emissiveIntensity = this.occupied ? 1.2 + Math.sin(t * 4) : 0.4; }
}

// Shipping area pallet slots filled by the forklift
export class Shipping {
  constructor(parent) {
    this.group = group(parent);
    this.slots = [];
    shipZ.forEach((z, lane) => { for (let k = 0; k < 4; k++) this.slots.push({ lane, x: 50.2 + k * 1.5, z, obj: null }); });
    this.i = 0;
  }
  nextSlot() { return this.slots.find((s) => !s.obj) || this.slots[this.i++ % this.slots.length]; }
  put(o, slot) {
    if (slot.obj) slot.obj.parent?.remove(slot.obj);
    slot.obj = o;
    this.group.attach(o);
    o.position.set(slot.x, 0, slot.z);
    o.rotation.set(0, 0, 0);
    if (this.slots.every((s) => s.obj)) { // truck loaded → clear one lane
      const lane = (this.cleared = ((this.cleared ?? -1) + 1) % 4);
      this.slots.filter((s) => s.lane === lane).forEach((s) => { s.obj.parent?.remove(s.obj); s.obj = null; });
    }
  }
}

export { nodes as AGV_NODES, shipZ };
