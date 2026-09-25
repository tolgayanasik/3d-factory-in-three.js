// Data store: merges catalog defaults with the Excel workbook (live link via
// the dev server WebSocket, or a static snapshot), and runs the live MES
// simulation on top of the sheet values.
import { EQUIPMENT, PRODUCT, ALARMS, SETTINGS } from '../../shared/catalog.js';

export class Emitter {
  constructor() { this.l = {}; }
  on(e, f) { (this.l[e] ||= []).push(f); return () => (this.l[e] = this.l[e].filter((x) => x !== f)); }
  emit(e, d) { (this.l[e] || []).forEach((f) => f(d)); }
}

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);
const noise = (seed, t) => Math.sin(t * 0.37 + seed) * 0.5 + Math.sin(t * 0.113 + seed * 2.1) * 0.35 + Math.sin(t * 1.3 + seed * 0.7) * 0.15;

export class Store extends Emitter {
  constructor() {
    super();
    this.items = new Map();
    EQUIPMENT.forEach((d, i) => {
      this.items.set(d.id, {
        id: d.id, idx: i, def: d,
        info: { name: d.name, category: d.category, zone: d.zone, type: d.type, parent: d.parent || '', manufacturer: d.manufacturer, model: d.model, serial: d.serial, year: d.year, drawingNo: d.drawingNo },
        specs: d.specs || [],
        base: { ...d.mes },
        live: { ...d.mes, oee: 0, alarmCode: '', alarmText: '' },
        sim: { downUntil: 0, reason: null, aDrag: 0 },
        history: [],
      });
    });
    this.settings = Object.fromEntries(SETTINGS.map(([k, v]) => [k, v]));
    this.product = PRODUCT;
    this.alarmCatalog = ALARMS;
    this.alarms = []; // event log
    this.simTime = 0;
    this.paused = false;
    this.speedOverride = null;
    this.link = { mode: 'connecting', source: 'factory_data.xlsx', updated: null, error: null };
    this.recompute();
  }

  get simEnabled() { return String(this.settings['Simulation Enabled'] ?? 'Yes').toLowerCase().startsWith('y'); }
  get simSpeed() { return this.speedOverride ?? Math.min(4, Math.max(0.1, num(this.settings['Simulation Speed'], 1))); }
  get eventRate() { return Math.max(0, num(this.settings['Random Event Rate'], 1)); }

  // --------------------------------------------------------------- loading
  async connect() {
    const hot = import.meta.hot;
    if (hot) {
      hot.on('factory:data', (data) => this.apply(data, 'live'));
      hot.on('factory:error', (e) => { this.link.error = e.message; this.emit('link', this.link); });
      hot.on('vite:ws:disconnect', () => { this.link.mode = 'offline'; this.emit('link', this.link); });
      hot.on('vite:ws:connect', () => { if (this.link.mode === 'offline') this.link.mode = 'live'; this.emit('link', this.link); });
      try {
        const r = await fetch('/api/factory-data.json', { cache: 'no-store' });
        if (!r.ok) throw new Error((await r.json()).error || r.statusText);
        this.apply(await r.json(), 'live', true);
        return;
      } catch (e) { this.link.error = String(e.message || e); }
    }
    try {
      const r = await fetch('./data/factory_data.json', { cache: 'no-store' });
      if (r.ok) { this.apply(await r.json(), 'static', true); return; }
    } catch { /* fall through */ }
    this.link.mode = 'defaults';
    this.emit('link', this.link);
  }

  async loadFile(file) {
    const { default: ExcelJS } = await import('exceljs');
    const { parseWorkbook } = await import('../../shared/parseWorkbook.js');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const data = parseWorkbook(wb, file.name);
    this.apply(data, this.link.mode === 'live' ? 'live' : 'file');
    this.link.source = file.name;
  }

