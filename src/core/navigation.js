// Camera navigation: orbit, first-person walk (WASD + pointer lock) with
// collision against equipment footprints, animated fly-to and guided tours.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { PLANT } from '../../shared/catalog.js';

const B = PLANT.building;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const TOURS = [
  { name: 'Plant overview', pos: [-70, 62, 88], target: [0, 0, 0], caption: 'NEXUS Plant 01 – a fully automated EB-200 enclosure factory' },
  { name: 'Injection moulding', pos: [-28, 11, -2], target: [-44, 1.5, -19], caption: '4 all-electric injection moulding machines with linear take-out robots' },
  { name: 'Laser cutting', pos: [-44, 7, 25], target: [-52, 1, 15], caption: 'Fiber lasers fed by automatic sheet storage towers' },
  { name: 'Robotic bending & pressing', pos: [-31, 6.5, 22], target: [-36, 1.2, 14.5], caption: 'Robot-tended press brakes, 400 t hydraulic press and servo press coil line' },
  { name: 'AS/RS high-bay', pos: [4, 13, 6], target: [-9, 4, -18], caption: 'Mini-load AS/RS: 3 stacker cranes, 1188 tote locations' },
  { name: 'AGV logistics', pos: [-2, 7, 16], target: [-10, 0, 3], caption: 'AMR fleet on right-hand lanes with automatic charging' },
  { name: 'Assembly line', pos: [30, 8, -8], target: [37, 1, -21], caption: '7 automated stations on a twin-belt pallet transfer loop' },
  { name: 'End of line', pos: [48, 7, 3], target: [57, 1, -7], caption: 'Cartoning, palletizing robot, stretch wrapper and forklift AGV' },
  { name: 'Quality & control room', pos: [4, 9, 24], target: [-8, 1, 24], caption: 'CMM metrology lab and the MES control room video wall' },
];

