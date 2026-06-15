import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { parseAndAnalyseCSV, rowToExpense } from '../lib/csvImporter';
import type { ImportReport, AnomalyAction } from '../types';
import toast from 'react-hot-toast';

const ACTION_LABELS: Record<AnomalyAction, string> = {
  import_as_settlement: 'Import as settlement',
  import_as_refund: 'Import as refund',
  skip: 'Skip this row',
  import_anyway: 'Import anyway',
  use_first: 'Keep first occurrence',
  use_second: 'Keep second occurrence',
  convert_currency: 'Convert & import',
  flag_for_review: 'Import + flag',
  auto_fixed: 'Auto-fixed',
  pending: 'Pending',
};

const SEVERITY_COLOR = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const SEVERITY_ICON = {
  error: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
};

export default function Import() {
  const { groups, addExpenses, addImportReport, updateImportReport } = useAppStore();

  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const group = groups.find((g) => g.id === selectedGroupId);

  const processFile = useCallback(
    async (file: File) => {
      if (!group) { toast.error('Select a group first'); return; }
      if (!file.name.endsWith('.csv')) { toast.error('Only CSV files are supported'); return; }

      setLoading(true);
      const text = await file.text();
      const result = parseAndAnalyseCSV(text, group, file.name);
      setReport(result);
      addImportReport(result);
      setStep('review');
      setLoading(false);
    },
    [group, addImportReport]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const setRowAction = (rowIndex: number, action: 'import' | 'skip') => {
    if (!report) return;
    setReport({
      ...report,
      parsedRows: report.parsedRows.map((r) =>
        r.rowIndex === rowIndex ? { ...r, action } : r
      ),
    });
  };

  const setAnomalyUserAction = (rowIndex: number, anomalyType: string, action: AnomalyAction) => {
    if (!report) return;
    setReport({
      ...report,
      parsedRows: report.parsedRows.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        return {
          ...r,
          anomalies: r.anomalies.map((a) =>
            a.type === anomalyType ? { ...a, userAction: action } : a
          ),
        };
      }),
    });
  };

  const handleConfirmImport = () => {
    if (!report || !group) return;

    const toImport = report.parsedRows.filter((r) => r.action === 'import');
    const expenses: ReturnType<typeof rowToExpense>[] = [];
    const skippedRowNums: number[] = [];

    for (const row of toImport) {
      const isSettlement =
        row.anomalies.some((a) => a.type === 'NEGATIVE_AMOUNT' || a.type === 'SETTLEMENT_AS_EXPENSE') ||
        row.amount < 0;

      const expense = rowToExpense(row, group, isSettlement);
      if (expense) {
        expenses.push(expense);
      } else {
        skippedRowNums.push(row.rowIndex);
      }
    }

    const validExpenses = expenses.filter((e): e is NonNullable<typeof e> => e !== null);
    addExpenses(validExpenses as any[]);

    const finalReport = {
      ...report,
      importedRows: validExpenses.length,
      skippedRows: report.parsedRows.filter((r) => r.action === 'skip').length + skippedRowNums.length,
      status: 'completed' as const,
    };
    updateImportReport(report.id, finalReport);
    setReport(finalReport);
    setStep('done');

    toast.success(`Imported ${validExpenses.length} expenses`);
  };

  const downloadReport = () => {
    if (!report) return;
    const lines: string[] = [
      `Import Report — ${report.filename}`,
      `Generated: ${new Date(report.createdAt).toLocaleString()}`,
      `Group: ${group?.name}`,
      '',
      '═══ SUMMARY ═══',
      `Total rows in CSV: ${report.totalRows}`,
      `Rows to import:    ${report.parsedRows.filter((r) => r.action === 'import').length}`,
      `Rows to skip:      ${report.parsedRows.filter((r) => r.action === 'skip').length}`,
      `Anomalies found:   ${report.anomalies.length}`,
      '',
      '═══ ANOMALY LOG ═══',
    ];

    for (const anomaly of report.anomalies) {
      lines.push('');
      lines.push(`[${anomaly.severity.toUpperCase()}] Row ${anomaly.rowIndex}: ${anomaly.type}`);
      lines.push(`  Message: ${anomaly.message}`);
      lines.push(`  Detail:  ${anomaly.detail}`);
      lines.push(`  Action:  ${anomaly.suggestedAction}`);
    }

    lines.push('');
    lines.push('═══ ROW DECISIONS ═══');
    for (const row of report.parsedRows) {
      lines.push(`Row ${row.rowIndex}: "${row.description}" | ${row.currency} ${row.amount} | Action: ${row.action.toUpperCase()}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${report.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = report?.anomalies.filter((a) => a.severity === 'error').length ?? 0;
  const warningCount = report?.anomalies.filter((a) => a.severity === 'warning').length ?? 0;
  const toImportCount = report?.parsedRows.filter((r) => r.action === 'import').length ?? 0;
  const toSkipCount = report?.parsedRows.filter((r) => r.action === 'skip').length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import CSV</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Import expenses_export.csv. Every anomaly is detected, shown, and requires your decision before importing.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['upload', 'review', 'done'] as const).map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              step === s ? 'bg-indigo-600 text-white' :
              (['upload', 'review', 'done'].indexOf(step) > i) ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {(['upload', 'review', 'done'].indexOf(step) > i) && '✓ '}
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div>
            <label className="label">Target group</label>
            <select
              className="input max-w-xs"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">Select group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {loading ? (
              <Loader2 className="w-10 h-10 text-indigo-400 mx-auto mb-3 animate-spin" />
            ) : (
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            )}
            <p className="text-gray-700 font-medium">
              {loading ? 'Analysing CSV…' : 'Drop expenses_export.csv here'}
            </p>
            <p className="text-gray-400 text-sm mt-1">or click to browse</p>
          </div>

          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> What the importer checks
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <b>Exact duplicates</b> — same date, description, amount, payer</li>
              <li>• <b>Near-duplicates</b> — same date + description but different amounts</li>
              <li>• <b>Foreign currency</b> — USD amounts treated as rupees is wrong; we convert using 2024 rates</li>
              <li>• <b>Settlements as expenses</b> — "pays", "reimburse" entries are debt repayments, not expenses</li>
              <li>• <b>Negative amounts</b> — treated as settlements/refunds</li>
              <li>• <b>Expense after member left</b> — Sam joined Apr 15, March electricity shouldn't affect them</li>
              <li>• <b>Unknown members</b> — names not in the group</li>
              <li>• <b>Invalid dates, missing fields, zero amounts</b></li>
              <li>• <b>Split mismatches</b> — percentages ≠ 100%, exact amounts ≠ total</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 'review' && report && (
        <div className="space-y-5">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-gray-900">{report.totalRows}</p>
              <p className="text-xs text-gray-500">Total rows</p>
            </div>
            <div className="card text-center py-3 bg-green-50 border-green-100">
              <p className="text-2xl font-bold text-green-700">{toImportCount}</p>
              <p className="text-xs text-green-600">Will import</p>
            </div>
            <div className="card text-center py-3 bg-gray-50">
              <p className="text-2xl font-bold text-gray-600">{toSkipCount}</p>
              <p className="text-xs text-gray-500">Will skip</p>
            </div>
            <div className="card text-center py-3 bg-amber-50 border-amber-100">
              <p className="text-2xl font-bold text-amber-700">{report.anomalies.length}</p>
              <p className="text-xs text-amber-600">{errorCount} errors · {warningCount} warnings</p>
            </div>
          </div>

          {/* Anomaly policy note */}
          <div className="card bg-amber-50 border-amber-100">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Review required — Meera's rule
            </h3>
            <p className="text-sm text-amber-800">
              Per Meera's request: <b>no rows are deleted or changed silently</b>. Every anomaly is listed below with a suggested action.
              You can override any decision before confirming the import.
              Rows marked "Skip" will not be imported.
            </p>
          </div>

          {/* Row-by-row review */}
          <div className="space-y-2">
            {report.parsedRows.map((row) => {
              const hasAnomalies = row.anomalies.length > 0;
              const isExpanded = expandedRows.has(row.rowIndex);
              const hasError = row.anomalies.some((a) => a.severity === 'error');

              return (
                <div
                  key={row.rowIndex}
                  className={`card transition-shadow ${
                    row.action === 'skip'
                      ? 'opacity-60 border-gray-100'
                      : hasError
                      ? 'border-red-100'
                      : hasAnomalies
                      ? 'border-amber-100'
                      : 'border-green-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      row.action === 'skip' ? 'bg-gray-300' :
                      hasError ? 'bg-red-400' :
                      hasAnomalies ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`} />

                    {/* Row summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">#{row.rowIndex}</span>
                        <span className={`font-medium text-sm ${row.action === 'skip' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {row.description || '(no description)'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {row.currency} {row.amount}
                          {row.currency !== 'INR' && <span className="text-amber-600 ml-1">≈ ₹{(row.amount * (row.currency === 'USD' ? 84.5 : row.currency === 'EUR' ? 91.2 : 107.3)).toFixed(0)}</span>}
                        </span>
                        <span className="text-xs text-gray-400">· {row.paidBy} · {row.date}</span>
                        {row.anomalies.length > 0 && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            hasError ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {row.anomalies.length} issue{row.anomalies.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.action === 'import'}
                          onChange={() => setRowAction(row.rowIndex, row.action === 'import' ? 'skip' : 'import')}
                          className="accent-indigo-600"
                        />
                        <span className={row.action === 'import' ? 'text-green-700 font-medium' : 'text-gray-400'}>
                          {row.action === 'import' ? 'Import' : 'Skip'}
                        </span>
                      </label>

                      {hasAnomalies && (
                        <button onClick={() => toggleRow(row.rowIndex)} className="text-gray-400 hover:text-gray-600">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded anomaly detail */}
                  {isExpanded && row.anomalies.length > 0 && (
                    <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
                      {row.anomalies.map((anomaly, ai) => (
                        <div
                          key={ai}
                          className={`flex gap-3 p-3 rounded-xl border text-xs ${SEVERITY_COLOR[anomaly.severity]}`}
                        >
                          {SEVERITY_ICON[anomaly.severity]}
                          <div className="flex-1">
                            <p className="font-semibold">{anomaly.type.replace(/_/g, ' ')}</p>
                            <p className="mt-0.5">{anomaly.message}</p>
                            <p className="mt-1 opacity-80">{anomaly.detail}</p>
                            {anomaly.relatedRowIndex && (
                              <p className="mt-1 font-medium">Related to row #{anomaly.relatedRowIndex}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <select
                              className="text-xs border border-current rounded-lg px-2 py-1 bg-white/70"
                              value={anomaly.userAction ?? anomaly.suggestedAction}
                              onChange={(e) =>
                                setAnomalyUserAction(row.rowIndex, anomaly.type, e.target.value as AnomalyAction)
                              }
                            >
                              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action bar */}
          <div className="sticky bottom-4 flex gap-3 bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-lg p-4">
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">
                Ready to import {toImportCount} expense{toImportCount !== 1 ? 's' : ''}
                {toSkipCount > 0 && `, skipping ${toSkipCount}`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {report.anomalies.length} anomalies flagged · You've reviewed and approved this import
              </p>
            </div>
            <button onClick={downloadReport} className="btn-secondary">
              <Download className="w-4 h-4" /> Report
            </button>
            <button onClick={() => { setStep('upload'); setReport(null); }} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              className="btn-primary"
              disabled={toImportCount === 0}
            >
              <CheckCircle className="w-4 h-4" /> Confirm Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && report && (
        <div className="space-y-5">
          <div className="card text-center py-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Import complete!</h2>
            <p className="text-gray-500">
              {report.importedRows} expenses imported, {report.skippedRows} skipped
            </p>
          </div>

          {/* Final anomaly summary */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Import Report — {report.filename}
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{report.totalRows}</p>
                <p className="text-xs text-gray-500">Total rows</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-xl font-bold text-green-700">{report.importedRows}</p>
                <p className="text-xs text-green-600">Imported</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-600">{report.skippedRows}</p>
                <p className="text-xs text-gray-500">Skipped</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-2">Anomalies handled:</p>
              {report.anomalies.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${SEVERITY_COLOR[a.severity]}`}>
                  {SEVERITY_ICON[a.severity]}
                  <div>
                    <span className="font-semibold">[{a.type}]</span> {a.message}
                    <span className="ml-2 opacity-70">→ {ACTION_LABELS[a.suggestedAction]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={downloadReport} className="btn-secondary flex-1 justify-center">
              <Download className="w-4 h-4" /> Download full report
            </button>
            <button
              onClick={() => { setStep('upload'); setReport(null); }}
              className="btn-primary flex-1 justify-center"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
