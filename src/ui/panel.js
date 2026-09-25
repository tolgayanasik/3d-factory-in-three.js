// Right-hand info panel: live MES KPIs, technical specs, generated drawing,
// and event history for the selected equipment.
import { CATEGORIES } from '../../shared/catalog.js';
import { $, h, ICONS, n, int, esc, time, STATUS_COLOR, oeeColor } from './util.js';
import { drawGauge, drawTrend } from './charts.js';
import { generateDrawing } from './drawing.js';

export class InfoPanel {
  constructor(app) {
    this.app = app;
    this.store = app.store;
    this.el = $('#info-panel');
    this.id = null;
    this.tab = 'mes';
    this.lastFlash = new Map();
  }

  show(id) {
    this.id = id;
    document.body.classList.toggle('info-open', !!id);
    if (!id) { this.el.classList.add('hidden'); return; }
    this.el.classList.remove('hidden');
    this.build();
  }

  build() {
    const it = this.store.items.get(this.id);
    if (!it) return;
    const cat = CATEGORIES.find((c) => c.key === it.info.category);
    const sel = this.app.selection;
    const modeBtn = (m, label, icon) => h('button', { class: `btn${sel.mode === m ? ' on' : ''}`, 'data-mode': m, html: `${ICONS[icon]}${label}`, onclick: () => { sel.setMode(m); this.syncModeButtons(); } });
    this.el.innerHTML = '';
    const head = h('div', { class: 'ip-head' },
      h('div', { class: 'ip-top' },
        h('div', { class: 'ico', html: ICONS[cat?.icon || 'layers'] }),
        h('div', { class: 'ip-title' }, h('h2', { id: 'ip-name' }, it.info.name), h('div', { class: 'sub', html: `<b>${esc(it.id)}</b> · ${esc(it.info.category)} · ${esc(it.info.zone)}` }), h('div', { id: 'ip-status' })),
        h('button', { class: 'icon-btn', title: 'Close (Esc)', html: ICONS.close, onclick: () => sel.select(null) })),
      h('div', { class: 'ip-actions' },
        modeBtn('highlight', 'Highlight', 'highlight'), modeBtn('xray', 'X-ray', 'xray'), modeBtn('isolate', 'Isolate', 'isolate'),
        h('button', { class: 'btn', html: `${ICONS.focus}Focus`, onclick: () => this.app.focus(this.id) }),
        it.def.type === 'agv' || it.def.type === 'forklift' ? h('button', { class: `btn${this.app.follow === this.id ? ' on' : ''}`, id: 'follow-btn', html: `${ICONS.walk}Follow`, onclick: () => this.app.toggleFollow(this.id) }) : null),
      h('div', { id: 'ip-alarm' }));
    const tabs = h('div', { class: 'tabs' }, ...[['mes', 'MES Live'], ['specs', 'Tech Specs'], ['drawing', 'Drawing'], ['events', 'Events']].map(([k, l]) => h('button', { class: this.tab === k ? 'on' : '', onclick: () => { this.tab = k; this.build(); } }, l)));
    this.body = h('div', { class: 'tab-body' });
    this.el.append(head, tabs, this.body);
    ({ mes: () => this.buildMES(it), specs: () => this.buildSpecs(it), drawing: () => this.buildDrawing(it), events: () => this.buildEvents(it) })[this.tab]();
    this.update(true);
  }

