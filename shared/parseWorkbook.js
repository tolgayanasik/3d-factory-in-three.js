// Converts an ExcelJS workbook (Node or browser) into the plain JSON model used
// by the digital twin. Columns are matched by header text, so the sheet can be
// re-ordered or extended without breaking the link.
import { MES_COLUMNS, EQUIPMENT_COLUMNS } from './catalog.js';

export function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('formula' in v || 'sharedFormula' in v) return '';
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return cellValue(v.text);
    if ('error' in v) return '';
    return String(v);
  }
  return v;
}

function num(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : v;
}

const NUMERIC_MES = new Set(['availability', 'performance', 'quality', 'oee', 'targetRate', 'actualRate', 'idealCycle', 'actualCycle', 'good', 'scrap', 'mtbf', 'mttr', 'power', 'energy', 'battery']);

function readTable(ws) {
  if (!ws) return { headers: [], rows: [] };
  // Find header row: first row whose first cell reads like a header ("ID", "Key", "Step", ...)
  let headerRow = 1;
  for (let r = 1; r <= Math.min(ws.rowCount, 8); r++) {
    const first = String(cellValue(ws.getRow(r).getCell(1).value)).trim().toLowerCase();
    if (['id', 'key', 'setting', 'step', 'code', 'part no.', 'part no'].includes(first)) { headerRow = r; break; }
  }
  const hr = ws.getRow(headerRow);
  const headers = [];
  hr.eachCell({ includeEmpty: true }, (cell, col) => { headers[col - 1] = String(cellValue(cell.value)).trim(); });
  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals = headers.map((_, i) => cellValue(row.getCell(i + 1).value));
    if (vals.every((v) => v === '' || v === null)) continue;
    rows.push(vals);
  }
  return { headers, rows };
}

function mapColumns(headers, spec) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9%]/g, '');
  const idx = {};
  for (const [key, label] of spec) {
    const i = headers.findIndex((h) => norm(h) === norm(label));
    if (i >= 0) idx[key] = i;
  }
  return idx;
}

export function parseWorkbook(wb, source = 'factory_data.xlsx') {
  const get = (name) => wb.worksheets.find((w) => w.name.toLowerCase() === name.toLowerCase());
  const out = { source, loadedAt: new Date().toISOString(), settings: {}, equipment: {}, mes: {}, specs: {}, product: { bom: [], routing: [] }, alarms: [], warnings: [] };

  // Settings
  const st = readTable(get('Settings'));
  for (const r of st.rows) if (r[0] !== '') out.settings[String(r[0]).trim()] = r[1];

  // Equipment master
  const eq = readTable(get('Equipment'));
  const eqIdx = mapColumns(eq.headers, EQUIPMENT_COLUMNS);
  for (const r of eq.rows) {
    const id = String(r[eqIdx.id ?? 0]).trim();
    if (!id) continue;
    const rec = {};
    for (const [k, i] of Object.entries(eqIdx)) rec[k] = r[i];
    rec.id = id;
    out.equipment[id] = rec;
  }

  // MES
  const ms = readTable(get('MES'));
  const msIdx = mapColumns(ms.headers, MES_COLUMNS);
  if (msIdx.id === undefined) out.warnings.push('MES sheet: "ID" column not found');
  for (const r of ms.rows) {
    const id = String(r[msIdx.id ?? 0]).trim();
    if (!id) continue;
    const rec = {};
    for (const [k, i] of Object.entries(msIdx)) rec[k] = NUMERIC_MES.has(k) ? num(r[i]) : r[i];
    rec.id = id;
    out.mes[id] = rec;
  }

  // Specs (long format)
  const sp = readTable(get('Specs'));
  for (const r of sp.rows) {
    const id = String(r[0]).trim();
    if (!id) continue;
    (out.specs[id] ||= []).push([r[1], r[2], r[3], r[4]]);
  }

  // Product
  const bom = readTable(get('Product BOM'));
  out.product.bom = bom.rows.map((r) => r.slice(0, 5));
  const rt = readTable(get('Product Routing'));
  out.product.routing = rt.rows.map((r) => ({ step: r[0], op: r[1], equipment: String(r[2]).split(/[,;\s]+/).filter(Boolean), output: r[3], flow: r[4] }));

  // Alarm catalogue
  const al = readTable(get('Alarm Catalogue'));
  out.alarms = al.rows.map((r) => r.slice(0, 4));
  return out;
}
