// Small DOM helpers, formatting and SVG icon set.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const n = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : v === '' || v === undefined ? '–' : esc(v));
export const int = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v).toLocaleString('en-US') : '–');
export const time = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
export const STATUS_COLOR = { Running: '#29d17a', Idle: '#f2b418', Setup: '#3a9bff', Down: '#ff4d4d', Maintenance: '#8a7dff', Offline: '#6b7684' };
export function oeeColor(v) {
  if (!Number.isFinite(v)) return '#6b7684';
  return v >= 85 ? '#29d17a' : v >= 70 ? '#9bd12b' : v >= 55 ? '#f2b418' : '#ff4d4d';
}

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  imm: P('<rect x="2" y="9" width="20" height="8" rx="1.5"/><path d="M6 9V6h4v3M14 13h6M4 17v3M20 17v3"/><circle cx="17" cy="6" r="2"/>'),
  laser: P('<rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M12 4v6M10 10l2 3 2-3M3 19h18"/>'),
  bend: P('<path d="M3 20h18M5 20V9h14v11M8 4h8v5H8zM12 12l-4 5M12 12l4 5"/>'),
  press: P('<path d="M4 21h16M6 21V4M18 21V4M4 4h16M8 9h8v3H8zM9 16h6"/>'),
  robot: P('<path d="M5 21h8M9 21v-3M9 18l-3-6 6-5 5 3M17 10l3 3M20 13l-1 2"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="7" r="1.6"/>'),
  conveyor: P('<rect x="2" y="12" width="20" height="4" rx="2"/><circle cx="6" cy="14" r="1"/><circle cx="12" cy="14" r="1"/><circle cx="18" cy="14" r="1"/><rect x="5" y="6" width="5" height="5" rx="1"/><rect x="13" y="7" width="4" height="4" rx="1"/><path d="M5 16v4M19 16v4"/>'),
  asrs: P('<path d="M3 21V3M21 21V3M3 8h7M3 13h7M3 18h7M14 8h7M14 13h7M14 18h7M12 3v18"/><rect x="10.5" y="10" width="3" height="3"/>'),
  agv: P('<rect x="2" y="12" width="20" height="6" rx="2"/><path d="M6 12V8h9v4"/><circle cx="6" cy="19" r="1.2"/><circle cx="18" cy="19" r="1.2"/><path d="M22 15h1"/>'),
  assembly: P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14M14 17.5h-4a3 3 0 0 1-3-3V10"/>'),
  quality: P('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M8.5 11l2 2 3.5-4"/>'),
  pack: P('<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
  crane: P('<path d="M2 5h20M4 5v16M20 5v16M11 5v6"/><path d="M9 11h4v2h-4zM11 13v3"/><path d="M9 18a2 2 0 1 0 4 0"/>'),
  utility: P('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  close: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  focus: P('<path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/><circle cx="12" cy="12" r="3"/>'),
  eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: P('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  orbit: P('<ellipse cx="12" cy="12" rx="10" ry="4.5"/><circle cx="12" cy="12" r="2.5"/>'),
  walk: P('<circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 3v3M8 12l2-4h4l2 4 3 1M11 8l-1 5"/>'),
  tour: P('<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/>'),
  stop: P('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: P('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  label: P('<path d="M3 5h12l6 7-6 7H3z"/><circle cx="8" cy="12" r="1.5"/>'),
  heat: P('<path d="M12 22a6 6 0 0 0 6-6c0-4-3-6-4-10-1 3-3 4-4 6a3 3 0 0 1-2-3c-2 2-2 4-2 7a6 6 0 0 0 6 6z"/>'),
  flow: P('<path d="M3 7h13l-3-3M21 17H8l3 3"/>'),
  product: P('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 14h6"/>'),
  play: P('<path d="M7 5l12 7-12 7z"/>'),
  pause: P('<path d="M8 5v14M16 5v14"/>'),
  help: P('<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5"/>'),
  excel: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>'),
  download: P('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  upload: P('<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>'),
  check: P('<path d="M4 12l5 5L20 6"/>'),
  alarm: P('<path d="M12 3a6 6 0 0 1 6 6v5l2 3H4l2-3V9a6 6 0 0 1 6-6zM10 20a2 2 0 0 0 4 0"/>'),
  highlight: P('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'),
  xray: P('<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
  isolate: P('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="4"/>'),
  layers: P('<path d="M12 3 2 8l10 5 10-5z"/><path d="M2 13l10 5 10-5"/>'),
  gauge: P('<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>'),
};
