// Master catalog of the plant: layout, equipment master data, made-up technical
// specifications and MES baselines. It is shared by the Excel generator
// (scripts/generate-excel.js) and the browser (3D layout + fallback defaults).
// Units: metres, degrees (rotation about Y). North = -Z, East = +X.

export const PLANT = {
  name: 'NEXUS Plant 01',
  site: 'Riverside Industrial Park',
  product: 'EB-200 Smart Electrical Enclosure',
  building: { minX: -64, maxX: 64, minZ: -40, maxZ: 40, height: 12 },
};

export const CATEGORIES = [
  { key: 'Plastic Injection', icon: 'imm' },
  { key: 'Metal Cutting', icon: 'laser' },
  { key: 'Metal Bending', icon: 'bend' },
  { key: 'Metal Pressing', icon: 'press' },
  { key: 'Industrial Robots', icon: 'robot' },
  { key: 'Conveyors', icon: 'conveyor' },
  { key: 'AS/RS', icon: 'asrs' },
  { key: 'AGV Fleet', icon: 'agv' },
  { key: 'Assembly Line', icon: 'assembly' },
  { key: 'Quality & Inspection', icon: 'quality' },
  { key: 'Packaging & EOL', icon: 'pack' },
  { key: 'Material Handling', icon: 'crane' },
  { key: 'Utilities', icon: 'utility' },
];

export const ZONES = [
  { key: 'Injection Moulding Hall', rect: [-62, -38, -23, -1], color: '#1ba6a6' },
  { key: 'Sheet Metal Shop', rect: [-62, 8, -23, 38], color: '#e0892b' },
  { key: 'Central AS/RS', rect: [-17, -38, 9, 0.5], color: '#3a78d6' },
  { key: 'Assembly Hall', rect: [16, -31, 62, -1], color: '#8a5cf0' },
  { key: 'Quality Lab', rect: [-16, 11, 0, 24], color: '#29b36b' },
  { key: 'Control Room', rect: [-16, 26, 0, 37], color: '#29b36b' },
  { key: 'Shipping', rect: [36, 11, 62, 38], color: '#7b8794' },
  { key: 'Utilities', rect: [16, -38, 62, -32], color: '#d64545' },
  { key: 'Logistics', rect: [-62, 1, 62, 7], color: '#f2c318' },
];

// ---------------------------------------------------------------------------
// Layout helpers
const IMM_X = [-56, -47, -38, -29];
export const IMM_Z = -20;
export const ASRS = {
  aisles: [-13, -9, -5],
  zMin: -36, zMax: -6,
  bays: 22, levels: 9, levelH: 1.12, baseH: 0.35,
  rackDepth: 1.2, aisleWidth: 1.6,
  ioZ: [-5.6, 0.2],
};
export const LOOP = {
  xMin: 21, xMax: 54, zFwd: -22, zRet: -15.5,
  stations: [23.5, 28, 32.5, 37, 41.5, 46, 50.5],
};
export const AISLE = { mainZ: 4, laneOffset: 0.8, westX: -20, eastX: 12, shipX: 44 };

// ---------------------------------------------------------------------------
// Equipment definitions
const defs = [];
let serial = 41000;
function add(d) {
  serial += 17;
  defs.push({
    rot: 0,
    year: 2023,
    serial: `SN-${d.id.replace(/[^A-Z0-9]/g, '')}-${serial}`,
    drawingNo: `DT-${d.id}-001`,
    params: {},
    ...d,
  });
}

// Standard MES baseline builder
function mes(o) {
  return {
    status: 'Running',
    order: 'WO-24-1187',
    part: '',
    availability: 92,
    performance: 90,
    quality: 99,
    targetRate: 60,
    actualRate: 54,
    idealCycle: 60,
    actualCycle: 66,
    good: 380,
    scrap: 4,
    mtbf: 180,
    mttr: 25,
    power: 10,
    energy: 64,
    operator: 'Auto',
    lastMaint: '2026-08-14',
    nextMaint: '2026-10-14',
    battery: '',
    ...o,
  };
}

