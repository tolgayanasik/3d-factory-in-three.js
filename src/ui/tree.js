// Equipment tree grouped by category or zone, with search, live status dots,
// OEE, visibility toggles and click-to-select.
import { CATEGORIES, ZONES } from '../../shared/catalog.js';
import { $, $$, h, ICONS, STATUS_COLOR, oeeColor } from './util.js';

export class Tree {
  constructor(store, selection, onFocus) {
    this.store = store;
    this.sel = selection;
    this.onFocus = onFocus;
    this.el = $('#tree');
    this.groupBy = 'category';
    this.filter = '';
    this.open = new Set(['Plastic Injection', 'Injection Moulding Hall']);
    this.rows = new Map();
    $('#tree-search').addEventListener('input', (e) => { this.filter = e.target.value.trim().toLowerCase(); this.render(); });
    $$('#group-by button').forEach((b) => b.addEventListener('click', () => {
      $$('#group-by button').forEach((x) => x.classList.toggle('on', x === b));
      this.groupBy = b.dataset.v;
      this.render();
    }));
    $$('#sel-mode button').forEach((b) => b.addEventListener('click', () => {
      this.sel.setMode(b.dataset.v);
      if (!this.sel.selected) this.sel.mode = b.dataset.v;
    }));
    this.sel.onModeChange = (m) => $$('#sel-mode button').forEach((x) => x.classList.toggle('on', x.dataset.v === m));
    this.sel.onSelect((id) => this.markSelected(id));
    $('#tree-foot').innerHTML = Object.entries(STATUS_COLOR).map(([k, c]) => `<span class="legend"><i style="background:${c}"></i>${k}</span>`).join('');
    this.render();
  }

  groups() {
    const items = [...this.store.items.values()];
    const f = this.filter;
    const match = (it) => !f || [it.id, it.info.name, it.info.model, it.info.manufacturer, it.info.category, it.info.zone].some((v) => String(v).toLowerCase().includes(f));
    const keys = this.groupBy === 'category' ? CATEGORIES.map((c) => c.key) : ZONES.map((z) => z.key);
    const out = [];
    for (const k of keys) {
      const list = items.filter((it) => (this.groupBy === 'category' ? it.info.category : it.info.zone) === k && match(it));
      if (list.length) out.push([k, list]);
    }
    // any categories added in Excel that are not in the catalog
    const known = new Set(keys);
    const extra = new Map();
    for (const it of items) { const k = this.groupBy === 'category' ? it.info.category : it.info.zone; if (!known.has(k) && match(it)) { if (!extra.has(k)) extra.set(k, []); extra.get(k).push(it); } }
    for (const [k, l] of extra) out.push([k, l]);
    return out;
  }

  icon(key) {
    const c = CATEGORIES.find((x) => x.key === key);
    if (c) return ICONS[c.icon];
    const map = { 'Injection Moulding Hall': 'imm', 'Sheet Metal Shop': 'bend', 'Central AS/RS': 'asrs', 'Assembly Hall': 'assembly', 'Quality Lab': 'quality', 'Control Room': 'gauge', Shipping: 'pack', Utilities: 'utility', Logistics: 'agv' };
    return ICONS[map[key] || 'layers'];
  }

  render() {
    this.el.innerHTML = '';
    this.rows.clear();
    for (const [key, list] of this.groups()) {
      const open = this.open.has(key) || !!this.filter;
      const cat = h('div', { class: `cat${open ? ' open' : ''}` });
      const mini = h('span', { class: 'mini' });
      const head = h('div', { class: 'cat-head', onclick: () => { cat.classList.toggle('open'); if (cat.classList.contains('open')) this.open.add(key); else this.open.delete(key); } },
        h('span', { class: 'chev' }, '▶'), h('span', { class: 'ico', html: this.icon(key) }), h('span', { class: 'name' }, key), mini, h('span', { class: 'cnt' }, list.length));
      const body = h('div', { class: 'cat-items' });
      // children (e.g. take-out robots) listed below their parent when grouping by zone
      for (const it of list) {
        const row = this.row(it);
        body.append(row);
      }
      cat.append(head, body);
      cat._mini = mini;
      cat._list = list;
      this.el.append(cat);
    }
    this.refresh();
    this.markSelected(this.sel.selected);
  }

  row(it) {
    const eye = h('button', { class: `eye${this.sel.hidden.has(it.id) ? ' off' : ''}`, title: 'Show / hide in 3D', html: this.sel.hidden.has(it.id) ? ICONS.eyeOff : ICONS.eye, onclick: (e) => {
      e.stopPropagation();
      const hide = !this.sel.hidden.has(it.id);
      this.sel.toggleHidden(it.id, hide);
      eye.classList.toggle('off', hide);
      eye.innerHTML = hide ? ICONS.eyeOff : ICONS.eye;
    } });
    eye.style.width = '22px';
    const sd = h('span', { class: 'sd' });
    const oee = h('span', { class: 'oee' });
    const n1 = h('div', { class: 'n1' }, it.info.name);
    const row = h('div', { class: `node${it.def.parent && this.groupBy === 'zone' ? ' child' : ''}`, 'data-id': it.id, title: `${it.info.name}\n${it.info.manufacturer} ${it.info.model}`,
      onclick: () => this.sel.select(it.id, { source: 'tree' }),
      ondblclick: () => this.onFocus?.(it.id) },
    sd, h('div', { class: 'nm' }, n1, h('div', { class: 'n2' }, it.id)), oee, eye);
    row.style.cssText = 'display:flex';
    this.rows.set(it.id, { row, sd, oee, n1 });
    return row;
  }

  refresh() {
    for (const [id, r] of this.rows) {
      const it = this.store.items.get(id);
      const st = it.live.status;
      r.sd.style.background = STATUS_COLOR[st] || '#6b7684';
      r.sd.style.boxShadow = st === 'Down' ? '0 0 0 3px rgba(255,77,77,0.25)' : 'none';
      const showOee = it.def.type !== 'rack' && Number(it.base.targetRate) > 0;
      r.oee.textContent = showOee ? `${it.live.oee.toFixed(0)}%` : '';
      r.oee.style.color = showOee ? oeeColor(it.live.oee) : '';
      if (r.n1.textContent !== it.info.name) r.n1.textContent = it.info.name;
    }
    for (const cat of this.el.children) {
      const counts = {};
      cat._list.forEach((it) => { counts[it.live.status] = (counts[it.live.status] || 0) + 1; });
      cat._mini.innerHTML = ['Down', 'Idle', 'Maintenance', 'Setup'].filter((s) => counts[s]).map((s) => `<i style="background:${STATUS_COLOR[s]}" title="${counts[s]} ${s}"></i>`).join('');
    }
  }

  markSelected(id) {
    for (const [rid, r] of this.rows) r.row.classList.toggle('sel', rid === id);
    if (id) {
      const r = this.rows.get(id);
      if (r) {
        const cat = r.row.closest('.cat');
        if (!cat.classList.contains('open')) { cat.classList.add('open'); this.open.add(cat.querySelector('.name').textContent); }
        r.row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  flash(ids) {
    for (const id of ids) { const r = this.rows.get(id); if (r) { r.row.classList.remove('flash'); void r.row.offsetWidth; r.row.classList.add('flash'); } }
  }
}
