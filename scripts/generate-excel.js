// Generates data/factory_data.xlsx from shared/catalog.js.
// Usage: npm run generate-data   (add --force to overwrite an existing file)
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EQUIPMENT, PRODUCT, ALARMS, SETTINGS, MES_COLUMNS, EQUIPMENT_COLUMNS, STATUSES, PLANT } from '../shared/catalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'data', 'factory_data.xlsx');
if (fs.existsSync(outFile) && !process.argv.includes('--force')) {
  console.log(`${path.relative(root, outFile)} already exists – use --force to regenerate (your edits would be lost).`);
  process.exit(0);
}

const wb = new ExcelJS.Workbook();
wb.creator = 'NEXUS Digital Twin';
wb.created = new Date();

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16222F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
const EDIT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7D6' } };
const thin = { style: 'thin', color: { argb: 'FFD0D7DE' } };

function styleSheet(ws, widths, { editableFrom = 0, editableCols = null } = {}) {
  ws.columns.forEach((c, i) => { c.width = widths[i] ?? 16; });
  const h = ws.getRow(1);
  h.height = 30;
  h.eachCell((c) => {
    c.fill = HEADER_FILL; c.font = HEADER_FONT;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = { top: thin, bottom: thin, left: thin, right: thin };
      const editable = editableCols ? editableCols.includes(col) : editableFrom && col >= editableFrom;
      if (editable) c.fill = EDIT_FILL;
    });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

// README ---------------------------------------------------------------
const readme = wb.addWorksheet('README', { properties: { tabColor: { argb: 'FF3A78D6' } } });
readme.columns = [{ width: 3 }, { width: 120 }];
const lines = [
  [`${PLANT.name} – Digital Twin data link`, { bold: true, size: 16 }],
  ['This workbook is the data source of the 3D factory digital twin (MES integration mock-up).', {}],
  ['', {}],
  ['HOW IT WORKS', { bold: true }],
  ['1. Start the twin with "npm start". The local dev server watches this file (data/factory_data.xlsx).', {}],
  ['2. Edit any yellow cell (e.g. Status, Availability %, Actual Rate) and SAVE the workbook (Ctrl+S).', {}],
  ['3. The server re-reads the file and pushes the new values to the browser over a WebSocket – the 3D view updates within ~1 s.', {}],
  ['', {}],
  ['SHEETS', { bold: true }],
  ['Settings – plant name, simulation on/off, simulation speed and random event rate.', {}],
  ['Equipment – master data (name, category, zone, manufacturer, model …). The ID column links rows to the 3D model.', {}],
  ['MES – live KPIs per equipment. Status values: ' + STATUSES.join(', ') + '. OEE % is a formula (A × P × Q).', {}],
  ['Specs – technical specification, one row per parameter (ID, Group, Parameter, Value, Unit). Add rows freely.', {}],
  ['Product BOM / Product Routing – the EB-200 product flow shown in the "Product flow" panel.', {}],
  ['Alarm Catalogue – alarm codes used by the live simulation when it generates random stops.', {}],
  ['', {}],
  ['TIPS', { bold: true }],
  ['• Set Status to "Down" and type an Active Alarm Code/Text – the machine stops, its beacon turns red and an alarm appears in the twin.', {}],
  ['• Set Simulation Enabled = No in Settings to freeze the twin exactly on the sheet values.', {}],
  ['• Cycle time changes the animation speed: a lower Actual Cycle makes the machine animate faster.', {}],
  ['• Do not rename the ID values – they are the keys to the 3D objects.', {}],
];
lines.forEach(([t, f], i) => {
  const c = readme.getCell(i + 2, 2);
  c.value = t;
  c.font = { name: 'Calibri', size: 11, ...f };
});

// Settings --------------------------------------------------------------
const st = wb.addWorksheet('Settings', { properties: { tabColor: { argb: 'FF7B8794' } } });
st.addRow(['Key', 'Value', 'Description']);
SETTINGS.forEach((r) => st.addRow(r));
styleSheet(st, [26, 30, 70], { editableCols: [2] });
st.getCell('B3').dataValidation = { type: 'list', allowBlank: false, formulae: ['"Yes,No"'] };

// Equipment -------------------------------------------------------------
const eq = wb.addWorksheet('Equipment', { properties: { tabColor: { argb: 'FF1BA6A6' } } });
eq.addRow(EQUIPMENT_COLUMNS.map((c) => c[1]));
EQUIPMENT.forEach((d) => eq.addRow(EQUIPMENT_COLUMNS.map(([k]) => d[k] ?? '')));
styleSheet(eq, [11, 38, 22, 24, 12, 10, 24, 30, 24, 8, 18], { editableCols: [2, 7, 8, 9, 10] });

// MES -------------------------------------------------------------------
const ms = wb.addWorksheet('MES', { properties: { tabColor: { argb: 'FF29B36B' } } });
ms.addRow(MES_COLUMNS.map((c) => c[1]));
const colOf = (key) => MES_COLUMNS.findIndex((c) => c[0] === key) + 1;
const L = (key) => ms.getColumn(colOf(key)).letter;
EQUIPMENT.forEach((d, i) => {
  const r = i + 2;
  const m = d.mes;
  const row = MES_COLUMNS.map(([k]) => {
    if (k === 'id') return d.id;
    if (k === 'oee') return { formula: `ROUND(${L('availability')}${r}*${L('performance')}${r}*${L('quality')}${r}/10000,1)`, result: Math.round((m.availability * m.performance * m.quality) / 1000) / 10 };
    if (k === 'alarmCode' || k === 'alarmText') return '';
    return m[k] ?? '';
  });
  ms.addRow(row);
});
styleSheet(ms, [11, 13, 13, 30, 13, 13, 11, 10, 12, 12, 11, 11, 12, 12, 10, 10, 10, 12, 10, 14, 15, 15, 12, 36], { editableCols: MES_COLUMNS.map((_, i) => i + 1).filter((c) => c !== 1 && c !== colOf('oee')) });
const n = EQUIPMENT.length + 1;
ms.dataValidations.add(`${L('status')}2:${L('status')}${n}`, { type: 'list', allowBlank: false, formulae: [`"${STATUSES.join(',')}"`], showErrorMessage: true, errorTitle: 'Status', error: 'Choose one of: ' + STATUSES.join(', ') });
for (const k of ['availability', 'performance', 'quality']) {
  ms.dataValidations.add(`${L(k)}2:${L(k)}${n}`, { type: 'decimal', operator: 'between', formulae: [0, 100], showErrorMessage: true, error: 'Enter a percentage between 0 and 100' });
}
ms.addConditionalFormatting({
  ref: `${L('oee')}2:${L('oee')}${n}`,
  rules: [{ type: 'colorScale', priority: 1, cfvo: [{ type: 'num', value: 50 }, { type: 'num', value: 75 }, { type: 'num', value: 95 }], color: [{ argb: 'FFF8696B' }, { argb: 'FFFFEB84' }, { argb: 'FF63BE7B' }] }],
});
const statusColors = { Running: 'FFC6EFCE', Idle: 'FFFFEB9C', Setup: 'FFDDEBF7', Down: 'FFFFC7CE', Maintenance: 'FFBDD7EE', Offline: 'FFD9D9D9' };
ms.addConditionalFormatting({
  ref: `${L('status')}2:${L('status')}${n}`,
  rules: Object.entries(statusColors).map(([s, c], i) => ({ type: 'containsText', operator: 'containsText', text: s, priority: 2 + i, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: c } } } })),
});
ms.getColumn(colOf('oee')).font = { bold: true };