// ---- Plastic injection --------------------------------------------------
const immPartNames = ['EB-200 Front Cover', 'EB-200 Front Cover', 'EB-200 Gland Plate', 'EB-200 Terminal Carrier'];
const immParts = ['PC-2001', 'PC-2001', 'PC-2014', 'PC-2022'];
IMM_X.forEach((x, i) => {
  const n = i + 1;
  const big = i >= 2;
  const tonnage = big ? 500 : 350;
  add({
    id: `IMM-0${n}`,
    name: `Injection Moulding Machine ${n}`,
    category: 'Plastic Injection', zone: 'Injection Moulding Hall', type: 'imm',
    manufacturer: 'Kraussfeld Plastics', model: `KX-${tonnage} e-Drive`, year: big ? 2024 : 2022,
    pos: [x, IMM_Z], rot: -90,
    params: { scale: big ? 1.12 : 1, picker: `ROB-P0${n}`, conveyor: `CNV-P0${n}`, accent: big ? 0x0e8f9b : 0x13a8a8 },
    specs: [
      ['General', 'Clamping force', tonnage * 10, 'kN'],
      ['General', 'Drive concept', 'All-electric servo', ''],
      ['General', 'Machine weight', big ? 24.5 : 17.8, 't'],
      ['General', 'Footprint (L x W x H)', big ? '9.0 x 2.2 x 2.6' : '8.0 x 2.0 x 2.4', 'm'],
      ['Clamping unit', 'Opening stroke', big ? 750 : 650, 'mm'],
      ['Clamping unit', 'Distance between tie bars', big ? '820 x 820' : '710 x 710', 'mm'],
      ['Clamping unit', 'Platen size', big ? '1180 x 1180' : '1020 x 1020', 'mm'],
      ['Clamping unit', 'Min / max mould height', big ? '350 / 800' : '300 / 700', 'mm'],
      ['Injection unit', 'Screw diameter', big ? 70 : 60, 'mm'],
      ['Injection unit', 'Shot volume', big ? 1150 : 790, 'cm³'],
      ['Injection unit', 'Injection pressure', big ? 1850 : 1980, 'bar'],
      ['Injection unit', 'Injection speed', 280, 'mm/s'],
      ['Injection unit', 'Heating zones', 6, ''],
      ['Electrical', 'Connected load', big ? 145 : 110, 'kW'],
      ['Electrical', 'Heater power', big ? 32 : 25, 'kW'],
      ['Process', 'Material', i < 2 ? 'PC/ABS V0, grey RAL7035' : 'PA6-GF30, black', ''],
      ['Process', 'Mould', `M-${immParts[i]}-${big ? '2' : '4'}K`, ''],
      ['Process', 'Cavities', big ? 2 : 4, ''],
      ['Process', 'Barrel temperature', i < 2 ? 265 : 285, '°C'],
      ['Process', 'Mould temperature', i < 2 ? 70 : 90, '°C'],
      ['Controls', 'Controller', 'KX-Control 7 / OPC UA (EUROMAP 77)', ''],
    ],
    mes: mes({
      part: `${immParts[i]} ${immPartNames[i]}`,
      order: `WO-24-11${80 + n}`,
      availability: [94, 91, 88, 93][i], performance: [92, 89, 91, 87][i], quality: [99.2, 98.6, 99.4, 97.9][i],
      targetRate: big ? 160 : 240, actualRate: big ? [0, 0, 144, 136][i] : [220, 212][i],
      idealCycle: big ? 45 : 60, actualCycle: big ? [0, 0, 49, 52][i] : [65, 68][i],
      good: [1650, 1590, 1085, 1010][i], scrap: [13, 22, 7, 21][i],
      power: big ? 58 : 44, energy: big ? 410 : 330, mtbf: 210, mttr: 32,
      operator: ['J. Novak', 'J. Novak', 'A. Rossi', 'A. Rossi'][i],
    }),
  });
  add({
    id: `ROB-P0${n}`,
    name: `Take-out Robot IMM ${n}`,
    category: 'Industrial Robots', zone: 'Injection Moulding Hall', type: 'picker', parent: `IMM-0${n}`,
    manufacturer: 'Orion Robotics', model: 'LX-3 Linear Picker', year: big ? 2024 : 2022,
    pos: [x, IMM_Z], rot: -90,
    specs: [
      ['General', 'Kinematics', '3-axis Cartesian (servo) + pneumatic wrist', ''],
      ['General', 'Payload', 15, 'kg'],
      ['Strokes', 'Traverse (Z)', 2600, 'mm'],
      ['Strokes', 'Demould (X)', 900, 'mm'],
      ['Strokes', 'Vertical (Y)', 1400, 'mm'],
      ['Performance', 'Max. speed traverse', 4.5, 'm/s'],
      ['Performance', 'Min. take-out time', 0.9, 's'],
      ['Tooling', 'End-of-arm tool', 'Vacuum gripper 4x Ø40 + sprue gripper', ''],
      ['Electrical', 'Supply', '3x400 V / 50 Hz, 3.5 kVA', ''],
      ['Interface', 'IMM interface', 'EUROMAP 67', ''],
    ],
    mes: mes({ part: immParts[i], targetRate: big ? 160 : 240, actualRate: big ? 146 : 222, idealCycle: big ? 45 : 60, actualCycle: big ? 49 : 65, availability: 98, performance: 95, quality: 100, good: [1663, 1612, 1092, 1031][i], scrap: 0, power: 1.8, energy: 12, mtbf: 950, mttr: 15 }),
  });
  add({
    id: `CNV-P0${n}`,
    name: `IMM ${n} Outfeed Conveyor`,
    category: 'Conveyors', zone: 'Injection Moulding Hall', type: 'conveyor',
    manufacturer: 'Transflex', model: 'TF-B400 Belt', year: big ? 2024 : 2022,
    pos: [x + 2.3, -11], rot: 0,
    params: { path: [[x + 2.3, -22.3], [x + 2.3, -0.9]], width: 0.5, height: 0.85, kind: 'belt', bin: true },
    specs: [
      ['General', 'Type', 'Flat belt conveyor, cleated PU belt', ''],
      ['General', 'Length', 20.7, 'm'],
      ['General', 'Belt width', 400, 'mm'],
      ['Drive', 'Motor', '0.55 kW geared motor + VFD', ''],
      ['Drive', 'Belt speed', '5 - 25', 'm/min'],
      ['Options', 'Cooling', 'Part cooling fan tunnel (2 m)', ''],
      ['Options', 'End of line', 'Tote filling station with weight check', ''],
    ],
    mes: mes({ targetRate: 240, actualRate: 220, availability: 99, performance: 97, quality: 100, power: 0.4, energy: 3, good: 1650, scrap: 0, mtbf: 2400, mttr: 20 }),
  });
});

add({
  id: 'DRY-01', name: 'Central Material Dryer & Loader', category: 'Plastic Injection', zone: 'Injection Moulding Hall', type: 'dryer',
  manufacturer: 'Polydry Systems', model: 'PD-800 Central', year: 2022, pos: [-42.5, -35.2], rot: 0,
  params: { targets: IMM_X.map((x, i) => [x, IMM_Z + 2.7 * (i >= 2 ? 1.12 : 1), 3.1 * (i >= 2 ? 1.12 : 1)]) },
  specs: [
    ['General', 'Dryer type', 'Desiccant wheel dry-air dryer', ''],
    ['General', 'Drying hoppers', '4 x 300 L', ''],
    ['Performance', 'Throughput', 280, 'kg/h'],
    ['Performance', 'Dew point', -40, '°C'],
    ['Performance', 'Drying temperature', '80 - 120', '°C'],
    ['Conveying', 'Vacuum loaders', 8, ''],
    ['Conveying', 'Pipe diameter', 50, 'mm'],
    ['Electrical', 'Installed power', 38, 'kW'],
  ],
  mes: mes({ part: 'PC/ABS + PA6-GF30 granulate', targetRate: 280, actualRate: 236, idealCycle: 1, actualCycle: 1, availability: 99, performance: 84, quality: 100, power: 21, energy: 160, good: 1890, scrap: 0, mtbf: 1500, mttr: 45 }),
});

// ---- Sheet metal --------------------------------------------------------
[[1, 15], [2, 31]].forEach(([n, z]) => {
  add({
    id: `LAS-0${n}`, name: `Fiber Laser Cutter ${n}`, category: 'Metal Cutting', zone: 'Sheet Metal Shop', type: 'laser',
    manufacturer: 'Lumatek', model: n === 1 ? 'FiberCut 3015 / 6 kW' : 'FiberCut 3015 / 12 kW', year: n === 1 ? 2021 : 2024,
    pos: [-49, z], rot: 0, params: { tower: `STW-0${n}` },
    specs: [
      ['General', 'Working area', '3050 x 1525', 'mm'],
      ['General', 'Laser source', n === 1 ? 'Fiber 6 kW' : 'Fiber 12 kW', ''],
      ['General', 'Machine weight', 11.2, 't'],
      ['Axes', 'Positioning speed', 169, 'm/min'],
      ['Axes', 'Acceleration', 2.8, 'g'],
      ['Axes', 'Positioning accuracy', '±0.03', 'mm'],
      ['Capacity', 'Mild steel max.', n === 1 ? 25 : 30, 'mm'],
      ['Capacity', 'Stainless steel max.', n === 1 ? 20 : 40, 'mm'],
      ['Capacity', 'Aluminium max.', n === 1 ? 15 : 30, 'mm'],
      ['Automation', 'Pallet changer', 'Shuttle table, 12 s exchange', ''],
      ['Automation', 'Assist gas', 'N₂ / O₂ / compressed air', ''],
      ['Electrical', 'Connected load', n === 1 ? 38 : 62, 'kVA'],
      ['Process', 'Current material', 'DC01 1.5 mm galvanised', ''],
    ],
    mes: mes({ part: 'SM-3105 Housing blank', order: 'WO-24-1191', targetRate: 36, actualRate: n === 1 ? 32 : 34, idealCycle: 100, actualCycle: n === 1 ? 112 : 106, availability: n === 1 ? 89 : 95, performance: n === 1 ? 88 : 93, quality: 99.5, good: n === 1 ? 246 : 262, scrap: n === 1 ? 2 : 1, power: n === 1 ? 26 : 41, energy: n === 1 ? 190 : 300, operator: 'M. Keller' }),
  });
  add({
    id: `STW-0${n}`, name: `Sheet Storage Tower ${n}`, category: 'Metal Cutting', zone: 'Sheet Metal Shop', type: 'tower',
    manufacturer: 'Lumatek', model: 'LiftMaster Tower 3015-12', year: n === 1 ? 2021 : 2024, pos: [-59, z], rot: 0,
    specs: [
      ['General', 'Drawers', 12, ''],
      ['General', 'Load per drawer', 3000, 'kg'],
      ['General', 'Tower height', 5.2, 'm'],
      ['Loader', 'Loading type', 'Suction frame, 28 vacuum cups', ''],
      ['Loader', 'Load / unload time', 65, 's'],
      ['Stock', 'Current stock', '2.1 t DC01 1.5 mm', ''],
    ],
    mes: mes({ targetRate: 36, actualRate: 33, idealCycle: 100, actualCycle: 108, availability: 99, performance: 92, quality: 100, good: 250, scrap: 0, power: 4, energy: 18 }),
  });
});

