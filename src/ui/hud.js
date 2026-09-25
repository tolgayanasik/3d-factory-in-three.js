// Heads-up UI: top KPIs, Excel link status, toolbar, alarms, minimap, labels,
// tooltip, toasts, product-flow panel, help and walk-mode overlay.
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PLANT, ZONES, ASRS, LOOP } from '../../shared/catalog.js';
import { TOURS } from '../core/navigation.js';
import { $, $$, h, ICONS, n, int, esc, time, STATUS_COLOR, oeeColor } from './util.js';

const B = PLANT.building;

// --------------------------------------------------------------------------
export class TopBar {
  constructor(app) {
    this.app = app;
    this.kpis = $('#kpis');
    this.link = $('#link-status');
    this.clock = $('#clock');
    this.link.addEventListener('click', () => this.app.openHelp('data'));
  }
  update() {
    const s = this.app.store;
    const k = s.kpis();
    $('#plant-name').textContent = s.settings['Plant Name'] || PLANT.name;
    const pct = Math.min(100, (k.output / Math.max(1, k.target)) * 100);
    const tiles = [
      ['Plant OEE', `${k.oee.toFixed(1)}<small>%</small>`, k.oee, oeeColor(k.oee)],
      ['Output EB-200', `${int(k.output)}<small>/ ${k.target}</small>`, pct, '#3a9bff'],
      ['Line rate', `${n(k.rate, 0)}<small>pcs/h</small>`],
      ['Running', `${k.running}<small>/ ${k.total}</small>`, (k.running / k.total) * 100, '#29d17a'],
      ['AGVs active', `${k.agvActive}<small>/ ${k.agvTotal}</small>`],
      ['AS/RS fill', `${(k.asrs * 100).toFixed(0)}<small>%</small>`, k.asrs * 100, '#3a78d6'],
      ['Power', `${n(k.power / 1000, 2)}<small>MW</small>`],
      ['Alarms', `<span style="color:${k.alarms ? '#ff4d4d' : '#29d17a'}">${k.alarms}</span>`],
    ];
    this.kpis.innerHTML = tiles.map(([key, v, bar, col]) => `<div class="kpi"><div class="k">${key}</div><div class="v">${v}</div>${bar !== undefined ? `<div class="bar"><i style="width:${Math.max(0, Math.min(100, bar))}%;background:${col}"></i></div>` : ''}</div>`).join('');
    const d = new Date();
    this.clock.innerHTML = `<div class="t">${d.toLocaleTimeString('en-GB')}</div><div class="s">${esc(s.settings.Shift || '')}</div>`;
  }
  updateLink() {
    const l = this.app.store.link;
    const cls = l.error && l.mode !== 'live' ? 'error' : l.mode;
    const t1 = { live: 'Excel live link', static: 'Static snapshot', file: 'Imported workbook', offline: 'Link offline', defaults: 'Built-in demo data', connecting: 'Connecting…' }[l.mode] || l.mode;
    const t2 = l.mode === 'live' ? `${l.source} · updated ${time(l.updated)}` : l.mode === 'static' ? `${l.source} · drop an .xlsx to update` : l.error || l.source;
    this.link.className = `link-status ${cls}`;
    this.link.innerHTML = `<span class="dot"></span><div style="min-width:0"><div class="t1">${esc(t1)}</div><div class="t2">${esc(t2)}</div></div>`;
  }
  flash() { this.link.classList.remove('flash'); void this.link.offsetWidth; this.link.classList.add('flash'); }
}

