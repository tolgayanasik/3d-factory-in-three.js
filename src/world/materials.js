// Shared PBR material library. Materials are cached so identical looks share
// one GPU program and static meshes can be merged per material.
import * as THREE from 'three';
import * as T from './textures.js';

const cache = new Map();

export function paint(color, { rough = 0.5, metal = 0.15, name } = {}) {
  const key = `paint:${color}:${rough}:${metal}`;
  if (!cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    m.name = name || key;
    cache.set(key, m);
  }
  return cache.get(key);
}

export function emissive(color, intensity = 2, name) {
  const key = `emi:${color}:${intensity}`;
  if (!cache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
    m.name = name || key;
    cache.set(key, m);
  }
  return cache.get(key);
}

let _lazy = null;
export function M() {
  if (_lazy) return _lazy;
  const hazardTex = T.hazardTexture();
  const beltTex = T.beltTexture();
  const meshTex = T.meshTexture();
  meshTex.repeat.set(4, 4);
  _lazy = {
    white: paint(0xe9edf0, { rough: 0.42, metal: 0.1 }),
    offWhite: paint(0xd5dade, { rough: 0.5, metal: 0.1 }),
    lightGrey: paint(0xaab2ba, { rough: 0.5, metal: 0.2 }),
    grey: paint(0x7c8590, { rough: 0.5, metal: 0.25 }),
    darkGrey: paint(0x3a4048, { rough: 0.55, metal: 0.3 }),
    charcoal: paint(0x23272c, { rough: 0.6, metal: 0.3 }),
    black: paint(0x141618, { rough: 0.7, metal: 0.2 }),
    rubber: paint(0x1a1b1c, { rough: 0.92, metal: 0 }),
    steel: paint(0xb3b9bf, { rough: 0.32, metal: 0.9 }),
    darkSteel: paint(0x6d747b, { rough: 0.38, metal: 0.85 }),
    chrome: paint(0xe2e6ea, { rough: 0.12, metal: 1.0 }),
    alu: paint(0xc9ced3, { rough: 0.38, metal: 0.75 }),
    copper: paint(0xc27a45, { rough: 0.35, metal: 0.9 }),
    brass: paint(0xc9a646, { rough: 0.35, metal: 0.9 }),
    teal: paint(0x13a8a8, { rough: 0.4, metal: 0.15 }),
    tealDark: paint(0x0e7f86, { rough: 0.4, metal: 0.15 }),
    orange: paint(0xf28c28, { rough: 0.38, metal: 0.15 }),
    yellow: paint(0xf5c518, { rough: 0.42, metal: 0.1 }),
    safetyYellow: paint(0xf2c318, { rough: 0.45, metal: 0.1 }),
    blue: paint(0x2458a6, { rough: 0.45, metal: 0.2 }),
    navy: paint(0x1c3a6b, { rough: 0.45, metal: 0.2 }),
    pbBlue: paint(0x234a8c, { rough: 0.4, metal: 0.2 }),
    green: paint(0x2e7d4f, { rough: 0.45, metal: 0.2 }),
    red: paint(0xc8352f, { rough: 0.45, metal: 0.1 }),
    rackBeam: paint(0xf07b1c, { rough: 0.45, metal: 0.2 }),
    plasticGrey: paint(0x9aa3ab, { rough: 0.55, metal: 0 }),
    plasticDark: paint(0x2b2f33, { rough: 0.6, metal: 0 }),
    toteBlue: paint(0x2f6fd1, { rough: 0.55, metal: 0 }),
    toteGrey: paint(0x5d6770, { rough: 0.6, metal: 0 }),
    granite: paint(0x2c2d30, { rough: 0.25, metal: 0.1 }),
    galv: paint(0xa7adb3, { rough: 0.45, metal: 0.8 }),
    sheet: paint(0xbfc5ca, { rough: 0.3, metal: 0.9 }),
    housing: paint(0xd4d8dc, { rough: 0.35, metal: 0.4 }),
    cover: paint(0x8e979f, { rough: 0.5, metal: 0.05 }),
    coverLight: paint(0xc7cdd2, { rough: 0.5, metal: 0.05 }),
    dinRail: paint(0xd9dde0, { rough: 0.25, metal: 0.95 }),
    terminal: paint(0x6fa0d8, { rough: 0.5, metal: 0 }),
    wood: new THREE.MeshStandardMaterial({ map: T.woodTexture(), roughness: 0.8 }),
    cardboard: new THREE.MeshStandardMaterial({ map: T.cardboardTexture(), roughness: 0.85 }),
    cardboardPlain: paint(0xc29a64, { rough: 0.85, metal: 0 }),
    film: new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 }),
    belt: new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd9e8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 }),
    glassOrange: new THREE.MeshStandardMaterial({ color: 0xff8a1c, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    glassGreen: new THREE.MeshStandardMaterial({ color: 0x3ad17a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    polycarb: new THREE.MeshStandardMaterial({ color: 0xdfeaf2, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    fenceMesh: new THREE.MeshStandardMaterial({ color: 0x1d1f21, alphaMap: meshTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }),
    lampOn: emissive(0xfff4e0, 4),
    ledWhite: emissive(0xe8f4ff, 3),
    ledBlue: emissive(0x2f8cff, 3.5),
    ledCyan: emissive(0x00e0ff, 3),
    laserRed: emissive(0xff2a1a, 6),
    heaterRed: emissive(0xff5a1a, 1.2),
    screenOff: paint(0x0b1622, { rough: 0.2, metal: 0.2 }),
  };
  return _lazy;
}

const screenCache = new Map();
export function screenMat(kind = 'hmi', accent = '#1ba6a6') {
  const key = kind + accent;
  if (!screenCache.has(key)) {
    const t = T.screenTexture(kind, accent);
    screenCache.set(key, new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.25 }));
  }
  return screenCache.get(key);
}