[[1, 14, 0, 16.4], [2, 32, 180, 29.6]].forEach(([n, z, rot, rz]) => {
  add({
    id: `PBR-0${n}`, name: `CNC Press Brake ${n}`, category: 'Metal Bending', zone: 'Sheet Metal Shop', type: 'pressbrake',
    manufacturer: 'Bendmaster', model: 'HB-2203 Hybrid', year: 2023, pos: [-39.5, z], rot, params: { robot: `ROB-B0${n}` },
    specs: [
      ['General', 'Press force', 2200, 'kN'],
      ['General', 'Bending length', 3100, 'mm'],
      ['General', 'Distance between side frames', 2700, 'mm'],
      ['Axes', 'Controlled axes', 'Y1, Y2, X, R, Z1, Z2 + crowning', ''],
      ['Axes', 'Ram approach speed', 200, 'mm/s'],
      ['Axes', 'Working speed', 12, 'mm/s'],
      ['Axes', 'Repeatability', '±0.005', 'mm'],
      ['Tooling', 'Tool clamping', 'Hydraulic, self-seating', ''],
      ['Tooling', 'Angle measurement', 'Laser angle sensor, both sides', ''],
      ['Electrical', 'Drive', 'Hybrid servo-hydraulic, 2x 11 kW', ''],
    ],
    mes: mes({ part: 'SM-3105 Housing (bent)', order: 'WO-24-1191', targetRate: 45, actualRate: n === 1 ? 40 : 38, idealCycle: 80, actualCycle: n === 1 ? 90 : 95, availability: n === 1 ? 93 : 90, performance: n === 1 ? 89 : 84, quality: 99.1, good: n === 1 ? 312 : 288, scrap: 3, power: 9, energy: 62 }),
  });
  add({
    id: `ROB-B0${n}`, name: `Bending Robot ${n}`, category: 'Industrial Robots', zone: 'Sheet Metal Shop', type: 'robot',
    manufacturer: 'Orion Robotics', model: 'OR-165/2.7', year: 2023, pos: [-39.5, rz], rot: rot === 0 ? 180 : 0,
    params: { scale: 1.3, color: 0xf28c28, tool: 'vacuum', pedestal: 0.5, program: 'bending', machine: `PBR-0${n}` },
    specs: robotSpecs(165, 2700, 6, 'Vacuum gripper frame with regrip station'),
    mes: mes({ part: 'SM-3105', targetRate: 45, actualRate: 40, idealCycle: 80, actualCycle: 90, availability: 97, performance: 89, quality: 100, good: 312, scrap: 0, power: 5.5, energy: 35, mtbf: 3200, mttr: 40 }),
  });
});

add({
  id: 'HPR-01', name: 'Hydraulic Press 400 t', category: 'Metal Pressing', zone: 'Sheet Metal Shop', type: 'hydpress',
  manufacturer: 'Hydrotek', model: 'HP-400 4-Column', year: 2020, pos: [-29, 13.4], rot: 0, params: { robot: 'ROB-H01' },
  specs: [
    ['General', 'Nominal force', 4000, 'kN'],
    ['General', 'Construction', '4-column, double acting', ''],
    ['General', 'Bolster area', '1600 x 1200', 'mm'],
    ['General', 'Daylight', 1400, 'mm'],
    ['General', 'Stroke', 800, 'mm'],
    ['Speeds', 'Rapid advance', 300, 'mm/s'],
    ['Speeds', 'Pressing', 25, 'mm/s'],
    ['Speeds', 'Return', 280, 'mm/s'],
    ['Hydraulics', 'Pump power', 55, 'kW'],
    ['Hydraulics', 'Max. pressure', 280, 'bar'],
    ['Safety', 'Guarding', 'Light curtains cat. 4 + interlocked rear doors', ''],
    ['Process', 'Operation', 'Embossing + PEM nut clinching', ''],
  ],
  mes: mes({ part: 'SM-3105 Housing (finished)', targetRate: 90, actualRate: 78, idealCycle: 40, actualCycle: 46, availability: 91, performance: 87, quality: 99.6, good: 590, scrap: 2, power: 31, energy: 220, operator: 'M. Keller' }),
});
add({
  id: 'ROB-H01', name: 'Press Tending Robot', category: 'Industrial Robots', zone: 'Sheet Metal Shop', type: 'robot',
  manufacturer: 'Orion Robotics', model: 'OR-70/2.1', year: 2020, pos: [-29, 16.0], rot: 180,
  params: { scale: 1.45, color: 0xf28c28, tool: 'vacuum', pedestal: 0.4, program: 'press', machine: 'HPR-01' },
  specs: robotSpecs(70, 2100, 6, 'Twin vacuum gripper'),
  mes: mes({ targetRate: 90, actualRate: 79, idealCycle: 40, actualCycle: 45, availability: 98, performance: 88, quality: 100, power: 3.2, energy: 20, good: 596, scrap: 0, mtbf: 4100, mttr: 35 }),
});
add({
  id: 'SPR-01', name: 'Servo Press Line 250 t', category: 'Metal Pressing', zone: 'Sheet Metal Shop', type: 'servopress',
  manufacturer: 'Servomatic', model: 'SP-250 + CoilPro 600', year: 2024, pos: [-28.5, 32.5], rot: 0,
  specs: [
    ['General', 'Nominal force', 2500, 'kN'],
    ['General', 'Drive', 'Direct servo drive, 2x 180 kNm', ''],
    ['General', 'Strokes per minute', '10 - 70', 'spm'],
    ['General', 'Bolster area', '2400 x 1100', 'mm'],
    ['Coil line', 'Coil weight max.', 5, 't'],
    ['Coil line', 'Coil width max.', 600, 'mm'],
    ['Coil line', 'Straightener rolls', '7 + 2 pinch', ''],
    ['Coil line', 'Feed accuracy', '±0.05', 'mm'],
    ['Tooling', 'Die', 'Progressive die PD-2240 (DIN rail + brackets)', ''],
    ['Electrical', 'Connected load', 160, 'kVA'],
  ],
  mes: mes({ part: 'SM-2240 DIN rail 35x7.5', targetRate: 1800, actualRate: 1650, idealCycle: 2, actualCycle: 2.2, availability: 90, performance: 92, quality: 99.8, good: 12870, scrap: 26, power: 48, energy: 350, operator: 'S. Demir' }),
});
add({
  id: 'CNV-M01', name: 'Metal Parts Outfeed Conveyor', category: 'Conveyors', zone: 'Sheet Metal Shop', type: 'conveyor',
  manufacturer: 'Transflex', model: 'TF-R600 Roller', year: 2023, pos: [-24.5, 12], rot: 0,
  params: { path: [[-26.6, 16.8], [-24.3, 16.8], [-24.3, 8.4]], width: 0.9, height: 0.75, kind: 'roller', bin: true },
  specs: [
    ['General', 'Type', 'Motor-driven roller conveyor (24 V MDR)', ''],
    ['General', 'Length', 10.7, 'm'],
    ['General', 'Roller pitch', 100, 'mm'],
    ['Drive', 'Zones', 11, ''],
    ['Drive', 'Speed', 18, 'm/min'],
    ['Controls', 'Logic', 'Zero-pressure accumulation', ''],
  ],
  mes: mes({ targetRate: 90, actualRate: 78, availability: 99, performance: 96, quality: 100, power: 0.6, energy: 4, good: 590, scrap: 0, mtbf: 3000, mttr: 15 }),
});
add({
  id: 'BCR-01', name: 'Overhead Bridge Crane 10 t', category: 'Material Handling', zone: 'Sheet Metal Shop', type: 'crane',
  manufacturer: 'Liftcore', model: 'LC-D10 Double Girder', year: 2019, pos: [-42.5, 23], rot: 0,
  params: { xMin: -61, xMax: -24, zMin: 8.6, zMax: 37.4, height: 9.4 },
  specs: [
    ['General', 'Capacity', 10, 't'],
    ['General', 'Span', 28.8, 'm'],
    ['General', 'Hook height', 8.2, 'm'],
    ['Speeds', 'Long travel', '5 - 40', 'm/min'],
    ['Speeds', 'Cross travel', '3 - 20', 'm/min'],
    ['Speeds', 'Hoist', '0.8 - 5', 'm/min'],
    ['Controls', 'Operation', 'Radio remote + anti-sway', ''],
  ],
  mes: mes({ status: 'Idle', targetRate: 6, actualRate: 3, idealCycle: 600, actualCycle: 900, availability: 99, performance: 60, quality: 100, power: 2, energy: 9, good: 18, scrap: 0, mtbf: 5000, mttr: 60 }),
});