export class Navigation {
  constructor(engine, dom) {
    this.engine = engine;
    this.camera = engine.camera;
    this.dom = dom;
    const oc = (this.orbit = new OrbitControls(this.camera, dom));
    oc.enableDamping = true;
    oc.dampingFactor = 0.08;
    oc.maxPolarAngle = Math.PI * 0.495;
    oc.minDistance = 1.5;
    oc.maxDistance = 320;
    oc.screenSpacePanning = false;
    oc.target.set(0, 0, 0);
    oc.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
    oc.listenToKeyEvents(window);
    this.walk = new PointerLockControls(this.camera, document.body);
    this.mode = 'orbit';
    this.keys = {};
    this.vel = new THREE.Vector3();
    this.obstacles = [];
    this.fly = null;
    this.tour = null;
    window.addEventListener('keydown', (e) => { if (e.target.closest?.('input, textarea, select')) return; this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    this.walk.addEventListener('unlock', () => { if (this.mode === 'walk') this.onWalkUnlock?.(); });
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.cancelTour();
    this.mode = mode;
    if (mode === 'walk') {
      this.orbit.enabled = false;
      const t = this.orbit.target;
      const p = this.camera.position;
      // drop down to eye height near the current target
      const start = new THREE.Vector3(THREE.MathUtils.clamp(t.x, B.minX + 2, B.maxX - 2), 1.7, THREE.MathUtils.clamp(t.z + 6, B.minZ + 2, B.maxZ - 2));
      if (this.blocked(start)) start.set(0, 1.7, 5.5);
      p.copy(start);
      this.camera.lookAt(t.x, 1.4, t.z);
      this.walk.lock();
    } else {
      this.walk.unlock();
      this.orbit.enabled = true;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.orbit.target.copy(this.camera.position).addScaledVector(dir, 12).setY(0.5);
      this.camera.position.y = Math.max(this.camera.position.y, 8);
      this.camera.position.addScaledVector(dir, -8);
    }
  }
  lockWalk() { if (this.mode === 'walk') this.walk.lock(); }

  setObstacles(boxes) { this.obstacles = boxes; }
  blocked(p) {
    for (const b of this.obstacles) if (p.x > b.min.x - 0.3 && p.x < b.max.x + 0.3 && p.z > b.min.z - 0.3 && p.z < b.max.z + 0.3 && b.max.y > 0.6) return true;
    return false;
  }

  flyTo(target, radius = 5, { dir = null, duration = 1.4 } = {}) {
    this.cancelTour();
    if (this.mode === 'walk') this.setMode('orbit');
    const t = target.clone();
    const cur = this.camera.position.clone();
    const d = dir ? dir.clone().normalize() : cur.clone().sub(this.orbit.target).normalize();
    if (d.y < 0.35) { d.y = 0.35; d.normalize(); }
    const dist = Math.max(3.5, radius * 2.3);
    const endPos = t.clone().addScaledVector(d, dist);
    endPos.y = Math.max(endPos.y, 1.2);
    this.fly = { p0: cur, p1: endPos, t0: this.orbit.target.clone(), t1: t, k: 0, dur: duration };
  }
  flyToPose(pos, target, duration = 2.2) {
    if (this.mode === 'walk') this.setMode('orbit');
    this.fly = { p0: this.camera.position.clone(), p1: new THREE.Vector3(...pos), t0: this.orbit.target.clone(), t1: new THREE.Vector3(...target), k: 0, dur: duration };
  }

  startTour(onStep) {
    this.cancelTour();
    this.tour = { i: 0, t: 0, onStep };
    this.gotoTourStep(0);
  }
  gotoTourStep(i) {
    const s = TOURS[i % TOURS.length];
    this.flyToPose(s.pos, s.target, 3.2);
    this.tour && (this.tour.i = i, this.tour.t = 0);
    this.tour?.onStep?.(s, i);
  }
  cancelTour() { if (this.tour) { this.tour.onStep?.(null); this.tour = null; } }

  update(dt) {
    if (this.fly) {
      const f = this.fly;
      f.k = Math.min(1, f.k + dt / f.dur);
      const k = easeInOut(f.k);
      // arc the path upwards for long flights
      const lift = Math.sin(k * Math.PI) * Math.min(25, f.p0.distanceTo(f.p1) * 0.18);
      this.camera.position.lerpVectors(f.p0, f.p1, k).y += lift;
      this.orbit.target.lerpVectors(f.t0, f.t1, k);
      if (f.k >= 1) this.fly = null;
    }
    if (this.tour) {
      this.tour.t += dt;
      // slow orbit while dwelling on a tour stop
      if (!this.fly) {
        const off = this.camera.position.clone().sub(this.orbit.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.05);
        this.camera.position.copy(this.orbit.target).add(off);
      }
      if (this.tour.t > 9) this.gotoTourStep(this.tour.i + 1);
    }
    if (this.mode === 'walk') {
      const speed = this.keys.ShiftLeft || this.keys.ShiftRight ? 7 : 3.2;
      const fwd = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0);
      const side = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
      const target = new THREE.Vector3();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      target.addScaledVector(dir, fwd * speed).addScaledVector(right, side * speed);
      this.vel.lerp(target, Math.min(1, dt * 10));
      const p = this.camera.position;
      const nx = p.clone(); nx.x += this.vel.x * dt;
      if (!this.blocked(nx) && nx.x > B.minX + 0.6 && nx.x < B.maxX - 0.6) p.x = nx.x;
      const nz = p.clone(); nz.z += this.vel.z * dt;
      if (!this.blocked(nz) && nz.z > B.minZ + 0.6 && nz.z < B.maxZ - 0.6) p.z = nz.z;
      const bob = this.vel.length() > 0.5 ? Math.sin(performance.now() * 0.011) * 0.025 : 0;
      p.y = 1.7 + bob;
    } else {
      this.orbit.update(dt);
    }
  }
}