// --------------------------------------------------------------------------
export class Toolbar {
  constructor(app) {
    this.app = app;
    const el = $('#toolbar');
    const tb = (id, icon, label, title, onclick) => h('button', { class: 'tb', id, title, html: `${ICONS[icon]}${label ? `<span>${label}</span>` : ''}`, onclick });
    this.hourIn = h('input', { type: 'range', min: 0, max: 24, step: 0.25, value: 10.5 });
    this.hourLbl = h('span', { class: 'hr' }, '10:30');
    this.hourIn.addEventListener('input', () => app.setHour(parseFloat(this.hourIn.value)));
    const quality = h('select', { class: 'tb-select', title: 'Rendering quality', onchange: (e) => app.engine.setQuality(e.target.value) },
      h('option', { value: 'high' }, 'High'), h('option', { value: 'medium' }, 'Medium'), h('option', { value: 'low' }, 'Low'));
    this.speed = h('select', { class: 'tb-select', title: 'Simulation speed', onchange: (e) => { app.store.speedOverride = e.target.value === 'sheet' ? null : parseFloat(e.target.value); } },
      h('option', { value: 'sheet' }, 'Speed: sheet'), ...[0.5, 1, 2, 4].map((v) => h('option', { value: v }, `× ${v}`)));
    el.append(
      h('div', { class: 'tb-group' }, tb('tb-orbit', 'orbit', 'Orbit', 'Orbit / pan / zoom (O)', () => app.setNav('orbit')), tb('tb-walk', 'walk', 'Walk', 'First-person walk – WASD + mouse (F)', () => app.setNav('walk'))),
      h('div', { class: 'tb-group' }, tb('tb-tour', 'tour', 'Tour', 'Guided camera tour (T)', () => app.toggleTour()), (() => {
        const s = h('select', { class: 'tb-select', title: 'Jump to area', onchange: (e) => { if (e.target.value !== '') app.nav.flyToPose(TOURS[e.target.value].pos, TOURS[e.target.value].target); e.target.value = ''; } }, h('option', { value: '' }, 'Go to…'), ...TOURS.map((t, i) => h('option', { value: i }, t.name)));
        return s;
      })()),
      h('div', { class: 'tb-group' }, tb('tb-labels', 'label', 'Labels', 'Floating equipment labels (L)', () => app.toggleLabels()), tb('tb-heat', 'heat', 'Heatmap', 'Colour equipment by OEE (H)', () => app.toggleHeatmap()), tb('tb-flow', 'flow', 'Flow', 'Material flow overlay (M)', () => app.toggleFlow()), tb('tb-product', 'product', 'Product', 'EB-200 product routing & BOM (P)', () => app.openProduct())),
      h('div', { class: 'tb-group' }, h('div', { class: 'tod', title: 'Time of day' }, h('span', { html: ICONS.sun }), this.hourIn, this.hourLbl)),
      h('div', { class: 'tb-group' }, tb('tb-pause', 'pause', '', 'Pause / resume the simulation (Space)', () => app.togglePause()), this.speed, quality),
      h('div', { class: 'tb-group' }, tb('tb-excel', 'download', '', 'Download the Excel data file', () => app.downloadExcel()), tb('tb-import', 'upload', '', 'Load an Excel workbook (.xlsx)', () => app.pickFile()), tb('tb-help', 'help', '', 'Help & shortcuts (?)', () => app.openHelp())),
    );
    $$('.tb svg', el).forEach((s) => { s.style.width = '17px'; s.style.height = '17px'; });
    this.sync();
  }
  sync() {
    const a = this.app;
    $('#tb-orbit').classList.toggle('on', a.nav.mode === 'orbit');
    $('#tb-walk').classList.toggle('on', a.nav.mode === 'walk');
    $('#tb-tour').classList.toggle('on', !!a.nav.tour);
    $('#tb-tour').innerHTML = `${ICONS[a.nav.tour ? 'stop' : 'tour']}<span>${a.nav.tour ? 'Stop' : 'Tour'}</span>`;
    $('#tb-labels').classList.toggle('on', a.labelsOn);
    $('#tb-heat').classList.toggle('on', a.selection.heatmap);
    $('#tb-flow').classList.toggle('on', a.ctx.flow.group.visible);
    $('#tb-pause').innerHTML = ICONS[a.store.paused ? 'play' : 'pause'];
    $('#tb-pause').classList.toggle('on', a.store.paused);
    this.hourIn.value = a.engine.hour;
    const hr = Math.floor(a.engine.hour), mn = Math.round((a.engine.hour - hr) * 60);
    this.hourLbl.textContent = `${String(hr % 24).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    $$('#toolbar svg').forEach((s) => { s.style.width = '17px'; s.style.height = '17px'; });
  }
}

// --------------------------------------------------------------------------
export class Alarms {
  constructor(app) {
    this.app = app;
    this.el = $('#alarms');
    this.filter = 'active';
    this.head = h('div', { class: 'al-head', onclick: () => this.el.classList.toggle('collapsed') }, h('span', { html: ICONS.alarm, style: { width: '16px', height: '16px', color: '#ff4d4d', display: 'inline-flex' } }), h('span', { class: 't' }, 'Alarms & events'), this.badge = h('span', { class: 'badge' }, '0'), h('span', { class: 'muted small' }, '▾'));
    const tab = (v, l) => h('button', { class: `btn${this.filter === v ? ' on' : ''}`, 'data-v': v, onclick: (e) => { this.filter = v; $$('.al-tabs .btn', this.el).forEach((b) => b.classList.toggle('on', b.dataset.v === v)); this.render(); } }, l);
    this.tabs = h('div', { class: 'al-tabs' }, tab('active', 'Active'), tab('all', 'History'));
    this.list = h('div', { class: 'alarm-list' });
    this.el.append(this.head, this.tabs, this.list);
    this.el.querySelector('.al-head svg').style.cssText = 'width:16px;height:16px';
    this.render();
  }
  render() {
    const all = this.app.store.alarms;
    const active = all.filter((a) => !a.cleared);
    const crit = active.filter((a) => a.sev !== 'Info').length;
    this.badge.textContent = crit;
    this.badge.classList.toggle('zero', !crit);
    const list = this.filter === 'active' ? active : all.slice(0, 80);
    this.list.innerHTML = '';
    if (!list.length) { this.list.append(h('div', { class: 'al-empty' }, this.filter === 'active' ? '✓ No active alarms – all systems nominal' : 'No events yet')); return; }
    for (const a of list) {
      this.list.append(h('div', { class: `al-item${a.cleared ? ' cleared' : ''}`, onclick: () => { this.app.selection.select(a.id, { source: 'alarm' }); this.app.focus(a.id); } },
        h('span', { class: `sev sev-${a.sev}`, style: { fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px' } }, a.sev),
        h('div', { class: 'tx' }, h('div', { class: 'a' }, `${a.id} · ${a.name}`), h('div', { class: 'b' }, `${a.code} ${a.text}`)),
        h('div', { class: 'tm' }, time(a.time), h('br'), a.cleared ? 'cleared' : a.src === 'excel' ? 'Excel' : 'live')));
    }
  }
}

// --------------------------------------------------------------------------
export class Minimap {
  constructor(app) {
    this.app = app;
    this.canvas = $('#minimap canvas');
    this.canvas.addEventListener('click', (e) => {
      const r = this.canvas.getBoundingClientRect();
      const [x, z] = this.toWorld((e.clientX - r.left) * (this.canvas.width / r.width), (e.clientY - r.top) * (this.canvas.height / r.height));
      const nav = this.app.nav;
      if (nav.mode === 'walk') { nav.camera.position.x = x; nav.camera.position.z = z; return; }
      const off = nav.camera.position.clone().sub(nav.orbit.target);
      nav.flyToPose([x + off.x, nav.camera.position.y, z + off.z], [x, 0, z], 1.2);
    });
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = 256 * this.dpr; this.canvas.height = 172 * this.dpr;
    this.pad = 10 * this.dpr;
    const w = this.canvas.width - this.pad * 2, hh = this.canvas.height - this.pad * 2 - 8 * this.dpr;
    this.s = Math.min(w / (B.maxX - B.minX), hh / (B.maxZ - B.minZ));
    this.ox = this.pad + (w - (B.maxX - B.minX) * this.s) / 2;
    this.oy = this.pad + 8 * this.dpr + (hh - (B.maxZ - B.minZ) * this.s) / 2;
  }
  toMap(x, z) { return [this.ox + (x - B.minX) * this.s, this.oy + (z - B.minZ) * this.s]; }
  toWorld(px, py) { return [(px - this.ox) / this.s + B.minX, (py - this.oy) / this.s + B.minZ]; }
  draw() {
    const g = this.canvas.getContext('2d');
    const { s } = this;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const [bx, by] = this.toMap(B.minX, B.minZ);
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(bx, by, (B.maxX - B.minX) * s, (B.maxZ - B.minZ) * s);
    g.strokeStyle = 'rgba(140,170,200,0.4)'; g.lineWidth = 1; g.strokeRect(bx, by, (B.maxX - B.minX) * s, (B.maxZ - B.minZ) * s);
    for (const z of ZONES) {
      if (z.key === 'Logistics') continue;
      const [x0, y0] = this.toMap(z.rect[0], z.rect[1]);
      g.fillStyle = z.color + '22'; g.strokeStyle = z.color + '88';
      g.fillRect(x0, y0, (z.rect[2] - z.rect[0]) * s, (z.rect[3] - z.rect[1]) * s);
      g.strokeRect(x0, y0, (z.rect[2] - z.rect[0]) * s, (z.rect[3] - z.rect[1]) * s);
    }
    // main aisle
    const [ax, ay] = this.toMap(B.minX + 1, 1);
    g.fillStyle = 'rgba(242,195,24,0.12)'; g.fillRect(ax, ay, (B.maxX - B.minX - 2) * s, 6 * s);
    // equipment footprints coloured by status
    const store = this.app.store;
    for (const [id, eq] of this.app.ctx.equipment) {
      if (eq.def.type === 'agv' || eq.def.type === 'forklift' || eq.def.type === 'rack') continue;
      const it = store.items.get(id);
      const [x, y] = this.toMap(eq.def.pos[0], eq.def.pos[1]);
      g.fillStyle = STATUS_COLOR[it?.live.status] || '#888';
      const sz = eq.def.type === 'conveyor' || eq.def.type === 'loop' ? 1.6 : 2.6;
      g.fillRect(x - sz * this.dpr / 2, y - sz * this.dpr / 2, sz * this.dpr, sz * this.dpr);
    }
    // rack outline
    const [rx, ry] = this.toMap(ASRS.aisles[0] - 2, ASRS.zMin);
    g.strokeStyle = 'rgba(58,120,214,0.9)'; g.strokeRect(rx, ry, (ASRS.aisles[2] - ASRS.aisles[0] + 4) * s, (ASRS.zMax - ASRS.zMin) * s);
    // AGVs
    for (const a of this.app.ctx.fleet) {
      const [x, y] = this.toMap(a.worldPos.x, a.worldPos.z);
      g.fillStyle = a.id === this.app.selection.selected ? '#33e1ff' : '#f2c318';
      g.beginPath(); g.arc(x, y, 2.6 * this.dpr, 0, Math.PI * 2); g.fill();
    }
    // selected
    const sel = this.app.selection.selected && this.app.ctx.get(this.app.selection.selected);
    if (sel) {
      const p = this.app.anchorOf(sel.id);
      const [x, y] = this.toMap(p.x, p.z);
      g.strokeStyle = '#33e1ff'; g.lineWidth = 2 * this.dpr;
      g.beginPath(); g.arc(x, y, 6 * this.dpr, 0, Math.PI * 2); g.stroke();
    }
    // camera
    const cam = this.app.engine.camera;
    const [cx, cy] = this.toMap(cam.position.x, cam.position.z);
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const ang = Math.atan2(dir.z, dir.x);
    g.fillStyle = 'rgba(51,225,255,0.18)';
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 26 * this.dpr, ang - 0.45, ang + 0.45); g.closePath(); g.fill();
    g.fillStyle = '#33e1ff'; g.beginPath(); g.arc(cx, cy, 3.5 * this.dpr, 0, Math.PI * 2); g.fill();
  }
}

// --------------------------------------------------------------------------
export class Labels {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'labels';
    app.engine.scene.add(this.group);
    this.items = new Map();
    for (const [id, eq] of app.ctx.equipment) this.add(id, eq);
    // picker labels
    for (const it of app.store.items.values()) if (!this.items.has(it.id) && app.ctx.get(it.id)) this.add(it.id, app.ctx.get(it.id));
    this.visible = false;
    this.t = 0;
  }
  add(id, eq) {
    const div = h('div', { class: 'eq-label', onclick: () => { this.app.selection.select(id, { source: 'label' }); } });
    div.innerHTML = '<span class="sd"></span><b></b><span class="o"></span>';
    const obj = new CSS2DObject(div);
    obj.center.set(0.5, 1);
    this.group.add(obj);
    this.items.set(id, { obj, div, eq, sd: div.children[0], b: div.children[1], o: div.children[2] });
  }
  setVisible(v) { this.visible = v; this.update(0, true); }
  update(dt, force = false) {
    this.t += dt;
    const sel = this.app.selection.selected;
    const cam = this.app.engine.camera.position;
    const iso = this.app.selection.envHidden;
    const fam = iso && sel ? this.app.selection.family(sel) : null;
    for (const [id, L] of this.items) {
      const p = this.app.anchorOf(id);
      L.obj.position.copy(p);
      const d = p.distanceTo(cam);
      const hiddenEq = this.app.selection.hidden.has(id) || (fam && !fam.has(id));
      const show = !hiddenEq && (id === sel || (this.visible && d < 85));
      L.obj.visible = show;
      if (!show) continue;
      if (this.t > 0.5 || force || id === sel) {
        const it = this.app.store.items.get(id);
        const st = it.live.status;
        L.sd.style.background = STATUS_COLOR[st];
        L.b.textContent = id;
        const showOee = Number(it.base.targetRate) > 0;
        L.o.textContent = it.def.type === 'agv' || it.def.type === 'forklift' ? `${L.eq.battery.toFixed(0)}% 🔋` : showOee ? `OEE ${it.live.oee.toFixed(0)}%` : st;
        L.div.classList.toggle('sel', id === sel);
        L.div.classList.toggle('down', st === 'Down');
      }
    }
    if (this.t > 0.5) this.t = 0;
  }
}

// --------------------------------------------------------------------------
export class Tooltip {
  constructor(app) { this.app = app; this.el = $('#tooltip'); }
  show(id, e) {
    if (!id || !e) { this.el.classList.add('hidden'); return; }
    const it = this.app.store.items.get(id);
    if (!it) return;
    const l = it.live;
    const showOee = Number(it.base.targetRate) > 0;
    this.el.innerHTML = `<div class="t1">${esc(it.info.name)}</div><div class="t2">${esc(id)} · ${esc(it.info.model)}</div>
      <div class="row"><span>Status</span><span style="color:${STATUS_COLOR[l.status]};font-weight:700">${l.status}</span></div>
      ${showOee ? `<div class="row"><span>OEE</span><span style="color:${oeeColor(l.oee)};font-weight:700">${l.oee.toFixed(1)} %</span></div><div class="row"><span>Rate</span><span>${n(l.actualRate, 0)} / ${n(Number(it.base.targetRate), 0)} pcs/h</span></div>` : ''}
      ${l.alarmText ? `<div class="row" style="color:#ff9a9a"><span>${esc(l.alarmCode)}</span><span>${esc(l.alarmText)}</span></div>` : ''}
      <div class="hint">Click for MES details · double-click to focus</div>`;
    this.el.classList.remove('hidden');
    const x = Math.min(window.innerWidth - this.el.offsetWidth - 12, e.clientX + 16);
    const y = Math.min(window.innerHeight - this.el.offsetHeight - 12, e.clientY + 16);
    this.el.style.left = `${x}px`; this.el.style.top = `${y}px`;
  }
}

// --------------------------------------------------------------------------
export function toast(html, cls = '', ms = 5000) {
  const el = h('div', { class: `toast ${cls}`, html });
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
  return el;
}

// --------------------------------------------------------------------------
export function renderProduct(app) {
  const el = $('#product-panel');
  const s = app.store;
  const p = s.product;
  const flowCol = { plastic: '#19d3d3', metal: '#ff9a2e', logistics: '#5aa0ff', assembly: '#b48cff', eol: '#3ee07a' };
  const card = h('div', { class: 'modal-card' });
  card.append(h('div', { class: 'modal-head' },
    h('div', {}, h('h2', {}, `${p.name || 'EB-200'} – product flow`), h('div', { class: 'muted' }, 'Routing from raw material to shipment. Click an equipment chip to locate it. The material-flow overlay is shown in 3D while this panel is open.')),
    h('button', { class: 'icon-btn', html: ICONS.close, onclick: () => app.closeProduct() })));
  const route = h('div', { class: 'route' });
  for (const r of p.routing) {
    const col = flowCol[r.flow] || '#8fa3b8';
    const chips = r.equipment.map((id) => {
      const it = s.items.get(id);
      const st = it?.live.status || 'Offline';
      return h('span', { class: 'chip', title: it?.info.name || id, onclick: () => { app.closeProduct(); app.selection.select(id, { source: 'product' }); app.focus(id); } }, h('i', { style: { background: STATUS_COLOR[st] } }), id);
    });
    const wip = r.equipment.reduce((sum, id) => sum + (s.items.get(id)?.live.actualRate || 0), 0);
    route.append(h('div', { class: 'step', style: { borderTop: `3px solid ${col}` } },
      h('span', { class: 'flowtag', style: { background: col + '22', color: col } }, r.flow),
      h('div', { class: 'no' }, `OP ${r.step}`), h('div', { class: 'op' }, r.op), h('div', {}, ...chips),
      h('div', { class: 'out' }, `→ ${r.output}`, h('br'), `Σ rate ${n(wip, 0)} /h`)));
  }
  card.append(route);
  card.append(h('div', { class: 'sec-title', style: { marginTop: '18px' } }, 'Bill of materials'));
  const t = h('table', { class: 'bom' });
  t.innerHTML = `<tr><th>Part no.</th><th>Description</th><th>Qty</th><th>Unit</th><th>Source</th></tr>${p.bom.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}`;
  card.append(t);
  el.innerHTML = '';
  el.append(card);
  el.onclick = (e) => { if (e.target === el) app.closeProduct(); };
}

export function renderHelp(app, section) {
  const el = $('#help');
  const l = app.store.link;
  const card = h('div', { class: 'modal-card', html: `
    <div class="modal-head"><div><h2>NEXUS Plant 01 – Digital Twin</h2><div class="muted">Navigate the automated factory, inspect any machine and drive it from Excel.</div></div></div>
    <div class="help-grid">
      <div><h3>Navigation</h3><ul>
        <li><b>Orbit</b>: left-drag rotate · right-drag pan · wheel zoom · arrow keys pan</li>
        <li><b>Walk</b> (<kbd>F</kbd>): mouse look, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move, <kbd>Shift</kbd> run, <kbd>Esc</kbd> release</li>
        <li><b>Tour</b> (<kbd>T</kbd>): guided flight through every area</li>
        <li>Minimap: click to jump · <kbd>Go to…</kbd> menu for areas</li>
      </ul></div>
      <div><h3>Inspect</h3><ul>
        <li>Hover = quick status · click = MES panel · double-click = focus</li>
        <li>Tree (left): click to select & fly · eye icon hides an item</li>
        <li>Selection mode: <b>Highlight</b>, <b>X-ray</b> or <b>Isolate</b></li>
        <li><kbd>H</kbd> OEE heatmap · <kbd>L</kbd> labels · <kbd>M</kbd> material flow · <kbd>P</kbd> product · <kbd>Esc</kbd> clear</li>
      </ul></div>
      <div style="grid-column:span 2"><h3>Excel data link</h3><ul>
        <li>Current source: <b>${esc(l.source)}</b> – mode <b>${esc(l.mode)}</b>${l.updated ? `, last update ${time(l.updated)}` : ''}</li>
        <li>Run <kbd>npm start</kbd> and edit <b>data/factory_data.xlsx</b> (sheets <b>MES</b>, <b>Equipment</b>, <b>Specs</b>, <b>Settings</b>). Save – the dev server pushes the change over a WebSocket and the twin updates within ~1 s.</li>
        <li>Try: set <b>IMM-02 → Status = Down</b> with an alarm text; change <b>Actual Cycle</b> to speed a machine up; set <b>Simulation Enabled = No</b> to freeze on sheet values.</li>
        <li>On the static (GitHub Pages) build, drop an edited .xlsx onto the page or use the upload button.</li>
      </ul></div>
    </div>
    <div style="text-align:right;margin-top:16px"><button class="btn primary" id="help-close">Start exploring</button></div>` });
  el.innerHTML = '';
  el.append(card);
  $('#help-close').onclick = () => app.closeHelp();
  el.onclick = (e) => { if (e.target === el) app.closeHelp(); };
}