// ---- AS/RS --------------------------------------------------------------
add({
  id: 'RCK-01', name: 'AS/RS High-Bay Rack', category: 'AS/RS', zone: 'Central AS/RS', type: 'rack',
  manufacturer: 'Stakra', model: 'HBR-3A Mini-load', year: 2022, pos: [-9, -21], rot: 0,
  specs: [
    ['General', 'Aisles', 3, ''],
    ['General', 'Storage locations', ASRS.aisles.length * 2 * ASRS.bays * ASRS.levels, ''],
    ['General', 'Rack height', 10.8, 'm'],
    ['General', 'Rack length', 30, 'm'],
    ['Loads', 'Load unit', 'KLT tote 1000 x 800 x 520 mm', ''],
    ['Loads', 'Max. load per location', 250, 'kg'],
    ['Structure', 'Construction', 'Roll-formed uprights, silo-type, seismic zone 1', ''],
    ['Structure', 'Fire protection', 'In-rack sprinklers, every 3rd level', ''],
  ],
  mes: mes({ part: 'Occupancy (%)', targetRate: 0, actualRate: 0, idealCycle: 0, actualCycle: 0, availability: 100, performance: 100, quality: 100, good: 0, scrap: 0, power: 0, energy: 0 }),
});
ASRS.aisles.forEach((x, i) => {
  const n = i + 1;
  add({
    id: `SRM-0${n}`, name: `Stacker Crane Aisle ${n}`, category: 'AS/RS', zone: 'Central AS/RS', type: 'srm',
    manufacturer: 'Stakra', model: 'SRM-S Single Mast', year: 2022, pos: [x, -21], rot: 0, params: { aisle: i, mode: ['in', 'in', 'out'][i] },
    specs: [
      ['General', 'Mast type', 'Single mast, aluminium', ''],
      ['General', 'Load handling', 'Telescopic fork, double deep', ''],
      ['Speeds', 'Travel', 4, 'm/s'],
      ['Speeds', 'Lift', 1.5, 'm/s'],
      ['Speeds', 'Acceleration', 2, 'm/s²'],
      ['Performance', 'Double cycles', 110, '/h'],
      ['Electrical', 'Drives', 'Energy recovery regenerative drives', ''],
      ['Safety', 'Positioning', 'Laser distance + barcode positioning', ''],
    ],
    mes: mes({ part: ['Inbound: plastic parts', 'Inbound: metal housings', 'Outbound: assembly kits'][i], targetRate: 110, actualRate: [86, 71, 95][i], idealCycle: 33, actualCycle: [42, 51, 38][i], availability: [99, 97, 98][i], performance: [78, 65, 86][i], quality: 100, good: [620, 510, 690][i], scrap: 0, power: 7, energy: 44, mtbf: 1800, mttr: 30 }),
  });
});
add({
  id: 'CNV-A01', name: 'AS/RS I/O Conveyor System', category: 'Conveyors', zone: 'Central AS/RS', type: 'asrsio',
  manufacturer: 'Transflex', model: 'TF-C1000 Chain/Roller', year: 2022, pos: [-9, -2.7], rot: 0,
  specs: [
    ['General', 'Lanes', 3, ''],
    ['General', 'Type', 'Driven roller conveyor with P&D stations', ''],
    ['General', 'Load', 'KLT totes up to 250 kg', ''],
    ['Checks', 'Contour check', 'Light grid + weight check', ''],
    ['Drive', 'Speed', 30, 'm/min'],
  ],
  mes: mes({ targetRate: 300, actualRate: 252, availability: 99, performance: 92, quality: 100, power: 1.5, energy: 10, good: 1820, scrap: 0, mtbf: 2600, mttr: 20 }),
});

