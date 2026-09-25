// Picking (hover/click), and visual modes: highlight, x-ray, isolate, OEE heatmap.
import * as THREE from 'three';

const ghostMat = new THREE.MeshStandardMaterial({ color: 0x9fc4e8, transparent: true, opacity: 0.16, depthWrite: false, roughness: 1 });
function isAncestorOf(a, b) { let o = b.parent; while (o) { if (o === a) return true; o = o.parent; } return false; }

export class Selection {
  constructor(engine, ctx, store) {
    this.engine = engine;
    this.ctx = ctx;
    this.store = store;
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selected = null;
    this.hover = null;
    this.mode = 'highlight'; // highlight | xray | isolate
    this.heatmap = false;
    this.hidden = new Set(); // ids hidden via tree eye toggles
    this.heatMats = new Map();
    this.listeners = [];
    const dom = engine.renderer.domElement;
    let down = null;
    dom.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    dom.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      if (this.onBeforeClick?.(e)) return;
      const id = this.pick(e);
      this.select(id, { source: '3d' });
    });
    dom.addEventListener('dblclick', (e) => { const id = this.pick(e); if (id) this.onFocus?.(id); });
    let last = 0;
    dom.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - last < 50) return;
      last = now;
      this.hoverAt(e);
    });
    dom.addEventListener('pointerleave', () => this.setHover(null));
    this.refreshT = 0;
  }

  owner(o) {
    while (o) { if (o.userData.equipmentId) return o.userData.equipmentId; o = o.parent; }
    return null;
  }
  visibleChain(o) {
    while (o) { if (!o.visible) return false; o = o.parent; }
    return true;
  }
  pick(e) {
    const r = this.engine.renderer.domElement.getBoundingClientRect();
    return this.pickNDC(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  pickNDC(x, y) {
    this.mouse.set(x, y);
    this.ray.setFromCamera(this.mouse, this.engine.camera);
    const hits = this.ray.intersectObject(this.ctx.equipmentRoot, true);
    for (const h of hits) {
      if (h.object.isPoints || h.object.isLine) continue;
      if (h.object.material === ghostMat) continue;
      if (!this.visibleChain(h.object)) continue;
      const id = this.owner(h.object);
      if (id) return id;
    }
    return null;
  }
  hoverAt(e) {
    if (this.engine.navMode === 'walk') return;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.setHover(this.pick(e), e);
  }
  setHover(id, e) {
    if (id === this.hover) { if (id) this.onHover?.(id, e); return; }
    this.hover = id;
    const eq = id && this.ctx.get(id);
    this.hoverEq = eq && id !== this.selected ? eq : null;
    this.updateHoverBox();
    this.engine.renderer.domElement.style.cursor = id ? 'pointer' : '';
    this.onHover?.(id, e);
  }
  updateHoverBox() {
    const hb = this.engine.hoverBox;
    if (!this.hoverEq || this.hoverEq.id === this.selected) { hb.visible = false; return; }
    hb.box.setFromObject(this.hoverEq.root);
    hb.box.expandByScalar(0.08);
    hb.visible = !hb.box.isEmpty();
  }
  select(id, opts = {}) {
    if (id === this.selected && !opts.force) { if (opts.source !== '3d') this.apply(); return; }
    this.selected = id;
    const eq = id && this.ctx.get(id);
    this.engine.outline.selectedObjects = eq ? [eq.root] : [];
    this.updateHoverBox();
    if (!id && this.mode !== 'highlight') this.mode = 'highlight';
    this.apply();
    this.listeners.forEach((f) => f(id, opts));
  }
  onSelect(f) { this.listeners.push(f); }
  setMode(mode) { this.mode = mode; this.apply(); this.onModeChange?.(mode); }
  setHeatmap(on) { this.heatmap = on; this.apply(); }
  toggleHidden(id, hide) { if (hide) this.hidden.add(id); else this.hidden.delete(id); this.apply(); }

  // ids belonging to the selection (the item + nested equipment such as an IMM's picker)
  family(id) {
    const out = new Set([id]);
    const eq = this.ctx.get(id);
    eq?.root.traverse((o) => { if (o.userData.equipmentId) out.add(o.userData.equipmentId); });
    for (const d of this.ctx.defs.values()) if (d.parent === id && this.ctx.get(d.id)) out.add(d.id);
    return out;
  }

  heatMat(id) {
    const oee = this.store.items.get(id)?.live.oee ?? 0;
    const st = this.store.items.get(id)?.live.status;
    let m = this.heatMats.get(id);
    if (!m) { m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }); this.heatMats.set(id, m); }
    const c = new THREE.Color();
    if (st === 'Down') c.set(0xe0302a);
    else if (st && st !== 'Running') c.set(0x8a94a0);
    else {
      const k = THREE.MathUtils.clamp((oee - 55) / 35, 0, 1);
      c.setHSL(0.0 + k * 0.33, 0.85, 0.5);
    }
    m.color.copy(c);
    m.emissive.copy(c).multiplyScalar(0.25);
    return m;
  }

  apply() {
    const sel = this.selected;
    const fam = sel ? this.family(sel) : null;
    const mode = sel ? this.mode : 'highlight';
    const iso = mode === 'isolate';
    const xray = mode === 'xray';
    const selRoot = sel ? this.ctx.get(sel)?.root : null;
    // 1) visibility at equipment-root level (never touches animated sub-meshes)
    const hide = (o, h) => {
      if (h) { if (o.visible) { o.visible = false; o.userData.isoHidden = true; } }
      else if (o.userData.isoHidden) { o.visible = true; o.userData.isoHidden = false; }
    };
    for (const eq of this.ctx.equipment.values()) {
      const inFam = fam?.has(eq.id);
      const isAncestor = selRoot && !inFam && isAncestorOf(eq.root, selRoot);
      const hidden = this.hidden.has(eq.id);
      if (iso && isAncestor) {
        hide(eq.root, false);
        for (const c of eq.root.children) hide(c, !isAncestorOf(c, selRoot) && c !== selRoot);
      } else {
        for (const c of eq.root.children) if (c.userData.isoHidden) hide(c, false);
        hide(eq.root, hidden || (iso && !inFam));
      }
    }
    // 2) material overrides (x-ray ghost, OEE heatmap)
    this.ctx.equipmentRoot.traverse((o) => {
      if (!o.isMesh || o.userData.keepMat) return;
      const id = this.owner(o);
      const inSel = fam ? fam.has(id) : false;
      let ovr = null;
      if (xray && !inSel) ovr = ghostMat;
      else if (this.heatmap) ovr = this.heatMat(id);
      if (ovr) {
        if (!o.userData.ovr) { o.userData.origMat = o.material; o.userData.origCast = o.castShadow; }
        o.userData.ovr = true;
        o.material = ovr;
        o.castShadow = ovr !== ghostMat && o.userData.origCast;
      } else if (o.userData.ovr) {
        o.material = o.userData.origMat;
        o.castShadow = o.userData.origCast;
        o.userData.ovr = false;
      }
    });
    // 3) environment
    const b = this.ctx.building;
    for (const c of b.root.children) if (c !== b.floor && c.name !== 'marks') c.visible = !iso;
    this.ctx.props.visible = !iso && !xray;
    this.ctx.dynamicRoot.visible = !iso;
    this.ctx.people.forEach((p) => (p.g.visible = !iso && !xray));
    this.envHidden = iso;
    this.onApply?.();
  }

  // Re-apply periodically so dynamically spawned parts follow the current mode
  update(dt) {
    if (this.hoverEq && (this.hoverEq.worldPos || this.hoverEq.def.type === 'srm')) this.updateHoverBox();
    this.refreshT += dt;
    if (this.refreshT > 1.2 && (this.selected || this.heatmap || this.hidden.size)) {
      this.refreshT = 0;
      if (this.heatmap) for (const id of this.heatMats.keys()) this.heatMat(id);
      this.apply();
    }
  }
}