  apply(data, mode, initial = false) {
    const changes = [];
    const statusChanged = [];
    if (data.settings) {
      for (const [k, v] of Object.entries(data.settings)) {
        if (!initial && this.settings[k] !== v) changes.push({ id: 'Settings', field: k, from: this.settings[k], to: v });
        this.settings[k] = v;
      }
    }
    for (const [id, rec] of Object.entries(data.equipment || {})) {
      const it = this.items.get(id);
      if (!it) continue;
      for (const k of ['name', 'category', 'zone', 'manufacturer', 'model', 'serial', 'year', 'drawingNo']) {
        if (rec[k] !== undefined && rec[k] !== '' && rec[k] !== it.info[k]) { if (!initial) changes.push({ id, field: k, from: it.info[k], to: rec[k] }); it.info[k] = rec[k]; }
      }
    }
    for (const [id, rec] of Object.entries(data.mes || {})) {
      const it = this.items.get(id);
      if (!it) continue;
      for (const [k, v] of Object.entries(rec)) {
        if (k === 'id' || k === 'oee') continue;
        const old = it.base[k];
        if (old !== v && !(old === undefined && v === '')) {
          if (!initial) changes.push({ id, field: k, from: old, to: v });
          it.base[k] = v;
          // sheet edits take effect immediately on the live values
          if (['good', 'scrap', 'energy', 'battery'].includes(k)) it.live[k] = v;
          if (k === 'status') { it.sim.downUntil = 0; it.sim.reason = null; statusChanged.push(it); }
          if (k === 'battery') this.emit('battery', { id, value: num(v, 80) });
        }
      }
    }
    for (const [id, list] of Object.entries(data.specs || {})) {
      const it = this.items.get(id);
      if (it && JSON.stringify(it.specs) !== JSON.stringify(list)) { if (!initial) changes.push({ id, field: 'specs', from: '', to: `${list.length} rows` }); it.specs = list; }
    }
    if (data.product?.routing?.length) this.product = { ...this.product, bom: data.product.bom.length ? data.product.bom : this.product.bom, routing: data.product.routing };
    if (data.alarms?.length) this.alarmCatalog = data.alarms;
    this.link = { mode, source: data.source || this.link.source, updated: new Date(), mtime: data.mtime, error: null, warnings: data.warnings };
    this.recompute();
    this.tick(0, true); // refresh live values right away
    // Excel-driven stops raise / clear alarms immediately
    const now = initial ? [...this.items.values()].filter((it) => it.base.status === 'Down') : statusChanged;
    for (const it of now) {
      if (it.base.status === 'Down') this.logAlarm(it, it.base.alarmCode || 'E-000', it.base.alarmText || 'Stopped – status set to Down in Excel', 'Major', 'excel');
      else this.alarms.filter((a) => a.id === it.id && !a.cleared).forEach((a) => { a.cleared = new Date(); this.emit('alarm', a); });
      this.emit('status', { id: it.id, status: it.live.status });
    }
    this.emit('link', this.link);
    if (!initial) this.emit('excel', { changes });
    this.emit('change', { ids: [...this.items.keys()] });
    this.emit('settings', this.settings);
  }

  // --------------------------------------------------------------- simulation
  effectiveStatus(it) {
    const b = it.base.status || 'Running';
    if (b !== 'Running') return b;
    if (this.simEnabled && it.sim.downUntil > this.simTime) return it.sim.state || 'Down';
    return 'Running';
  }

  tick(dtReal, force = false) {
    if (this.paused && !force) return;
    const dt = dtReal * this.simSpeed;
    this.simTime += dt;
    const sim = this.simEnabled;
    const N = this.items.size;
    for (const it of this.items.values()) {
      const b = it.base, l = it.live, s = it.sim;
      const prevStatus = l.status;
      // random events
      if (sim && b.status === 'Running' && s.downUntil <= this.simTime && this.eventRate > 0 && it.def.type !== 'rack') {
        if (Math.random() < (dt * this.eventRate) / (38 * N)) this.raiseEvent(it);
      }
      if (s.reason && s.downUntil <= this.simTime) this.clearEvent(it);
      l.status = this.effectiveStatus(it);
      const running = l.status === 'Running';
      const t = this.simTime, seed = it.idx * 1.7;
      if (sim) {
        s.aDrag = running ? Math.max(0, s.aDrag - dt * 0.004) : Math.min(8, s.aDrag + dt * 0.03);
        l.availability = clamp(num(b.availability) - s.aDrag + noise(seed, t) * 0.4, 0, 100);
        l.performance = clamp(num(b.performance) + noise(seed + 3, t * 1.3) * 1.2, 0, 100);
        l.quality = clamp(num(b.quality) + noise(seed + 7, t * 0.6) * 0.15, 0, 100);
        const r = num(b.actualRate);
        l.actualRate = running ? Math.max(0, r * (1 + noise(seed + 11, t * 2) * 0.03)) : 0;
        const c = num(b.actualCycle);
        l.actualCycle = running && c ? c * (1 - noise(seed + 11, t * 2) * 0.03) : c;
        const p = num(b.power);
        l.power = p * (running ? 1 + noise(seed + 5, t * 3) * 0.06 : l.status === 'Idle' ? 0.35 : 0.12);
        l.energy = num(l.energy) + (l.power * dt) / 3600;
        if (running && !it.cycleDriven && r > 0) {
          const made = (r / 3600) * dt;
          const q = l.quality / 100;
          l.good = num(l.good) + made * q;
          l.scrap = num(l.scrap) + made * (1 - q);
        }
      } else {
        for (const k of ['availability', 'performance', 'quality', 'actualRate', 'actualCycle', 'power']) l[k] = num(b[k]);
        l.good = num(b.good); l.scrap = num(b.scrap);
      }
      for (const k of ['order', 'part', 'targetRate', 'idealCycle', 'mtbf', 'mttr', 'operator', 'lastMaint', 'nextMaint']) l[k] = b[k];
      if (!s.reason) { l.alarmCode = b.alarmCode || ''; l.alarmText = b.alarmText || ''; }
      l.oee = (l.availability * l.performance * l.quality) / 10000;
      if (prevStatus !== l.status) this.emit('status', { id: it.id, status: l.status, prev: prevStatus });
    }
    this.histT = (this.histT || 0) + dtReal;
    if (this.histT > 2) {
      this.histT = 0;
      for (const it of this.items.values()) {
        it.history.push({ t: this.simTime, oee: it.live.oee, rate: it.live.actualRate, status: it.live.status });
        if (it.history.length > 180) it.history.shift();
      }
      const k = this.kpis();
      (this.plantTrend ||= []).push(k.oee);
      if (this.plantTrend.length > 180) this.plantTrend.shift();
    }
    this.emit('tick', dt);
  }