// ---- AGVs ----------------------------------------------------------------
const agvMissions = ['Plastic parts → AS/RS', 'Metal parts → AS/RS', 'Kits AS/RS → Assembly', 'Kits AS/RS → Assembly', 'Empty totes → Moulding', 'Pallets EOL → Shipping'];
const agvBatt = [82, 67, 91, 54, 76, 88];
for (let i = 0; i < 6; i++) {
  const fork = i === 5;
  add({
    id: `AGV-0${i + 1}`, name: fork ? 'Autonomous Forklift AGV 6' : `Tote AGV ${i + 1}`, category: 'AGV Fleet', zone: 'Logistics', type: fork ? 'forklift' : 'agv',
    manufacturer: 'Movix', model: fork ? 'FX-1500 Autonomous Forklift' : 'MX-1000 Roller-top AMR', year: 2024,
    pos: [-40 + i * 12, 4], rot: 0, params: { mission: i },
    specs: fork ? [
      ['General', 'Type', 'Counterbalanced autonomous forklift', ''],
      ['General', 'Payload', 1500, 'kg'],
      ['General', 'Lift height', 3000, 'mm'],
      ['Navigation', 'Method', 'Natural feature navigation + reflectors', ''],
      ['Navigation', 'Positioning accuracy', '±10', 'mm'],
      ['Performance', 'Speed (loaded / empty)', '1.5 / 2.0', 'm/s'],
      ['Battery', 'Type', 'Li-ion 48 V / 420 Ah', ''],
      ['Safety', 'Sensors', '2x safety laser scanner, 3D camera, blue spot', ''],
    ] : [
      ['General', 'Type', 'Autonomous mobile robot, roller top', ''],
      ['General', 'Payload', 1000, 'kg'],
      ['General', 'Dimensions', '1600 x 1000 x 420', 'mm'],
      ['Navigation', 'Method', 'Lidar SLAM + QR floor codes', ''],
      ['Navigation', 'Positioning accuracy', '±5', 'mm'],
      ['Performance', 'Max. speed', 2.0, 'm/s'],
      ['Battery', 'Type', 'LiFePO4 48 V / 105 Ah', ''],
      ['Battery', 'Opportunity charging', 'Automatic, 300 A', ''],
      ['Safety', 'Sensors', '2x safety laser scanner (PL d), bumper, e-stop', ''],
      ['Comms', 'Fleet manager', 'Movix FleetOS via Wi-Fi 6 / VDA 5050', ''],
    ],
    mes: mes({ part: agvMissions[i], order: 'Transport', targetRate: fork ? 12 : 20, actualRate: fork ? 10 : [17, 15, 18, 16, 13][i], idealCycle: fork ? 300 : 180, actualCycle: fork ? 360 : [212, 240, 200, 225, 277][i], availability: [96, 93, 97, 94, 95, 98][i], performance: [86, 75, 90, 80, 65, 83][i], quality: 100, good: [124, 108, 131, 117, 95, 72][i], scrap: 0, power: 1.2, energy: 9, battery: agvBatt[i], mtbf: 900, mttr: 20 }),
  });
}
[1, 4, 7].forEach((x, i) => add({
  id: `CHG-0${i + 1}`, name: `AGV Charging Station ${i + 1}`, category: 'AGV Fleet', zone: 'Logistics', type: 'charger',
  manufacturer: 'Movix', model: 'MC-300 Floor Charger', year: 2024, pos: [x, 9.6], rot: 0,
  specs: [
    ['General', 'Charging current', 300, 'A'],
    ['General', 'Output voltage', 48, 'V DC'],
    ['General', 'Contact type', 'Floor contacts, auto-docking', ''],
    ['Electrical', 'Input', '3x400 V, 18 kW', ''],
  ],
  mes: mes({ status: 'Idle', targetRate: 6, actualRate: 4, idealCycle: 900, actualCycle: 1100, availability: 100, performance: 70, quality: 100, power: 0.2, energy: 64, good: 22, scrap: 0, mtbf: 8000, mttr: 30 }),
}));

// ---- Assembly -----------------------------------------------------------
add({
  id: 'CNV-L01', name: 'Assembly Pallet Transfer Loop', category: 'Conveyors', zone: 'Assembly Hall', type: 'loop',
  manufacturer: 'Transflex', model: 'TS-2 Twin-belt Transfer', year: 2024, pos: [37.5, -18.75], rot: 0,
  specs: [
    ['General', 'Type', 'Twin-belt workpiece pallet transfer system', ''],
    ['General', 'Loop length', 79, 'm'],
    ['General', 'Workpiece pallets', 16, ''],
    ['General', 'Pallet size', '640 x 480', 'mm'],
    ['Drive', 'Speed', 18, 'm/min'],
    ['Controls', 'Tracking', 'RFID on each pallet (13.56 MHz)', ''],
    ['Controls', 'Stoppers', 'Pneumatic stop + lift-and-locate at each station', ''],
  ],
  mes: mes({ part: 'EB-200', targetRate: 72, actualRate: 64, idealCycle: 50, actualCycle: 56, availability: 98, performance: 89, quality: 100, power: 2.2, energy: 15, good: 470, scrap: 0, mtbf: 2200, mttr: 25 }),
});
add({
  id: 'CNV-L03', name: 'Kit Infeed Conveyor', category: 'Conveyors', zone: 'Assembly Hall', type: 'conveyor',
  manufacturer: 'Transflex', model: 'TF-R600 Roller', year: 2024, pos: [18.8, -12], rot: 0,
  params: { path: [[18.8, 0.6], [18.8, -25.4], [22.6, -25.4]], width: 0.9, height: 0.75, kind: 'roller', spacing: 1.2 },
  specs: [
    ['General', 'Type', 'MDR roller conveyor, tote buffer', ''],
    ['General', 'Length', 27.8, 'm'],
    ['General', 'Buffer capacity', 18, 'totes'],
    ['Drive', 'Speed', 24, 'm/min'],
  ],
  mes: mes({ targetRate: 72, actualRate: 64, availability: 99, performance: 89, quality: 100, power: 0.8, energy: 5, good: 150, scrap: 0, mtbf: 2600, mttr: 20 }),
});
add({
  id: 'CNV-L02', name: 'Carton Exit Conveyor', category: 'Conveyors', zone: 'Assembly Hall', type: 'conveyor',
  manufacturer: 'Transflex', model: 'TF-B600 Belt', year: 2024, pos: [55, -20], rot: 0,
  params: { path: [[50.5, -25.7], [59.2, -25.7], [59.2, -10.2]], width: 0.7, height: 0.8, kind: 'belt', spacing: 0.75 },
  specs: [
    ['General', 'Type', 'Belt conveyor with 90° transfer', ''],
    ['General', 'Length', 26.2, 'm'],
    ['Drive', 'Speed', 20, 'm/min'],
    ['Options', 'Carton check', 'Weight + label scanner', ''],
  ],
  mes: mes({ targetRate: 72, actualRate: 63, availability: 99, performance: 88, quality: 100, power: 0.7, energy: 5, good: 462, scrap: 0, mtbf: 2600, mttr: 20 }),
});