// Specs -----------------------------------------------------------------
const sp = wb.addWorksheet('Specs', { properties: { tabColor: { argb: 'FFE0892B' } } });
sp.addRow(['ID', 'Group', 'Parameter', 'Value', 'Unit']);
EQUIPMENT.forEach((d) => (d.specs || []).forEach((s) => sp.addRow([d.id, ...s])));
styleSheet(sp, [11, 18, 34, 44, 12], { editableCols: [2, 3, 4, 5] });

// Product ---------------------------------------------------------------
const bom = wb.addWorksheet('Product BOM', { properties: { tabColor: { argb: 'FF8A5CF0' } } });
bom.addRow(['Part No.', 'Description', 'Qty', 'Unit', 'Source']);
PRODUCT.bom.forEach((r) => bom.addRow(r));
styleSheet(bom, [12, 46, 8, 8, 26]);
const rt = wb.addWorksheet('Product Routing', { properties: { tabColor: { argb: 'FF8A5CF0' } } });
rt.addRow(['Step', 'Operation', 'Equipment', 'Output', 'Flow']);
PRODUCT.routing.forEach((r) => rt.addRow([r.step, r.op, r.equipment.join(', '), r.output, r.flow]));
styleSheet(rt, [8, 36, 40, 26, 12], { editableCols: [2, 3, 4] });

// Alarms ----------------------------------------------------------------
const al = wb.addWorksheet('Alarm Catalogue', { properties: { tabColor: { argb: 'FFD64545' } } });
al.addRow(['Code', 'Equipment Type', 'Severity', 'Text']);
ALARMS.forEach((r) => al.addRow(r));
styleSheet(al, [10, 16, 10, 56], { editableCols: [3, 4] });

fs.mkdirSync(path.dirname(outFile), { recursive: true });
await wb.xlsx.writeFile(outFile);
console.log(`Wrote ${path.relative(root, outFile)} (${EQUIPMENT.length} equipment items).`);
