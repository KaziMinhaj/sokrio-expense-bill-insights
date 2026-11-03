// Web Worker: Excel parsing for TA/DA Insights
// This file runs in a Web Worker context
import * as XLSX from 'xlsx';
import type { WorkerRequest, WorkerMessage, MonthlyDataset } from '../types';
import { parseHeaderMeta, findHeaderRow, buildColumnMap, parseRows } from '../lib/parser';
import { reconcile, computeStats } from '../lib/reconcile';
import { toYearMonth } from '../lib/dateUtils';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { buffer, fileName } = e.data;

  try {
    post({ type: 'PROGRESS', message: 'Reading workbook…', percent: 5 });

    const wb = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      raw: true,
      cellDates: false,
    });

    const allDatasets: MonthlyDataset[] = [];
    let sheetIndex = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      post({
        type: 'PROGRESS',
        message: `Parsing sheet "${sheetName}"…`,
        percent: 10 + (sheetIndex / wb.SheetNames.length) * 70,
      });

      // Convert sheet to array of arrays (raw values)
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        raw: true,
      });

      if (raw.length < 5) {
        post({
          type: 'PROGRESS',
          message: `Sheet "${sheetName}" has too few rows, skipping`,
          percent: 15,
        });
        continue;
      }

      // Find header row
      const headerIdx = findHeaderRow(raw);
      if (headerIdx === -1) {
        post({
          type: 'PROGRESS',
          message: `Sheet "${sheetName}": header row (SL) not found, skipping`,
          percent: 15,
        });
        continue;
      }

      // Parse metadata from first 4 rows
      const meta = parseHeaderMeta(raw);

      // Build column map
      const colMap = buildColumnMap(raw[headerIdx]);

      post({ type: 'PROGRESS', message: 'Parsing rows…', percent: 40 });

      // Parse all data rows
      const { rows: allRows, messages } = parseRows(raw, headerIdx, colMap, meta.dateRange);

      post({ type: 'PROGRESS', message: 'Grouping by month…', percent: 70 });

      // Group rows by month
      const monthMap = new Map<string, typeof allRows>();
      for (const row of allRows) {
        const m = row.month;
        if (!monthMap.has(m)) monthMap.set(m, []);
        monthMap.get(m)!.push(row);
      }

      const now = Date.now();

      for (const [month, rows] of monthMap) {
        post({ type: 'PROGRESS', message: `Reconciling ${month}…`, percent: 80 });

        // For multi-month files, we use the header meta as-is for the month
        // (the header totals match all rows in the file; per-month they may differ)
        // We create a synthetic meta per month
        const monthMeta = monthMap.size === 1 ? meta : {
          ...meta,
          totals: {
            transport: rows.filter(r => r.allowanceType === 'Transportation').reduce((s, r) => s + r.submitAmount, 0),
            allowance: rows.filter(r => r.allowanceType === 'Daily Allowance').reduce((s, r) => s + r.submitAmount, 0),
            accommodation: rows.filter(r => r.allowanceType === 'Accommodation').reduce((s, r) => s + r.submitAmount, 0),
            otherCosts: rows.filter(r => r.allowanceType === 'Others').reduce((s, r) => s + r.submitAmount, 0),
            submitAmount: rows.reduce((s, r) => s + r.submitAmount, 0),
            payableAmount: rows.reduce((s, r) => s + r.payableAmount, 0),
          },
        };

        const reconciliation = reconcile(rows, monthMeta, messages);
        const stats = computeStats(rows);

        // For single-month files, use the original meta (with header totals for reconciliation)
        const finalMeta = monthMap.size === 1 ? meta : monthMeta;

        allDatasets.push({
          id: month,
          month,
          uploadedAt: now,
          fileName,
          meta: finalMeta,
          rows,
          reconciliation,
          stats,
        });
      }

      sheetIndex++;
    }

    post({ type: 'PROGRESS', message: 'Done!', percent: 100 });
    post({ type: 'RESULT', datasets: allDatasets, errors: [] });
  } catch (err) {
    post({ type: 'ERROR', message: String(err) });
  }
};

function post(msg: WorkerMessage) {
  self.postMessage(msg);
}