const stationDefs = [
  { name: 'Housing Load', kind: 'load', robot: 'ROB-A01' },
  { name: 'DIN Rail & Component Insertion', kind: 'scara', robot: 'ROB-A02' },
  { name: 'Front Cover Placement', kind: 'cover', robot: 'ROB-A03' },
  { name: 'Automatic Screwdriving', kind: 'screw' },
  { name: 'Vision Inspection', kind: 'vision' },
  { name: 'Laser Marking & Labelling', kind: 'label', robot: 'COB-01' },
  { name: 'Unload & Cartoning', kind: 'unload', robot: 'ROB-A04' },
];
stationDefs.forEach((s, i) => {
  const n = i + 1;
  const x = LOOP.stations[i];
  add({
    id: `ASM-0${n}`, name: `Station ${n} – ${s.name}`, category: s.kind === 'vision' ? 'Quality & Inspection' : 'Assembly Line', zone: 'Assembly Hall', type: 'station',
    manufacturer: s.kind === 'vision' ? 'Optivis' : 'NEXUS Automation (in-house)', model: s.kind === 'vision' ? 'OV-Tunnel 4 Cam' : `AS-${200 + n} Cell`, year: 2024,
    pos: [x, LOOP.zFwd], rot: 0, params: { kind: s.kind, index: i, robot: s.robot },
    specs: stationSpecs(s.kind),
    mes: mes({ part: 'EB-200', order: 'WO-24-1204', targetRate: 72, actualRate: [66, 65, 64, 63, 64, 63, 62][i], idealCycle: 50, actualCycle: [54, 55, 56, 57, 56, 57, 58][i], availability: [98, 96, 97, 93, 99, 95, 97][i], performance: [92, 90, 89, 87, 89, 88, 86][i], quality: [100, 99.6, 99.8, 99.1, 98.7, 99.9, 100][i], good: [472, 468, 465, 459, 453, 452, 450][i], scrap: [0, 2, 1, 4, 6, 1, 0][i], power: [4, 3, 4, 2.5, 1.2, 1.8, 4.5][i], energy: [28, 20, 27, 18, 8, 12, 31][i], operator: i === 5 ? 'L. Chen' : 'Auto' }),
  });
  if (s.robot) {
    const scara = s.kind === 'scara';
    const cobot = s.kind === 'label';
    add({
      id: s.robot, name: `${cobot ? 'Collaborative Robot' : scara ? 'SCARA Robot' : 'Assembly Robot'} – S${n}`, category: 'Industrial Robots', zone: 'Assembly Hall',
      type: scara ? 'scara' : 'robot', parent: `ASM-0${n}`,
      manufacturer: cobot ? 'Nimbus Cobotics' : 'Orion Robotics', model: cobot ? 'NC-10 Cobot' : scara ? 'SR-6/850 SCARA' : 'OR-20/1.8',
      year: 2024, pos: [x, LOOP.zFwd - (scara ? 0.75 : cobot ? 1.5 : 1.9)], rot: 0,
      params: cobot ? { scale: 0.95, color: 0xdfe6ee, accent: 0x3aa0ff, tool: 'labeler', pedestal: 0.62, program: s.kind }
        : scara ? { program: s.kind } : { scale: 1.15, color: 0xf28c28, tool: s.kind === 'unload' ? 'gripper' : s.kind === 'cover' ? 'vacuum' : 'gripper', pedestal: 0.55, program: s.kind },
      specs: scara ? [
        ['General', 'Kinematics', '4-axis SCARA', ''],
        ['General', 'Payload', 6, 'kg'],
        ['General', 'Reach', 850, 'mm'],
        ['Performance', 'Standard cycle', 0.36, 's'],
        ['Performance', 'Repeatability', '±0.01', 'mm'],
        ['Tooling', 'End effector', 'Servo gripper + vision-guided pick', ''],
      ] : cobot ? [
        ['General', 'Kinematics', '6-axis collaborative', ''],
        ['General', 'Payload', 10, 'kg'],
        ['General', 'Reach', 1300, 'mm'],
        ['Performance', 'Repeatability', '±0.03', 'mm'],
        ['Safety', 'Collaborative mode', 'Power & force limiting, ISO/TS 15066', ''],
        ['Tooling', 'End effector', 'Label applicator + scanner', ''],
      ] : robotSpecs(20, 1800, 6, s.kind === 'cover' ? 'Vacuum gripper for cover' : 'Servo parallel gripper'),
      mes: mes({ part: 'EB-200', targetRate: 72, actualRate: 64, idealCycle: 50, actualCycle: 56, availability: 99, performance: 90, quality: 100, power: cobot ? 0.4 : 1.6, energy: cobot ? 3 : 11, good: 468, scrap: 0, mtbf: 4000, mttr: 30 }),
    });
  }
});

add({
  id: 'PAL-01', name: 'Palletizing Robot', category: 'Packaging & EOL', zone: 'Assembly Hall', type: 'robot',
  manufacturer: 'Orion Robotics', model: 'OR-P180 Palletizer', year: 2024, pos: [57.2, -8.0], rot: 0,
  params: { scale: 1.7, color: 0xf2c318, tool: 'clamp', pedestal: 0.35, program: 'palletize', palletizer: true },
  specs: [
    ['General', 'Kinematics', '4-axis palletizing robot', ''],
    ['General', 'Payload', 180, 'kg'],
    ['General', 'Reach', 3150, 'mm'],
    ['Performance', 'Cycles', 1200, '/h'],
    ['Pattern', 'Pallet pattern', '4 cartons/layer, 3 layers, interlocked', ''],
    ['Tooling', 'Gripper', 'Clamp gripper with fork fingers', ''],
  ],
  mes: mes({ part: 'EB-200 carton (1 pc)', targetRate: 72, actualRate: 62, idealCycle: 50, actualCycle: 58, availability: 99, performance: 86, quality: 100, power: 3.4, energy: 22, good: 450, scrap: 0, mtbf: 5200, mttr: 30 }),
});
add({
  id: 'SWR-01', name: 'Turntable Stretch Wrapper', category: 'Packaging & EOL', zone: 'Assembly Hall', type: 'wrapper',
  manufacturer: 'Wrapline', model: 'WL-T2000', year: 2024, pos: [56.2, -5.4], rot: 0,
  specs: [
    ['General', 'Type', 'Automatic turntable stretch wrapper', ''],
    ['General', 'Turntable diameter', 1650, 'mm'],
    ['General', 'Max. load', 2000, 'kg'],
    ['Performance', 'Rotation speed', '4 - 12', 'rpm'],
    ['Film', 'Pre-stretch', 250, '%'],
    ['Film', 'Film width', 500, 'mm'],
  ],
  mes: mes({ part: 'EB-200 pallet (12 pcs)', targetRate: 6, actualRate: 5.2, idealCycle: 600, actualCycle: 690, availability: 99, performance: 87, quality: 100, power: 1.1, energy: 6, good: 37, scrap: 0, mtbf: 6000, mttr: 25 }),
});

// ---- Quality ------------------------------------------------------------
add({
  id: 'CMM-01', name: 'Coordinate Measuring Machine', category: 'Quality & Inspection', zone: 'Quality Lab', type: 'cmm',
  manufacturer: 'Metrios', model: 'Accura 12.10.8', year: 2023, pos: [-8, 17.5], rot: 0,
  specs: [
    ['General', 'Type', 'Bridge-type CMM, granite table', ''],
    ['General', 'Measuring range', '1200 x 1000 x 800', 'mm'],
    ['Accuracy', 'MPE_E', '1.5 + L/333', 'µm'],
    ['Probe', 'Probe head', 'Indexing head + scanning probe', ''],
    ['Environment', 'Temperature', '20 ± 1', '°C'],
    ['Software', 'Metrology software', 'MetriosCAD 12 (Q-DAS export)', ''],
  ],
  mes: mes({ part: 'First article: SM-3105 / PC-2001', targetRate: 4, actualRate: 3, idealCycle: 900, actualCycle: 1200, availability: 97, performance: 75, quality: 100, power: 1.5, energy: 10, good: 22, scrap: 0, operator: 'P. Laine' }),
});

