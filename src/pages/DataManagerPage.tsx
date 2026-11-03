// DataManager page for TA/DA Insights
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useDatasets, deleteDataset, saveDataset } from '../hooks/useDatasets';
import { useParseWorker } from '../hooks/useParseWorker';
import { FileUpload } from '../components/FileUpload';
import { ReconciliationBadge } from '../components/ReconciliationBadge';
import { ConflictDialog, type ConflictAction } from '../components/ConflictDialog';
import { formatTaka } from '../lib/format';
import { reconcile, computeStats } from '../lib/reconcile';
import type { MonthlyDataset, MonthConflict } from '../types';

const MONTH_NAMES: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December',
};

function formatMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] ?? m} ${y}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function DataManagerPage() {
  const datasets = useDatasets();
  const { parsing, progress, error, parse, abort } = useParseWorker();
  const [conflicts, setConflicts] = useState<MonthConflict[]>([]);
  const [pendingDatasets, setPendingDatasets] = useState<MonthlyDataset[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleFile = (file: File) => {
    parse(file, async (incoming) => {
      if (!datasets) return;
      const storedMap = new Map(datasets.map(d => [d.id, d]));

      const newConflicts: MonthConflict[] = [];
      const toSaveNow: MonthlyDataset[] = [];

      for (const ds of incoming) {
        if (storedMap.has(ds.id)) {
          newConflicts.push({ month: ds.id, existingDataset: storedMap.get(ds.id)!, incomingDataset: ds });
        } else {
          toSaveNow.push(ds);
        }
      }

      // Save non-conflicting immediately
      for (const ds of toSaveNow) {
        await saveDataset(ds);
      }

      if (newConflicts.length > 0) {
        setConflicts(newConflicts);
        setPendingDatasets(incoming);
      }
    });
  };

  const handleConflictResolve = async (action: ConflictAction, month: string) => {
    const conflict = conflicts.find(c => c.month === month);
    if (!conflict) return;

    if (action === 'replace') {
      await saveDataset(conflict.incomingDataset);
    } else if (action === 'keep-both') {
      // Merge rows: deduplicate by SL, prefer incoming
      const existing = conflict.existingDataset;
      const incoming = conflict.incomingDataset;
      const slSeen = new Set<number>();
      const merged: typeof incoming.rows = [];

      for (const r of [...existing.rows, ...incoming.rows]) {
        if (!slSeen.has(r.sl)) {
          slSeen.add(r.sl);
          merged.push(r);
        }
      }
      merged.sort((a, b) => a.sl - b.sl);

      const newStats = computeStats(merged);
      const newRecon = reconcile(merged, incoming.meta, []);

      await saveDataset({
        ...incoming,
        rows: merged,
        stats: newStats,
        reconciliation: newRecon,
      });
    }
    // 'cancel' = do nothing

    setConflicts(prev => prev.filter(c => c.month !== month));
    if (conflicts.length === 1) {
      setPendingDatasets([]);
    }
  };

  const handleDelete = async (month: string) => {
    await deleteDataset(month);
    setDeleteConfirm(null);
    if (expanded === month) setExpanded(null);
  };

  const handleExportAll = () => {
    if (!datasets || datasets.length === 0) return;
    const wb = XLSX.utils.book_new();

    for (const ds of datasets) {
      const rows = ds.rows.map(r => ({
        SL: r.sl,
        Date: r.date,
        'Emp. ID': r.empId,
        'Emp. Name': r.empName,
        'Emp. Phone': r.empPhone,
        Role: r.role,
        Region: r.parsedHierarchy.region,
        Area: r.parsedHierarchy.areaLabel,
        Territory: r.parsedHierarchy.territoryLabel,
        Officer: r.parsedHierarchy.officer,
        'Allowance Type': r.allowanceType,
        'Expense Type': r.expenseType,
        From: r.from,
        To: r.to,
        'Submit Amount': r.submitAmount,
        'Payable Amount': r.payableAmount,
        Status: r.status,
        Remarks: r.remarks,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const sheetName = ds.month.replace('-', ' ').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Summary sheet
    const summaryRows = datasets.map(ds => ({
      Month: ds.month,
      'Row Count': ds.stats.rowCount,
      Officers: ds.stats.employeeCount,
      'Submit Total': ds.stats.submitTotal,
      'Payable Total': ds.stats.payableTotal,
      Reconciled: ds.reconciliation.ok ? 'Yes' : 'No',
      'Uploaded At': new Date(ds.uploadedAt).toISOString(),
      'File Name': ds.fileName,
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    XLSX.writeFile(wb, `tada-insights-export-${Date.now()}.xlsx`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <ConflictDialog conflicts={conflicts} onResolve={handleConflictResolve} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Data Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload, manage, and export monthly TA/DA reports
          </p>
        </div>
        {datasets && datasets.length > 0 && (
          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 text-sm transition-colors shadow-sm"
          >
            <span>⬇</span>
            <span>Export All Months</span>
          </button>
        )}
      </div>

      {/* Upload area */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-4">Upload Report</h2>
        <FileUpload
          onFile={handleFile}
          parsing={parsing}
          progress={progress}
          error={error}
          onAbort={abort}
        />
      </div>

      {/* Stored months */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          Stored Months
          {datasets && datasets.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({datasets.length} month{datasets.length !== 1 ? 's' : ''})
            </span>
          )}
        </h2>

        {!datasets && (
          <p className="text-sm text-slate-400">Loading…</p>
        )}

        {datasets && datasets.length === 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 p-10 text-center">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-slate-500 dark:text-slate-400">No data stored yet. Upload a report above.</p>
          </div>
        )}

        {datasets && datasets.map(ds => (
          <div
            key={ds.id}
            className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
          >
            {/* Summary row */}
            <div className="flex items-center gap-4 p-5 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                  {formatMonth(ds.month)}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {ds.fileName} · uploaded {formatDate(ds.uploadedAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div className="text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Rows</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {ds.stats.rowCount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Officers</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {ds.stats.employeeCount}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Submit</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {formatTaka(ds.stats.submitTotal)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Payable</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {formatTaka(ds.stats.payableTotal)}
                  </p>
                </div>
                <ReconciliationBadge recon={ds.reconciliation} compact />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded(expanded === ds.id ? null : ds.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  {expanded === ds.id ? '▲ Hide' : '▼ Details'}
                </button>
                {deleteConfirm === ds.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(ds.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(ds.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {expanded === ds.id && (
              <div className="border-t border-slate-100 dark:border-slate-700 p-5 space-y-4">
                {/* Reconciliation details */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Reconciliation Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[
                      { label: 'Submit Amount', diff: ds.reconciliation.submitDiff, header: ds.meta.totals.submitAmount },
                      { label: 'Payable Amount', diff: ds.reconciliation.payableDiff, header: ds.meta.totals.payableAmount },
                      { label: 'Transport', diff: ds.reconciliation.transportDiff, header: ds.meta.totals.transport },
                      { label: 'Allowance', diff: ds.reconciliation.allowanceDiff, header: ds.meta.totals.allowance },
                      { label: 'Accommodation', diff: ds.reconciliation.accommodationDiff, header: ds.meta.totals.accommodation },
                      { label: 'Other Costs', diff: ds.reconciliation.otherCostsDiff, header: ds.meta.totals.otherCosts },
                    ].map(({ label, diff, header }) => (
                      <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
                        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatTaka(header)}
                        </p>
                        {Math.abs(diff) > 0.01 ? (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                            Δ {diff > 0 ? '+' : ''}{formatTaka(Math.abs(diff))}
                          </p>
                        ) : (
                          <p className="text-xs text-green-500 dark:text-green-400 mt-0.5">✓ Match</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation messages */}
                {ds.reconciliation.messages.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Validation Messages ({ds.reconciliation.messages.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
                      {ds.reconciliation.messages.slice(0, 100).map((msg, i) => (
                        <div
                          key={i}
                          className={[
                            'text-xs rounded px-2 py-1',
                            msg.level === 'error'
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : msg.level === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                          ].join(' ')}
                        >
                          <span className="font-semibold">[{msg.level.toUpperCase()}]</span> {msg.message}
                        </div>
                      ))}
                      {ds.reconciliation.messages.length > 100 && (
                        <p className="text-xs text-slate-400 text-center pt-1">
                          … and {ds.reconciliation.messages.length - 100} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Header meta */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    File Header Info
                  </h4>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <p>Date range: <strong>{ds.meta.dateRange.from}</strong> to <strong>{ds.meta.dateRange.to}</strong></p>
                    <p>Territory: <strong>{ds.meta.territory}</strong></p>
                    <p>Declared records: <strong>{ds.meta.totalRecords.toLocaleString('en-IN')}</strong></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