  cycle(id, nok = false) {
    const it = this.items.get(id);
    if (!it) return;
    it.cycleDriven = true;
    if (!this.simEnabled) return;
    if (nok) it.live.scrap = num(it.live.scrap) + 1; else it.live.good = num(it.live.good) + 1;
  }

  raiseEvent(it) {
    const type = it.def.type;
    const cands = this.alarmCatalog.filter(([, t]) => t === type || (t === 'robot' && type === 'scara') || (t === 'utility' && it.def.category === 'Utilities') || (t === 'conveyor' && type === 'asrsio'));
    const s = it.sim;
    if (cands.length && Math.random() < 0.7) {
      const [code, , sev, text] = cands[(Math.random() * cands.length) | 0];
      s.state = 'Down';
      s.reason = { code, sev, text };
      s.downUntil = this.simTime + (sev === 'Critical' ? 70 : sev === 'Major' ? 40 : 18) * (0.6 + Math.random() * 0.8);
      it.live.alarmCode = code; it.live.alarmText = text;
      this.logAlarm(it, code, text, sev, 'sim');
    } else {
      s.state = 'Idle';
      s.reason = { code: 'I-010', sev: 'Info', text: Math.random() < 0.5 ? 'Starved – waiting for material' : 'Blocked – downstream full' };
      s.downUntil = this.simTime + 10 + Math.random() * 20;
      this.logAlarm(it, s.reason.code, s.reason.text, 'Info', 'sim');
    }
  }
  clearEvent(it) {
    const s = it.sim;
    const a = this.alarms.find((x) => x.id === it.id && !x.cleared);
    if (a) { a.cleared = new Date(); this.emit('alarm', a); }
    s.reason = null; s.state = null;
    it.live.alarmCode = ''; it.live.alarmText = '';
  }
  logAlarm(it, code, text, sev, src) {
    const a = { key: Math.random().toString(36).slice(2), id: it.id, name: it.info.name, code, text, sev, src, time: new Date(), cleared: null };
    // close previous open alarm for this item
    this.alarms.filter((x) => x.id === it.id && !x.cleared).forEach((x) => (x.cleared = new Date()));
    this.alarms.unshift(a);
    if (this.alarms.length > 200) this.alarms.pop();
    this.emit('alarm', a);
  }
  acknowledge(id) {
    const it = this.items.get(id);
    if (it?.sim.reason) { it.sim.downUntil = this.simTime; }
  }

  recompute() { for (const it of this.items.values()) it.live.status = this.effectiveStatus(it); }

  kpis() {
    const main = [...this.items.values()].filter((it) => ['imm', 'laser', 'pressbrake', 'hydpress', 'servopress', 'station'].includes(it.def.type));
    let w = 0, o = 0;
    for (const it of main) { const wt = num(it.base.targetRate, 1) > 0 ? 1 : 0; w += wt; o += wt * it.live.oee; }
    const eol = this.items.get('ASM-07');
    const out = eol ? Math.floor(num(eol.live.good)) : 0;
    const rate = eol ? eol.live.actualRate : 0;
    const agvs = [...this.items.values()].filter((it) => it.def.type === 'agv' || it.def.type === 'forklift');
    const power = [...this.items.values()].reduce((s, it) => s + (it.def.type === 'transformer' ? 0 : num(it.live.power)), 0);
    const running = [...this.items.values()].filter((it) => it.live.status === 'Running').length;
    const alarms = this.alarms.filter((a) => !a.cleared && a.sev !== 'Info').length;
    return {
      oee: w ? o / w : 0, output: out, rate, target: num(this.settings['Shift Target (pcs)'], 560),
      agvActive: agvs.filter((a) => a.live.status === 'Running').length, agvTotal: agvs.length,
      power, running, total: this.items.size, alarms, asrs: this.asrsOccupancy ?? 0.7,
    };
  }
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