// ---- Utilities ----------------------------------------------------------
[[1, 21], [2, 26]].forEach(([n, x]) => add({
  id: `CMP-0${n}`, name: `Screw Air Compressor ${n}`, category: 'Utilities', zone: 'Utilities', type: 'compressor',
  manufacturer: 'Aerodyne', model: 'AD-110 VSD', year: 2021, pos: [x, -35.6], rot: 0,
  specs: [
    ['General', 'Type', 'Oil-injected rotary screw, variable speed', ''],
    ['General', 'Motor power', 110, 'kW'],
    ['Performance', 'Free air delivery', '4.2 - 19.8', 'm³/min'],
    ['Performance', 'Working pressure', 7.5, 'bar'],
    ['Performance', 'Specific power', 5.9, 'kW/(m³/min)'],
    ['Heat recovery', 'Recoverable heat', 88, 'kW'],
    ['Noise', 'Sound level', 69, 'dB(A)'],
  ],
  mes: mes({ status: n === 1 ? 'Running' : 'Idle', part: 'Compressed air', targetRate: 19.8, actualRate: n === 1 ? 14.6 : 0, idealCycle: 1, actualCycle: 1, availability: 99, performance: 74, quality: 100, power: n === 1 ? 82 : 3, energy: n === 1 ? 610 : 30, good: 0, scrap: 0, mtbf: 8000, mttr: 90 }),
}));
add({
  id: 'CHL-01', name: 'Process Water Chiller', category: 'Utilities', zone: 'Utilities', type: 'chiller',
  manufacturer: 'Frigotherm', model: 'FT-420 Free-cooling', year: 2022, pos: [33.5, -35.4], rot: 0,
  specs: [
    ['General', 'Cooling capacity', 420, 'kW'],
    ['General', 'Refrigerant', 'R1234ze', ''],
    ['Performance', 'Supply / return', '12 / 17', '°C'],
    ['Performance', 'EER', 3.9, ''],
    ['Performance', 'Free-cooling', 'Below 8 °C ambient', ''],
    ['Hydraulics', 'Flow rate', 72, 'm³/h'],
  ],
  mes: mes({ part: 'Process water 12 °C', targetRate: 420, actualRate: 305, idealCycle: 1, actualCycle: 1, availability: 100, performance: 73, quality: 100, power: 78, energy: 560, good: 0, scrap: 0, mtbf: 9000, mttr: 120 }),
});
add({
  id: 'TRF-01', name: 'Transformer & MV Switchgear', category: 'Utilities', zone: 'Utilities', type: 'transformer',
  manufacturer: 'Voltara', model: 'VT-2500 Cast Resin', year: 2019, pos: [42, -35.4], rot: 0,
  specs: [
    ['General', 'Rated power', 2500, 'kVA'],
    ['General', 'Primary / secondary', '20 kV / 400 V', ''],
    ['General', 'Type', 'Cast resin dry type, AN/AF', ''],
    ['Protection', 'Switchgear', 'SF6-free MV RMU + ACB 4000 A', ''],
    ['Monitoring', 'Power quality', 'Class A analyser, THD monitoring', ''],
  ],
  mes: mes({ part: 'Plant load (kW)', targetRate: 2500, actualRate: 1320, idealCycle: 1, actualCycle: 1, availability: 100, performance: 53, quality: 100, power: 1320, energy: 9800, good: 0, scrap: 0, mtbf: 50000, mttr: 240 }),
});

function robotSpecs(payload, reach, axes, tool) {
  return [
    ['General', 'Kinematics', `${axes}-axis articulated`, ''],
    ['General', 'Payload', payload, 'kg'],
    ['General', 'Max. reach', reach, 'mm'],
    ['General', 'Repeatability', payload > 100 ? '±0.05' : '±0.02', 'mm'],
    ['General', 'Robot mass', Math.round(payload * 6.2 + 120), 'kg'],
    ['Axis speeds', 'J1 / J2 / J3', payload > 100 ? '110 / 110 / 120' : '200 / 200 / 220', '°/s'],
    ['Axis speeds', 'J4 / J5 / J6', payload > 100 ? '170 / 170 / 260' : '410 / 410 / 610', '°/s'],
    ['Controller', 'Controller', 'OC-5 with SafeMove zones', ''],
    ['Tooling', 'End effector', tool, ''],
    ['Electrical', 'Power consumption (avg.)', payload > 100 ? 4.8 : 1.5, 'kW'],
  ];
}

function stationSpecs(kind) {
  const common = [
    ['General', 'Station pitch', 4500, 'mm'],
    ['General', 'Guarding', 'Aluminium profile + polycarbonate, interlocked doors', ''],
    ['Controls', 'PLC', 'Safety PLC, PROFINET, OPC UA to MES', ''],
    ['Controls', 'Traceability', 'RFID read/write + DMC scan', ''],
  ];
  const map = {
    load: [['Process', 'Operation', 'Load steel housing onto pallet, position check', ''], ['Process', 'Feeding', 'Kit tote from AS/RS via AGV', '']],
    scara: [['Process', 'Operation', 'Insert DIN rail + 12 terminal blocks', ''], ['Process', 'Vision', '2D camera for pick guidance', '']],
    cover: [['Process', 'Operation', 'Place PC/ABS front cover + gasket', ''], ['Process', 'Force control', 'Press-in force 150 N ± 10 %', '']],
    screw: [['Process', 'Operation', '4x M4 screws, torque/angle controlled', ''], ['Process', 'Spindles', '4x EC spindle, 0.5 - 6 Nm', ''], ['Process', 'Feeding', 'Blow-feed screw presenter', '']],
    vision: [['Process', 'Operation', '100 % visual inspection: gasket, screws, label, scratches', ''], ['Hardware', 'Cameras', '4x 12 MP mono + 1x 3D profile sensor', ''], ['Hardware', 'Illumination', 'Dome + ring lights, strobed', ''], ['Software', 'Algorithm', 'Deep-learning defect classifier v3.2', '']],
    label: [['Process', 'Operation', 'Fiber laser DMC marking + rating label', ''], ['Hardware', 'Laser', '30 W fiber marking laser', '']],
    unload: [['Process', 'Operation', 'Unload finished enclosure into carton', ''], ['Process', 'Carton', 'Auto-erected RSC carton', '']],
  };
  return [...(map[kind] || []), ...common];
}

export const EQUIPMENT = defs;

