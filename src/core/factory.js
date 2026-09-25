// Builds the whole plant: building, all equipment (from the catalog), props,
// people and overlays. Returns a context used by the rest of the app.
import * as THREE from 'three';
import { EQUIPMENT } from '../../shared/catalog.js';
import { Building } from '../world/building.js';
import { buildPeople, buildProps, FlowOverlay } from '../world/decor.js';
import { IMM } from '../equipment/imm.js';
import { Conveyor } from '../equipment/conveyor.js';
import { LaserCutter, SheetTower, PressBrake, HydraulicPress, ServoPress, BridgeCrane } from '../equipment/sheetMetal.js';
import { RobotEq, ScaraEq } from '../equipment/robots.js';
import { Rack, StackerCrane, AsrsIO } from '../equipment/asrs.js';
import { AGV, Charger, Shipping, FLEET } from '../equipment/agv.js';
import { AssemblyLoop, Station, Wrapper } from '../equipment/assembly.js';
import { Dryer, Compressor, Chiller, Transformer, CMM } from '../equipment/utilities.js';
import { Emitter } from '../data/store.js';

const TYPES = {
  imm: IMM, conveyor: Conveyor, dryer: Dryer, laser: LaserCutter, tower: SheetTower, pressbrake: PressBrake,
  robot: RobotEq, scara: ScaraEq, hydpress: HydraulicPress, servopress: ServoPress, crane: BridgeCrane,
  rack: Rack, srm: StackerCrane, asrsio: AsrsIO, agv: AGV, forklift: AGV, charger: Charger,
  loop: AssemblyLoop, station: Station, wrapper: Wrapper, cmm: CMM, compressor: Compressor,
  chiller: Chiller, transformer: Transformer,
};

export function buildFactory(scene, onProgress) {
  const equipmentRoot = new THREE.Group();
  equipmentRoot.name = 'Equipment';
  const dynamicRoot = new THREE.Group();
  dynamicRoot.name = 'Dynamic';
  scene.add(equipmentRoot, dynamicRoot);
  const map = new Map();
  const ctx = {
    defs: new Map(EQUIPMENT.map((d) => [d.id, d])),
    equipment: map,
    get: (id) => map.get(id),
    register: (eq) => map.set(eq.id, eq),
    dynamicRoot,
    events: new Emitter(),
    people: [],
  };
  const building = new Building(scene);
  ctx.building = building;
  onProgress?.(0.2, 'Building shell');
  const list = [];
  for (const def of EQUIPMENT) {
    if (def.type === 'picker') continue; // built by its IMM
    const Cls = TYPES[def.type];
    if (!Cls) { console.warn('No builder for', def.type); continue; }
    try {
      const eq = new Cls(def, ctx);
      eq.place();
      equipmentRoot.add(eq.root);
      ctx.register(eq);
      list.push(eq);
    } catch (err) {
      console.error('Failed to build', def.id, err);
    }
  }
  onProgress?.(0.6, 'Equipment');
  scene.updateMatrixWorld(true);
  ctx.shipping = new Shipping(dynamicRoot);
  for (const eq of map.values()) eq.link?.();
  for (const eq of map.values()) eq.finalize();
  const props = buildProps(scene);
  const people = buildPeople(scene);
  ctx.people = people;
  const flow = new FlowOverlay(scene);
  ctx.flow = flow;
  ctx.props = props;
  ctx.fleet = FLEET;
  ctx.equipmentRoot = equipmentRoot;
  onProgress?.(0.85, 'Finishing');
  scene.updateMatrixWorld(true);
  // Footprints for walk-mode collision (static equipment only)
  ctx.obstacles = [];
  for (const eq of map.values()) {
    if (['agv', 'forklift', 'crane', 'picker', 'srm', 'loop'].includes(eq.def.type)) continue;
    const b = new THREE.Box3().setFromObject(eq.root);
    if (!b.isEmpty() && b.max.x - b.min.x < 40) ctx.obstacles.push(b);
  }
  ctx.update = (dt, t) => {
    for (const eq of map.values()) eq.tick(dt, t);
    for (const p of people) p.update(dt);
    flow.update(dt);
  };
  return ctx;
}
