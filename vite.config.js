import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parseWorkbook } from './shared/parseWorkbook.js';

const DATA_FILE = path.resolve(process.env.FACTORY_XLSX || 'data/factory_data.xlsx');

async function readData(retries = 4) {
  for (let i = 0; ; i++) {
    try {
      const buf = await fs.promises.readFile(DATA_FILE);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const data = parseWorkbook(wb, path.basename(DATA_FILE));
      data.mtime = (await fs.promises.stat(DATA_FILE)).mtime.toISOString();
      return data;
    } catch (err) {
      // Excel writes via temp file + rename; the file can be briefly locked or incomplete.
      if (i >= retries) throw err;
      await new Promise((r) => setTimeout(r, 350));
    }
  }
}

/**
 * Live Excel link: serves the parsed workbook as JSON, watches the .xlsx file and
 * pushes every saved change to all connected browsers over Vite's WebSocket.
 * For static builds (GitHub Pages) the workbook is snapshotted into the bundle.
 */
function excelLiveLink() {
  let server;
  let timer;
  const isDataFile = (f) => path.resolve(f) === DATA_FILE;

  const push = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const data = await readData();
        server.ws.send({ type: 'custom', event: 'factory:data', data });
        server.config.logger.info(`\x1b[32m[excel-link]\x1b[0m ${path.basename(DATA_FILE)} changed → pushed to ${server.ws.clients?.size ?? 'all'} client(s)`, { timestamp: true });
      } catch (err) {
        server.ws.send({ type: 'custom', event: 'factory:error', data: { message: String(err.message || err) } });
        server.config.logger.error(`[excel-link] could not read workbook: ${err.message}`);
      }
    }, 250);
  };

  return {
    name: 'excel-live-link',
    configureServer(s) {
      server = s;
      server.watcher.add(DATA_FILE);
      const onFs = (f) => { if (isDataFile(f)) push(); };
      server.watcher.on('change', onFs);
      server.watcher.on('add', onFs);
      server.middlewares.use(async (req, res, next) => {
        const url = req.url.split('?')[0];
        if (url === '/api/factory-data.json') {
          try {
            const data = await readData();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(data));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err.message || err) }));
          }
          return;
        }
        if (url === '/data/factory_data.xlsx') {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename="factory_data.xlsx"');
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(DATA_FILE).pipe(res);
          return;
        }
        next();
      });
      server.httpServer?.once('listening', () => {
        setTimeout(() => server.config.logger.info(`\x1b[36m[excel-link]\x1b[0m watching ${path.relative(process.cwd(), DATA_FILE)} – edit & save it to update the twin live`), 50);
      });
    },
    handleHotUpdate(ctx) {
      if (isDataFile(ctx.file)) return [];
    },
    async generateBundle() {
      const data = await readData();
      data.static = true;
      this.emitFile({ type: 'asset', fileName: 'data/factory_data.json', source: JSON.stringify(data) });
      this.emitFile({ type: 'asset', fileName: 'data/factory_data.xlsx', source: await fs.promises.readFile(DATA_FILE) });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [excelLiveLink()],
  server: { port: 5173, open: false, host: true },
  build: { chunkSizeWarningLimit: 2000, target: 'es2022' },
});