// ---------------------------------------------------------------------------
// Product routing & BOM for the "product flow story"
export const PRODUCT = {
  code: 'EB-200',
  name: 'EB-200 Smart Electrical Enclosure',
  bom: [
    ['EB-200', 'Smart Electrical Enclosure (finished)', 1, 'pcs', 'Assembly Hall'],
    ['SM-3105', 'Steel housing, DC01 1.5 mm, powder coated', 1, 'pcs', 'Sheet Metal Shop'],
    ['PC-2001', 'Front cover, PC/ABS V0 grey', 1, 'pcs', 'Injection Moulding Hall'],
    ['PC-2014', 'Gland plate, PA6-GF30', 1, 'pcs', 'Injection Moulding Hall'],
    ['PC-2022', 'Terminal carrier, PA6-GF30', 1, 'pcs', 'Injection Moulding Hall'],
    ['SM-2240', 'DIN rail 35 x 7.5 mm', 1, 'pcs', 'Sheet Metal Shop'],
    ['HW-0404', 'Screw M4 x 12, stainless', 4, 'pcs', 'Purchased'],
    ['EL-1210', 'Terminal block 2.5 mm²', 12, 'pcs', 'Purchased'],
  ],
  routing: [
    { step: 10, op: 'Mould front cover & plastic parts', equipment: ['IMM-01', 'IMM-02', 'IMM-03', 'IMM-04'], output: 'PC-2001 / PC-2014 / PC-2022', flow: 'plastic' },
    { step: 20, op: 'Laser cut housing blank', equipment: ['LAS-01', 'LAS-02'], output: 'SM-3105 blank', flow: 'metal' },
    { step: 30, op: 'Robotic bending', equipment: ['PBR-01', 'PBR-02'], output: 'SM-3105 bent', flow: 'metal' },
    { step: 40, op: 'Emboss & clinch nuts', equipment: ['HPR-01'], output: 'SM-3105 finished', flow: 'metal' },
    { step: 45, op: 'Stamp DIN rails (coil)', equipment: ['SPR-01'], output: 'SM-2240', flow: 'metal' },
    { step: 50, op: 'Transport to AS/RS (AGV)', equipment: ['AGV-01', 'AGV-02'], output: 'Totes', flow: 'logistics' },
    { step: 60, op: 'Store & kit in AS/RS', equipment: ['SRM-01', 'SRM-02', 'SRM-03'], output: 'Kits', flow: 'logistics' },
    { step: 70, op: 'Deliver kits to assembly (AGV)', equipment: ['AGV-03', 'AGV-04'], output: 'Kits', flow: 'logistics' },
    { step: 80, op: 'Automated assembly', equipment: ['ASM-01', 'ASM-02', 'ASM-03', 'ASM-04'], output: 'EB-200 assembled', flow: 'assembly' },
    { step: 90, op: 'Vision inspection', equipment: ['ASM-05'], output: 'EB-200 OK', flow: 'assembly' },
    { step: 100, op: 'Marking, cartoning', equipment: ['ASM-06', 'ASM-07'], output: 'EB-200 packed', flow: 'assembly' },
    { step: 110, op: 'Palletize & wrap', equipment: ['PAL-01', 'SWR-01'], output: 'Pallet of 12', flow: 'eol' },
    { step: 120, op: 'Move to shipping (forklift AGV)', equipment: ['AGV-06'], output: 'Shipment', flow: 'eol' },
  ],
};

// Alarm catalogue used by the live MES simulation
export const ALARMS = [
  ['E-101', 'imm', 'Major', 'Mould temperature deviation > 5 °C'],
  ['E-114', 'imm', 'Minor', 'Short shot detected – cavity pressure low'],
  ['E-122', 'imm', 'Major', 'Hopper low level – material starvation'],
  ['E-130', 'picker', 'Minor', 'Vacuum not reached at take-out'],
  ['E-205', 'laser', 'Major', 'Nozzle collision detected'],
  ['E-211', 'laser', 'Minor', 'Assist gas pressure low'],
  ['E-220', 'tower', 'Minor', 'Double sheet detected at loader'],
  ['E-301', 'pressbrake', 'Major', 'Angle out of tolerance (> 0.5°)'],
  ['E-310', 'pressbrake', 'Minor', 'Back gauge position error'],
  ['E-401', 'hydpress', 'Critical', 'Hydraulic oil temperature high'],
  ['E-405', 'servopress', 'Major', 'Coil end / misfeed'],
  ['E-501', 'robot', 'Major', 'Gripper part-present lost'],
  ['E-507', 'robot', 'Minor', 'Safety zone violation – reduced speed'],
  ['E-520', 'scara', 'Minor', 'Vision pick failed – retry'],
  ['E-601', 'conveyor', 'Minor', 'Jam detected at photo-eye'],
  ['E-640', 'loop', 'Minor', 'RFID read error on pallet'],
  ['E-701', 'srm', 'Major', 'Fork position sensor fault'],
  ['E-712', 'srm', 'Minor', 'Contour check failed at P&D'],
  ['E-801', 'agv', 'Minor', 'Path blocked – obstacle detected'],
  ['E-810', 'agv', 'Major', 'Localisation lost'],
  ['E-811', 'forklift', 'Minor', 'Pallet pocket not detected'],
  ['E-901', 'station', 'Minor', 'Part missing at station'],
  ['E-915', 'station', 'Major', 'Screw torque NOK (3 retries)'],
  ['E-930', 'station', 'Minor', 'Vision reject rate > 2 %'],
  ['E-950', 'wrapper', 'Minor', 'Film break'],
  ['E-990', 'utility', 'Minor', 'Filter differential pressure high'],
];

export const SETTINGS = [
  ['Plant Name', PLANT.name, 'Shown in the top bar'],
  ['Simulation Enabled', 'Yes', 'Yes = live MES simulation runs on top of the sheet values'],
  ['Simulation Speed', 1, 'Time multiplier for counters and animations (0.25 - 4)'],
  ['Random Event Rate', 1, 'Relative frequency of simulated stops / alarms (0 = none)'],
  ['Shift', 'Early shift 06:00 - 14:00', 'Shown in the top bar'],
  ['Shift Target (pcs)', 560, 'EB-200 target for the shift'],
];

export const MES_COLUMNS = [
  ['id', 'ID'], ['status', 'Status'], ['order', 'Work Order'], ['part', 'Part / Activity'],
  ['availability', 'Availability %'], ['performance', 'Performance %'], ['quality', 'Quality %'], ['oee', 'OEE %'],
  ['targetRate', 'Target Rate (pcs/h)'], ['actualRate', 'Actual Rate (pcs/h)'],
  ['idealCycle', 'Ideal Cycle (s)'], ['actualCycle', 'Actual Cycle (s)'],
  ['good', 'Good Count (shift)'], ['scrap', 'Scrap Count (shift)'],
  ['mtbf', 'MTBF (h)'], ['mttr', 'MTTR (min)'], ['power', 'Power (kW)'], ['energy', 'Energy Today (kWh)'],
  ['battery', 'Battery %'], ['operator', 'Operator'], ['lastMaint', 'Last Maintenance'], ['nextMaint', 'Next Maintenance'],
  ['alarmCode', 'Active Alarm Code'], ['alarmText', 'Active Alarm Text'],
];

export const EQUIPMENT_COLUMNS = [
  ['id', 'ID'], ['name', 'Name'], ['category', 'Category'], ['zone', 'Zone'], ['type', 'Type'], ['parent', 'Parent'],
  ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['serial', 'Serial No.'], ['year', 'Year'], ['drawingNo', 'Drawing No.'],
];

export const STATUSES = ['Running', 'Idle', 'Setup', 'Down', 'Maintenance', 'Offline'];