  syncModeButtons() {
    this.el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === this.app.selection.mode));
  }

  // ---------------------------------------------------------------- MES
  buildMES(it) {
    const isAgv = it.def.type === 'agv' || it.def.type === 'forklift';
    const b = this.body;
    if (isAgv) b.append(h('div', { class: 'agv-state', id: 'agv-state' }));
    b.append(h('div', { class: 'sec-title' }, 'Overall equipment effectiveness'));
    this.gauge = h('canvas', { width: 136, height: 136, style: { width: '136px', height: '136px' } });
    const apq = h('div', { class: 'apq' });
    this.bars = {};
    for (const [k, l] of [['availability', 'Availability'], ['performance', 'Performance'], ['quality', 'Quality']]) {
      const fill = h('i');
      const val = h('span', { class: 'val' });
      apq.append(h('div', { class: 'row' }, h('span', { class: 'lbl' }, l), h('span', { class: 'track' }, fill), val));
      this.bars[k] = { fill, val };
    }
    apq.append(h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'OEE = Availability × Performance × Quality'));
    b.append(h('div', { class: 'oee-row' }, this.gauge, apq));
    b.append(h('div', { class: 'sec-title' }, 'Throughput & production'));
    this.tiles = h('div', { class: 'tiles' });
    b.append(this.tiles);
    b.append(h('div', { class: 'sec-title' }, 'Trend (live)'));
    this.trend = h('canvas');
    b.append(h('div', { class: 'chart-box' }, this.trend, h('div', { class: 'chart-legend', html: '<span><i style="background:#33e1ff"></i>OEE %</span><span><i style="background:#f2b418"></i>Actual rate /h</span>' })));
    b.append(h('div', { class: 'sec-title' }, 'Order & maintenance'));
    this.kv = h('div', { class: 'kv' });
    b.append(this.kv);
    b.append(h('div', { class: 'excel-hint', html: `Values come from <code>MES</code> sheet row <code>${esc(it.id)}</code> of <code>${esc(this.store.link.source)}</code>. Edit & save the workbook – the twin updates live.` }));
  }

  tile(k, v, unit = '', d = '', cls = '', wide = false) {
    return `<div class="tile${wide ? ' wide' : ''}"><div class="k">${k}</div><div class="v">${v}<small> ${unit}</small></div>${d ? `<div class="d ${cls}">${d}</div>` : ''}</div>`;
  }

  update(force = false) {
    if (!this.id) return;
    const it = this.store.items.get(this.id);
    if (!it) return;
    const l = it.live, b = it.base;
    const st = l.status;
    const stEl = $('#ip-status', this.el);
    if (stEl) stEl.innerHTML = `<span class="status-pill pill-${st}"><i style="background:${STATUS_COLOR[st]}"></i>${st}${it.sim.reason && st !== 'Running' ? ' · simulated' : ''}</span>`;
    const nm = $('#ip-name', this.el);
    if (nm && nm.textContent !== it.info.name) nm.textContent = it.info.name;
    const al = $('#ip-alarm', this.el);
    if (al) {
      const code = l.alarmCode, text = l.alarmText;
      al.innerHTML = code || (st === 'Down' && text) ? '' : '';
      if (code || text) {
        al.append(h('div', { class: 'alarm-banner', html: `${ICONS.alarm.replace('<svg', '<svg width="16" height="16"')}<span><b>${esc(code)}</b> ${esc(text)}</span>` },
          it.sim.reason ? h('button', { class: 'btn', onclick: () => this.store.acknowledge(it.id) }, 'Reset') : null));
      }
    }
    if (this.tab !== 'mes' || !this.gauge) return;
    const eq = this.app.ctx.get(this.id);
    const isAgv = it.def.type === 'agv' || it.def.type === 'forklift';
    if (isAgv && eq) {
      const bat = eq.battery;
      const col = bat > 50 ? '#29d17a' : bat > 25 ? '#f2b418' : '#ff4d4d';
      $('#agv-state', this.el).innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:6px"><b>${esc(eq.stateText)}</b><span class="muted">${(eq.v || 0).toFixed(1)} m/s</span></div>
        <div class="batt"><span class="muted small">Battery</span><span class="cell"><i style="width:${bat}%;background:${col}"></i></span><b>${bat.toFixed(0)}%</b></div>
        <div class="muted small" style="margin-top:6px">Mission: ${esc(l.part)} · Load: ${eq.load ? 'Yes' : 'Empty'} · Pos: ${eq.worldPos.x.toFixed(1)}, ${eq.worldPos.z.toFixed(1)}</div>`;
    }
    drawGauge(this.gauge, l.oee);
    for (const k of ['availability', 'performance', 'quality']) {
      const v = l[k];
      this.bars[k].fill.style.width = `${Math.max(0, Math.min(100, v))}%`;
      this.bars[k].fill.style.background = oeeColor(k === 'quality' ? v - 10 : v + 5);
      this.bars[k].val.textContent = `${n(v)}%`;
    }
    const tgt = Number(b.targetRate) || 0;
    const act = l.actualRate || 0;
    const ratio = tgt ? (act / tgt) * 100 : 0;
    const yieldPct = l.good + l.scrap > 0 ? (l.good / (l.good + l.scrap)) * 100 : 100;
    const nextM = b.nextMaint ? Math.round((new Date(b.nextMaint) - new Date()) / 86400000) : null;
    this.tiles.innerHTML = [
      this.tile('Actual rate', n(act, 0), 'pcs/h', tgt ? `${ratio.toFixed(0)} % of target ${n(tgt, 0)}` : '', ratio >= 90 ? 'up' : 'down'),
      this.tile('Cycle time', n(l.actualCycle, 1), 's', b.idealCycle ? `ideal ${n(b.idealCycle, 1)} s` : ''),
      this.tile('Good parts (shift)', int(l.good), 'pcs', `yield ${yieldPct.toFixed(2)} %`, yieldPct > 99 ? 'up' : 'down'),
      this.tile('Scrap (shift)', int(l.scrap), 'pcs', `${(100 - yieldPct).toFixed(2)} %`, ''),
      this.tile('MTBF', n(Number(b.mtbf), 0), 'h', `MTTR ${n(Number(b.mttr), 0)} min`),
      this.tile('Power', n(l.power, 1), 'kW', `${n(l.energy, 0)} kWh today`),
    ].join('');
    const hist = it.history;
    const maxRate = Math.max(10, tgt * 1.2, ...hist.map((x) => x.rate));
    drawTrend(this.trend, [
      { data: hist.map((x) => x.oee), color: '#33e1ff', fill: 'rgba(51,225,255,0.18)' },
      { data: hist.map((x) => x.rate), color: '#f2b418' },
    ], { max1: 100, max2: Math.ceil(maxRate / 10) * 10, labels: [hist.length ? `-${Math.round((hist.length * 2) / 60)} min` : '', 'now'] });
    const rows = [
      ['Work order', b.order], ['Part / activity', b.part], ['Operator', b.operator],
      ['Last maintenance', b.lastMaint], ['Next maintenance', `${b.nextMaint || '–'}${nextM !== null && Number.isFinite(nextM) ? ` (${nextM} d)` : ''}`],
      ...(b.battery !== '' && !isAgv ? [['Battery', `${b.battery} %`]] : []),
    ];
    this.kv.innerHTML = rows.map(([k, v]) => `<div>${esc(k)}</div><div>${esc(v ?? '–')}</div>`).join('');
    if (force) return;
  }

  // ---------------------------------------------------------------- Specs
  buildSpecs(it) {
    const b = this.body;
    b.append(h('div', { class: 'sec-title' }, 'Asset information'));
    const kv = h('div', { class: 'kv' });
    kv.innerHTML = [['Manufacturer', it.info.manufacturer], ['Model', it.info.model], ['Serial no.', it.info.serial], ['Year of manufacture', it.info.year], ['Drawing no.', it.info.drawingNo], ['Parent', it.info.parent || '–'], ['Location', `${it.info.zone} (${it.def.pos[0].toFixed(1)}, ${it.def.pos[1].toFixed(1)})`]]
      .map(([k, v]) => `<div>${esc(k)}</div><div>${esc(v)}</div>`).join('');
    b.append(kv);
    const groups = new Map();
    for (const [g, p, v, u] of it.specs) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push([p, v, u]); }
    for (const [g, rows] of groups) {
      b.append(h('div', { class: 'sec-title' }, g));
      const t = h('table', { class: 'spec-table' });
      t.innerHTML = rows.map(([p, v, u]) => `<tr><td>${esc(p)}</td><td>${esc(typeof v === 'number' ? v.toLocaleString('en-US') : v)}<span class="unit">${esc(u || '')}</span></td></tr>`).join('');
      b.append(t);
    }
    b.append(h('div', { class: 'excel-hint', html: `Specifications are read from the <code>Specs</code> sheet (ID <code>${esc(it.id)}</code>). Add or edit rows to change this list.` }));
  }

  // ---------------------------------------------------------------- Drawing
  buildDrawing(it) {
    const b = this.body;
    b.append(h('div', { class: 'sec-title' }, 'General arrangement drawing'));
    const wrap = h('div', { class: 'drawing-wrap' }, h('div', { class: 'muted', style: { padding: '40px', textAlign: 'center' } }, 'Generating drawing from 3D model…'));
    b.append(wrap);
    b.append(h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Orthographic views are rendered live from the digital-twin geometry. Click to open full size.'));
    setTimeout(() => {
      const eq = this.app.ctx.get(it.id);
      const url = eq && generateDrawing(eq, it.info);
      wrap.innerHTML = '';
      if (!url) { wrap.append(h('div', { class: 'muted', style: { padding: '30px' } }, 'No geometry')); return; }
      const img = h('img', { src: url, alt: `Drawing ${it.info.drawingNo}` });
      wrap.append(img);
      wrap.onclick = () => { const w = window.open(); if (w) { w.document.title = it.info.drawingNo; w.document.body.style.margin = '0'; w.document.body.style.background = '#0c2a4d'; const im = w.document.createElement('img'); im.src = url; im.style.width = '100%'; w.document.body.append(im); } };
      b.append(h('a', { class: 'btn', style: { marginTop: '10px' }, href: url, download: `${it.info.drawingNo}.png`, html: `${ICONS.download}Download PNG` }));
    }, 30);
  }

  // ---------------------------------------------------------------- Events
  buildEvents(it) {
    const list = this.store.alarms.filter((a) => a.id === it.id);
    this.body.append(h('div', { class: 'sec-title' }, `Alarm & event history (${list.length})`));
    if (!list.length) this.body.append(h('div', { class: 'muted', style: { padding: '10px 0' } }, 'No events recorded in this session.'));
    for (const a of list) {
      this.body.append(h('div', { class: 'ev', html: `<span class="sev sev-${a.sev}">${a.sev}</span><div style="flex:1"><div><b style="font-family:var(--mono)">${esc(a.code)}</b> ${esc(a.text)}</div><div class="when">${time(a.time)}${a.cleared ? ` → cleared ${time(a.cleared)}` : ' · active'} · ${a.src === 'excel' ? 'from Excel' : 'MES simulation'}</div></div>` }));
    }
  }
}
