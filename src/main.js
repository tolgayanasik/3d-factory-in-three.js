// NEXUS Plant 01 – Factory Digital Twin
// Entry point: builds the 3D plant, connects the Excel/MES data link and
// wires up navigation, selection and the UI.
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { buildFactory } from './core/factory.js';
import { Navigation, TOURS } from './core/navigation.js';
import { Selection } from './core/selection.js';
import { Store } from './data/store.js';
import { Tree } from './ui/tree.js';
import { InfoPanel } from './ui/panel.js';
import { TopBar, Toolbar, Alarms, Minimap, Labels, Tooltip, toast, renderProduct, renderHelp } from './ui/hud.js';
import { $, h, esc, ICONS } from './ui/util.js';

const loaderFill = $('#loader-fill');
const loaderText = $('#loader-text');
const progress = (p, t) => { loaderFill.style.width = `${Math.round(p * 100)}%`; if (t) loaderText.textContent = t; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

class App {
  async init() {
    progress(0.05, 'Starting renderer…');
    await nextFrame();
    this.engine = new Engine($('#viewport'));
    this.store = new Store();
    progress(0.12, 'Building the plant…');
    await nextFrame();
    this.ctx = buildFactory(this.engine.scene, progress);
    this.ctx.mesQuality = (id) => this.store.items.get(id)?.live.quality ?? 99;
    this.ctx.events.on('cycle', ({ id, nok }) => this.store.cycle(id, nok));
    progress(0.9, 'Connecting to MES / Excel data…');
    await nextFrame();
    this.nav = new Navigation(this.engine, this.engine.renderer.domElement);
    this.nav.setObstacles(this.ctx.obstacles);
    this.selection = new Selection(this.engine, this.ctx, this.store);
    this.anchors = new Map();
    this.labelsOn = false;
    this.follow = null;

    // UI
    this.topbar = new TopBar(this);
    this.panel = new InfoPanel(this);
    this.tree = new Tree(this.store, this.selection, (id) => this.focus(id));
    this.toolbar = new Toolbar(this);
    this.alarms = new Alarms(this);
    this.minimap = new Minimap(this);
    this.labels = new Labels(this);
    this.tooltip = new Tooltip(this);
    this.bindEvents();
    this.engine.onTimeOfDay = (night) => this.ctx.building.setNight(night);
    this.engine.setTimeOfDay(this.engine.hour);

    await this.store.connect();
    this.syncEquipment();
    this.topbar.updateLink();
    this.topbar.update();
    // warm-up render then hide loader
    this.engine.render();
    progress(1, 'Ready');
    setTimeout(() => $('#loader').classList.add('done'), 250);
    setTimeout(() => $('#loader').remove(), 1100);
    let seen = false;
    try { seen = localStorage.getItem('nexus-help-seen') === '1'; } catch { /* storage unavailable */ }
    if (!seen) setTimeout(() => this.openHelp(), 900);
    this.loop();
  }

  // ------------------------------------------------------------------ wiring
  bindEvents() {
    const s = this.store, sel = this.selection;
    s.on('link', () => this.topbar.updateLink());
    s.on('change', () => { this.syncEquipment(); this.tree.refresh(); this.panel.update(); });
    s.on('status', ({ id, status }) => { const eq = this.ctx.get(id); if (eq) eq.setStatus(status); });
    s.on('battery', ({ id, value }) => { const eq = this.ctx.get(id); if (eq && 'battery' in eq) eq.battery = value; });
    s.on('alarm', (a) => {
      this.alarms.render();
      if (!a.cleared && a.sev !== 'Info' && performance.now() - (this.lastAlarmToast || 0) > 6000) {
        this.lastAlarmToast = performance.now();
        const t = toast(`<div class="h" style="color:#ff9a9a">${ICONS.alarm} ${esc(a.sev)} alarm · ${esc(a.id)}</div><div class="muted" style="margin-top:4px">${esc(a.code)} ${esc(a.text)} – ${esc(a.name)}</div>`, 'alarm', 4500);
        t.style.cursor = 'pointer';
        t.onclick = () => { sel.select(a.id, { source: 'alarm' }); this.focus(a.id); };
      }
    });
    s.on('excel', ({ changes }) => {
      this.topbar.flash();
      const ids = [...new Set(changes.map((c) => c.id))];
      this.tree.flash(ids);
      const list = changes.slice(0, 6).map((c) => `<li><b>${esc(c.id)}</b> ${esc(c.field)}: ${esc(fmt(c.from))} → <b>${esc(fmt(c.to))}</b></li>`).join('');
      toast(`<div class="h">${ICONS.check} Excel update received – ${changes.length} value${changes.length === 1 ? '' : 's'} changed</div>${list ? `<ul>${list}${changes.length > 6 ? `<li>… and ${changes.length - 6} more</li>` : ''}</ul>` : '<div class="muted small">No differences detected</div>'}`, '', 6000);
      if (this.panel.id) this.panel.build();
      if (s.link.warnings?.length) toast(`<div class="h">⚠ ${esc(s.link.warnings.join(' · '))}</div>`, 'alarm');
    });
    s.on('settings', () => this.toolbar?.sync());
    sel.onSelect((id, opts) => {
      this.panel.show(id);
      this.labels.update(0, true);
      if (id && (opts.source === 'tree')) this.focus(id);
      if (!id) this.follow = null;
    });
    sel.onFocus = (id) => { sel.select(id); this.focus(id); };
    sel.onHover = (id, e) => this.tooltip.show(id, e);
    sel.onApply = () => this.panel.syncModeButtons?.();
    $('#tree-toggle').addEventListener('click', () => {
      const closed = $('#tree-panel').classList.toggle('closed');
      $('#tree-toggle').classList.toggle('closed', closed);
      $('#tree-toggle').textContent = closed ? '❯' : '❮';
      document.body.classList.toggle('tree-closed', closed);
    });
    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') { if (!$('#help').classList.contains('hidden')) this.closeHelp(); else if (!$('#product-panel').classList.contains('hidden')) this.closeProduct(); else if (this.nav.tour) this.toggleTour(); else sel.select(null); }
      else if (k === 'f') this.setNav(this.nav.mode === 'walk' ? 'orbit' : 'walk');
      else if (k === 'o') this.setNav('orbit');
      else if (k === 't') this.toggleTour();
      else if (k === 'l') this.toggleLabels();
      else if (k === 'h') this.toggleHeatmap();
      else if (k === 'm') this.toggleFlow();
      else if (k === 'p') this.openProduct();
      else if (k === 'i' && sel.selected) sel.setMode(sel.mode === 'isolate' ? 'highlight' : 'isolate');
      else if (k === 'x' && sel.selected) sel.setMode(sel.mode === 'xray' ? 'highlight' : 'xray');
      else if (e.key === '?') this.openHelp();
      else if (e.code === 'Space' && this.nav.mode !== 'walk') { e.preventDefault(); this.togglePause(); }
    });
    // walk mode: click selects whatever is under the crosshair
    document.addEventListener('mousedown', (e) => {
      if (this.nav.mode !== 'walk' || !this.nav.walk.isLocked || e.button !== 0) return;
      const id = sel.pickNDC(0, 0);
      if (id) sel.select(id, { source: 'walk' });
    });
    // walk-mode lock hint
    this.nav.onWalkUnlock = () => {
      const w = $('#walk-hint');
      w.innerHTML = '<div class="card"><b>Walk mode paused</b><br>Click to continue · <kbd>O</kbd> / <kbd>Esc</kbd> for orbit view</div>';
      w.classList.remove('hidden');
      w.onclick = () => { w.classList.add('hidden'); this.nav.lockWalk(); };
    };
    // drag & drop Excel
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragDepth++; $('#drop-zone').classList.remove('hidden'); } });
    window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop-zone').classList.add('hidden'); } });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault(); dragDepth = 0;
      $('#drop-zone').classList.add('hidden');
      const f = [...(e.dataTransfer?.files || [])].find((x) => /\.xlsx$/i.test(x.name));
      if (f) this.loadFile(f); else toast('<div class="h">Please drop an .xlsx workbook</div>', 'alarm');
    });
  }

  async loadFile(f) {
    try { await this.store.loadFile(f); }
    catch (err) { toast(`<div class="h">Could not read ${esc(f.name)}</div><div class="muted small">${esc(err.message || err)}</div>`, 'alarm', 7000); }
  }
  pickFile() {
    const i = h('input', { type: 'file', accept: '.xlsx', style: { display: 'none' } });
    i.onchange = () => i.files[0] && this.loadFile(i.files[0]);
    document.body.append(i); i.click(); setTimeout(() => i.remove(), 1000);
  }
  downloadExcel() {
    const a = h('a', { href: this.store.link.mode === 'live' ? '/data/factory_data.xlsx' : './data/factory_data.xlsx', download: 'factory_data.xlsx' });
    document.body.append(a); a.click(); a.remove();
  }

  // push live statuses & speed factors from the MES store into the 3D equipment
  syncEquipment() {
    for (const [id, eq] of this.ctx.equipment) {
      const it = this.store.items.get(id);
      if (!it) continue;
      if (eq.status !== it.live.status) eq.setStatus(it.live.status);
      const ideal = Number(it.base.idealCycle), act = Number(it.base.actualCycle);
      const moving = ['agv', 'forklift', 'conveyor', 'loop', 'asrsio', 'srm'].includes(eq.def.type);
      eq.speed = moving || !ideal || !act ? 1 : Math.max(0.35, Math.min(2.5, ideal / act));
      if (eq.andons.length && eq.status !== it.live.status) eq.setStatus(it.live.status);
    }
  }

  anchorOf(id) {
    const eq = this.ctx.get(id);
    if (!eq) return new THREE.Vector3();
    if (eq.worldPos) return eq.worldPos.clone().setY(eq.labelHeight);
    let a = this.anchors.get(id);
    if (!a) {
      const b = new THREE.Box3().setFromObject(eq.root);
      a = { c: b.getCenter(new THREE.Vector3()), r: b.getSize(new THREE.Vector3()).length() / 2, top: b.max.y };
      if (b.isEmpty()) a = { c: eq.root.getWorldPosition(new THREE.Vector3()), r: 3, top: 2 };
      this.anchors.set(id, a);
    }
    return new THREE.Vector3(a.c.x, Math.min(a.top + 0.35, 13), a.c.z);
  }

  focus(id) {
    const eq = this.ctx.get(id);
    if (!eq) return;
    this.anchorOf(id);
    const a = this.anchors.get(id);
    const center = eq.worldPos ? eq.worldPos.clone().setY(0.8) : a.c.clone();
    const r = eq.worldPos ? 2.5 : Math.min(a.r, 22);
    this.nav.flyTo(center, r);
  }
  toggleFollow(id) {
    this.follow = this.follow === id ? null : id;
    if (this.follow) this.focus(id);
    this.panel.build();
  }

  setNav(mode) {
    $('#walk-hint').classList.add('hidden');
    this.nav.setMode(mode);
    let ch = $('.crosshair');
    if (mode === 'walk' && !ch) { ch = h('div', { class: 'crosshair' }); $('#app').append(ch); }
    if (mode !== 'walk') ch?.remove();
    this.engine.navMode = mode;
    this.toolbar.sync();
  }
  toggleTour() {
    if (this.nav.tour) { this.nav.cancelTour(); }
    else {
      this.nav.startTour((s, i) => {
        const cap = $('#tour-caption');
        if (!s) { cap.classList.add('hidden'); this.toolbar.sync(); return; }
        cap.classList.remove('hidden');
        cap.innerHTML = `<div class="n">${i + 1} / ${TOURS.length} · ${esc(s.name)}</div><div class="c">${esc(s.caption)}</div><div class="dots">${TOURS.map((_, k) => `<i class="${k === i % TOURS.length ? 'on' : ''}"></i>`).join('')}</div>`;
      });
    }
    this.toolbar.sync();
  }
  toggleLabels() { this.labelsOn = !this.labelsOn; this.labels.setVisible(this.labelsOn); this.toolbar.sync(); }
  toggleHeatmap() {
    this.selection.setHeatmap(!this.selection.heatmap);
    this.toolbar.sync();
    if (this.selection.heatmap) toast('<div class="h">OEE heatmap on</div><div class="muted small">green ≥ 85 % · amber ≈ 70 % · red &lt; 55 % · grey = idle / stopped · red solid = down</div>', '', 4000);
  }
  toggleFlow(force) { const g = this.ctx.flow.group; g.visible = force ?? !g.visible; this.toolbar.sync(); }
  togglePause() { this.store.paused = !this.store.paused; this.toolbar.sync(); }
  setHour(v) { this.engine.setTimeOfDay(v); this.toolbar.sync(); }
  openProduct() { renderProduct(this); $('#product-panel').classList.remove('hidden'); this.flowBefore = this.ctx.flow.group.visible; this.toggleFlow(true); }
  closeProduct() { $('#product-panel').classList.add('hidden'); this.toggleFlow(this.flowBefore); }
  openHelp() { renderHelp(this); $('#help').classList.remove('hidden'); }
  closeHelp() { $('#help').classList.add('hidden'); try { localStorage.setItem('nexus-help-seen', '1'); } catch { /* ignore */ } }

  // ------------------------------------------------------------------ loop
  loop() {
    let last = performance.now();
    let t = 0, uiT = 0, fastT = 0, vwT = 0;
    const tick = () => {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      const s = this.store;
      s.tick(dt);
      const simDt = s.paused ? 0 : dt * s.simSpeed;
      this.ctx.update(simDt, t);
      // feed live values from the 3D world back into MES
      for (const a of this.ctx.fleet) { const it = s.items.get(a.id); if (it) it.live.battery = a.battery; }
      const rack = this.ctx.get('RCK-01');
      if (rack) s.asrsOccupancy = rack.occupancy;
      if (this.follow) {
        const eq = this.ctx.get(this.follow);
        if (eq?.worldPos && !this.nav.fly) {
          const tgt = eq.worldPos.clone().setY(0.8);
          const d = tgt.clone().sub(this.nav.orbit.target);
          this.nav.orbit.target.add(d);
          this.engine.camera.position.add(d);
        }
      }
      this.nav.update(dt);
      this.selection.update(dt);
      if (!this.selection.envHidden) this.ctx.building.update(this.engine.camera, this.nav.mode === 'walk');
      this.labels.update(dt);
      const rdt = Math.min((now - (this.lastUi || now)) / 1000, 1); this.lastUi = now;
      fastT += rdt; uiT += rdt; vwT += rdt;
      if (fastT > 0.25) { fastT = 0; this.panel.update(); this.minimap.draw(); }
      if (uiT > 1) { uiT = 0; this.topbar.update(); this.tree.refresh(); this.syncEquipment(); }
      if (vwT > 2) { vwT = 0; const k = s.kpis(); this.ctx.building.drawVideoWall({ ...k, trend: s.plantTrend || [] }); }
      this.engine.render();
    };
    tick();
  }
}

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2);
  return v === undefined || v === '' ? '∅' : v;
}

const app = new App();
window.twin = app; // handy for debugging from the console
app.init().catch((err) => {
  console.error(err);
  $('#loader-text').textContent = `Failed to start: ${err.message}`;
});
