import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type {
  ImportRow,
  ImportReport,
  ImportAnomaly,
  SplitType,
  Group,
} from '../types';
import { round2 } from './balances';

// ─── Exchange rates (hardcoded for reproducibility) ──────────────────────────
// Using approximate 2024 rates. USD→INR ≈ 84.5
export const EXCHANGE_RATES: Record<string, number> = {
  INR: 1,
  USD: 84.5,
  EUR: 91.2,
  GBP: 107.3,
};

export function convertToInr(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()] ?? 1;
  return round2(amount * rate);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.trim().toLowerCase();
}

function parseDate(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s.trim());
  if (isNaN(d.getTime())) return null;
  return d;
}

function isSettlementDescription(desc: string): boolean {
  const lower = desc.toLowerCase();
  return (
    lower.includes('pays') ||
    lower.includes('settlement') ||
    lower.includes('reimburse') ||
    lower.includes('reimburs') ||
    lower.includes('payback') ||
    lower.includes('pay back') ||
    lower.includes('transfer')
  );
}

function rowKey(row: ImportRow): string {
  return `${row.date}|${normalise(row.description)}|${row.amount}|${row.currency}|${row.paidBy}`;
}

function rowSimilarityKey(row: ImportRow): string {
  // Near-duplicate: same date + description, different amount
  return `${row.date}|${normalise(row.description)}|${row.paidBy}`;
}

// ─── Main parse + detect ─────────────────────────────────────────────────────

export function parseAndAnalyseCSV(
  csvText: string,
  group: Group,
  filename: string
): ImportReport {
  const reportId = uuidv4();
  const now = new Date().toISOString();

  const memberNames = group.members.map((m) => normalise(m.name));

  // ── 1. Parse CSV ────────────────────────────────────────────────────────────
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rawRows = parsed.data;
  const allAnomalies: ImportAnomaly[] = [];
  const importRows: ImportRow[] = [];

  // ── 2. Row-level processing ─────────────────────────────────────────────────
  rawRows.forEach((raw, idx) => {
    const rowAnomalies: ImportAnomaly[] = [];
    const rowNum = idx + 2; // CSV row number (1-indexed header + 1)

    const dateStr = raw['Date']?.trim() ?? '';
    const description = raw['Description']?.trim() ?? '';
    const amountStr = raw['Amount']?.trim() ?? '';
    const currency = (raw['Currency']?.trim() ?? 'INR').toUpperCase();
    const paidBy = raw['Paid By']?.trim() ?? '';
    const splitBetweenStr = raw['Split Between']?.trim() ?? '';
    const splitTypeStr = (raw['Split Type']?.trim() ?? 'equal').toLowerCase();
    const notes = raw['Notes']?.trim() ?? '';

    // ── Missing fields ───────────────────────────────────────────────────────
    const missingFields: string[] = [];
    if (!dateStr) missingFields.push('Date');
    if (!description) missingFields.push('Description');
    if (!amountStr) missingFields.push('Amount');
    if (!paidBy) missingFields.push('Paid By');
    if (!splitBetweenStr) missingFields.push('Split Between');

    if (missingFields.length > 0) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'MISSING_FIELD',
        severity: 'error',
        message: `Row ${rowNum}: Missing required field(s): ${missingFields.join(', ')}`,
        detail: `Fields ${missingFields.join(', ')} are required for every expense.`,
        suggestedAction: 'skip',
      });
    }

    // ── Date validation ──────────────────────────────────────────────────────
    const parsedDate = parseDate(dateStr);
    if (!parsedDate && dateStr) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'INVALID_DATE',
        severity: 'error',
        message: `Row ${rowNum}: Invalid date "${dateStr}"`,
        detail: 'Date could not be parsed. Expected format: YYYY-MM-DD',
        suggestedAction: 'skip',
      });
    }

    // ── Future date ──────────────────────────────────────────────────────────
    if (parsedDate && parsedDate > new Date()) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'FUTURE_DATE',
        severity: 'warning',
        message: `Row ${rowNum}: "${description}" has a future date (${dateStr})`,
        detail: 'This expense is dated in the future, which may be a typo.',
        suggestedAction: 'import_anyway',
      });
    }

    // ── Amount parsing ───────────────────────────────────────────────────────
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'MISSING_FIELD',
        severity: 'error',
        message: `Row ${rowNum}: Amount "${amountStr}" is not a valid number`,
        detail: 'Amount must be a numeric value.',
        suggestedAction: 'skip',
      });
    }

    // ── Negative amount ──────────────────────────────────────────────────────
    if (!isNaN(amount) && amount < 0) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'NEGATIVE_AMOUNT',
        severity: 'warning',
        message: `Row ${rowNum}: Negative amount ₹${amount} on "${description}"`,
        detail:
          'Negative amounts typically indicate a settlement/refund, not a regular expense. Policy: treat as settlement.',
        suggestedAction: 'import_as_settlement',
      });
    }

    // ── Zero amount ──────────────────────────────────────────────────────────
    if (!isNaN(amount) && amount === 0) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'ZERO_AMOUNT',
        severity: 'warning',
        message: `Row ${rowNum}: Zero amount on "${description}"`,
        detail: 'Zero-amount expenses have no financial effect and are likely errors.',
        suggestedAction: 'skip',
      });
    }

    // ── Foreign currency ─────────────────────────────────────────────────────
    if (currency !== 'INR' && !isNaN(amount) && amount > 0) {
      const rate = EXCHANGE_RATES[currency];
      const inrEquivalent = rate ? round2(amount * rate) : null;
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'FOREIGN_CURRENCY',
        severity: 'warning',
        message: `Row ${rowNum}: "${description}" is in ${currency} (${currency} ${amount})`,
        detail: rate
          ? `Using rate 1 ${currency} = ₹${rate}. Converted: ₹${inrEquivalent}. Policy: convert using fixed 2024 rates.`
          : `No exchange rate available for ${currency}. Will treat 1:1 with INR.`,
        suggestedAction: 'convert_currency',
      });
    }

    // ── Settlement logged as expense ─────────────────────────────────────────
    if (isSettlementDescription(description) && !isNaN(amount) && amount > 0) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'SETTLEMENT_AS_EXPENSE',
        severity: 'warning',
        message: `Row ${rowNum}: "${description}" looks like a settlement, not an expense`,
        detail:
          'Descriptions containing "pays", "reimburse", "settlement" indicate debt repayment, not a shared expense. Policy: import as settlement.',
        suggestedAction: 'import_as_settlement',
      });
    }

    // ── Unknown members ──────────────────────────────────────────────────────
    const splitBetween = splitBetweenStr
      ? splitBetweenStr.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const unknownMembers: string[] = [];
    for (const name of [...splitBetween, paidBy]) {
      if (name && !memberNames.includes(normalise(name))) {
        unknownMembers.push(name);
      }
    }
    if (unknownMembers.length > 0) {
      const unique = [...new Set(unknownMembers)];
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'UNKNOWN_MEMBER',
        severity: 'warning',
        message: `Row ${rowNum}: Unknown member(s): ${unique.join(', ')}`,
        detail: `These names don't match any current group member. Check spelling. Policy: skip rows with unknown payer; include known members only in split.`,
        suggestedAction: 'flag_for_review',
      });
    }

    // ── Split type validation ────────────────────────────────────────────────
    const validSplitTypes = ['equal', 'exact', 'percentage'];
    if (!validSplitTypes.includes(splitTypeStr)) {
      rowAnomalies.push({
        rowIndex: rowNum,
        rowData: raw,
        type: 'INVALID_SPLIT_TYPE',
        severity: 'warning',
        message: `Row ${rowNum}: Unknown split type "${splitTypeStr}"`,
        detail: `Valid types are: equal, exact, percentage. Policy: default to equal.`,
        suggestedAction: 'auto_fixed',
      });
    }

    // ── Validate percentage/exact splits ────────────────────────────────────
    if (splitTypeStr === 'percentage' && notes) {
      const parts = notes.split(',').map((p) => p.trim());
      const total = parts.reduce((sum, p) => {
        const [, v] = p.split(':');
        return sum + (parseFloat(v) || 0);
      }, 0);
      if (Math.abs(total - 100) > 0.01) {
        rowAnomalies.push({
          rowIndex: rowNum,
          rowData: raw,
          type: 'SPLIT_MISMATCH',
          severity: 'warning',
          message: `Row ${rowNum}: Percentage split totals ${round2(total)}%, not 100%`,
          detail: `Percentages must sum to 100. Policy: normalize proportionally.`,
          suggestedAction: 'auto_fixed',
        });
      }
    }

    if (splitTypeStr === 'exact' && notes) {
      const parts = notes.split(',').map((p) => p.trim());
      const total = parts.reduce((sum, p) => {
        const [, v] = p.split(':');
        return sum + (parseFloat(v) || 0);
      }, 0);
      if (!isNaN(amount) && Math.abs(total - amount) > 0.5) {
        rowAnomalies.push({
          rowIndex: rowNum,
          rowData: raw,
          type: 'SPLIT_MISMATCH',
          severity: 'warning',
          message: `Row ${rowNum}: Exact splits total ₹${round2(total)}, but expense is ₹${amount}`,
          detail: `Exact share amounts (₹${round2(total)}) don't match expense total (₹${amount}). Policy: distribute remainder to payer.`,
          suggestedAction: 'auto_fixed',
        });
      }
    }

    const importRow: ImportRow = {
      rowIndex: rowNum,
      date: parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr,
      description,
      amount: isNaN(amount) ? 0 : amount,
      currency,
      paidBy,
      splitBetween,
      splitType: validSplitTypes.includes(splitTypeStr) ? (splitTypeStr as SplitType) : 'equal',
      notes,
      raw,
      anomalies: rowAnomalies,
      action: 'pending',
    };

    importRows.push(importRow);
    allAnomalies.push(...rowAnomalies);
  });

  // ── 3. Cross-row analysis: duplicates ──────────────────────────────────────
  const seenExact = new Map<string, number>(); // key -> rowIndex
  const seenSimilar = new Map<string, number>(); // key -> rowIndex

  for (let i = 0; i < importRows.length; i++) {
    const row = importRows[i];
    if (row.amount <= 0) continue; // don't flag settlements as dupes

    const eKey = rowKey(row);
    const sKey = rowSimilarityKey(row);

    if (seenExact.has(eKey)) {
      const originalIdx = seenExact.get(eKey)!;
      const dup: ImportAnomaly = {
        rowIndex: row.rowIndex,
        rowData: row.raw,
        type: 'EXACT_DUPLICATE',
        severity: 'error',
        message: `Row ${row.rowIndex}: Exact duplicate of row ${originalIdx} — "${row.description}" on ${row.date} for ${row.currency} ${row.amount}`,
        detail:
          'Identical date, description, amount, currency, and payer. Policy: skip the later row. Meera must approve any deletion.',
        suggestedAction: 'skip',
        relatedRowIndex: originalIdx,
      };
      row.anomalies.push(dup);
      row.action = 'skip';
      allAnomalies.push(dup);
    } else {
      seenExact.set(eKey, row.rowIndex);
    }

    // Near-duplicate: same description/date/payer but different amount
    if (seenSimilar.has(sKey) && !seenExact.has(eKey)) {
      const originalIdx = seenSimilar.get(sKey)!;
      const originalRow = importRows.find((r) => r.rowIndex === originalIdx);
      if (originalRow && originalRow.amount !== row.amount) {
        const near: ImportAnomaly = {
          rowIndex: row.rowIndex,
          rowData: row.raw,
          type: 'NEAR_DUPLICATE',
          severity: 'warning',
          message: `Row ${row.rowIndex}: Near-duplicate of row ${originalIdx} — "${row.description}" on ${row.date} (amounts differ: ${originalRow.currency} ${originalRow.amount} vs ${row.currency} ${row.amount})`,
          detail:
            'Same date, description, and payer but different amounts. Could be two different charges or a correction. Policy: flag for user to decide — keep both, keep first, or keep second.',
          suggestedAction: 'flag_for_review',
          relatedRowIndex: originalIdx,
        };
        row.anomalies.push(near);
        allAnomalies.push(near);
      }
    } else if (!seenSimilar.has(sKey)) {
      seenSimilar.set(sKey, row.rowIndex);
    }
  }

  // ── 4. Set default actions ─────────────────────────────────────────────────
  for (const row of importRows) {
    if (row.action !== 'skip') {
      const hasError = row.anomalies.some((a) => a.severity === 'error');
      if (hasError) {
        row.action = 'skip';
      } else if (row.anomalies.some((a) => a.type === 'NEGATIVE_AMOUNT')) {
        row.action = 'import'; // will be treated as settlement
      } else if (
        row.anomalies.some(
          (a) => a.type === 'SETTLEMENT_AS_EXPENSE' || a.type === 'FOREIGN_CURRENCY'
        )
      ) {
        row.action = 'import';
      } else {
        row.action = 'import';
      }
    }
  }

  const importedRows = importRows.filter((r) => r.action === 'import').length;
  const skippedRows = importRows.filter((r) => r.action === 'skip').length;

  return {
    id: reportId,
    filename,
    totalRows: rawRows.length,
    importedRows,
    skippedRows,
    anomalies: allAnomalies,
    createdAt: now,
    groupId: group.id,
    status: allAnomalies.length > 0 ? 'pending_review' : 'completed',
    parsedRows: importRows,
  };
}

// ─── Convert an ImportRow into an Expense ────────────────────────────────────

export function rowToExpense(
  row: ImportRow,
  group: Group,
  isSettlement = false
) {
  const memberMap: Record<string, { id: string; name: string; joinedAt: string; leftAt?: string | null }> = {};
  for (const m of group.members) {
    memberMap[normalise(m.name)] = { id: m.userId, name: m.name, joinedAt: m.joinedAt, leftAt: m.leftAt };
  }

  const payer = memberMap[normalise(row.paidBy)];
  if (!payer) return null;

  // Only include members who were in the group at the time of the expense
  const expenseDate = new Date(row.date);
  const activeSplitMembers = row.splitBetween
    .map((name) => memberMap[normalise(name)])
    .filter((m): m is NonNullable<typeof m> => {
      if (!m) return false;
      const joined = new Date(m.joinedAt);
      if (expenseDate < joined) return false; // hadn't joined yet
      if (m.leftAt) {
        const left = new Date(m.leftAt);
        if (expenseDate > left) return false; // had already left
      }
      return true;
    });

  if (activeSplitMembers.length === 0) return null;

  const amountInr = convertToInr(row.amount, row.currency);
  const exchangeRate = EXCHANGE_RATES[row.currency.toUpperCase()] ?? 1;

  // ── Calculate shares ───────────────────────────────────────────────────────
  const shares: Array<{ userId: string; userName: string; shareAmount: number; percentage?: number; isExact?: boolean }> = [];

  if (row.splitType === 'equal') {
    const perPerson = round2(amountInr / activeSplitMembers.length);
    const remainder = round2(amountInr - perPerson * activeSplitMembers.length);
    activeSplitMembers.forEach((m, i) => {
      shares.push({
        userId: m.id,
        userName: m.name,
        shareAmount: i === 0 ? round2(perPerson + remainder) : perPerson,
      });
    });
  } else if (row.splitType === 'percentage' && row.notes) {
    const parts = parseKeyValuePairs(row.notes);
    let totalPct = Object.values(parts).reduce((s, v) => s + v, 0);
    if (totalPct === 0) totalPct = 100;

    for (const m of activeSplitMembers) {
      const pct = (parts[normalise(m.name)] ?? 0);
      const normalised = totalPct !== 100 ? round2((pct / totalPct) * 100) : pct;
      shares.push({
        userId: m.id,
        userName: m.name,
        shareAmount: round2((normalised / 100) * amountInr),
        percentage: normalised,
      });
    }
  } else if (row.splitType === 'exact' && row.notes) {
    const parts = parseKeyValuePairs(row.notes);
    for (const m of activeSplitMembers) {
      const exactAmt = parts[normalise(m.name)] ?? 0;
      shares.push({
        userId: m.id,
        userName: m.name,
        shareAmount: convertToInr(exactAmt, row.currency),
        isExact: true,
      });
    }
  } else {
    // Fallback: equal
    const perPerson = round2(amountInr / activeSplitMembers.length);
    activeSplitMembers.forEach((m) => {
      shares.push({ userId: m.id, userName: m.name, shareAmount: perPerson });
    });
  }

  return {
    groupId: group.id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    amountInr,
    exchangeRate,
    paidById: payer.id,
    paidByName: payer.name,
    splitType: row.splitType,
    shares,
    date: row.date,
    notes: row.notes,
    isSettlement,
    importRowNum: row.rowIndex,
  };
}

function parseKeyValuePairs(str: string): Record<string, number> {
  const result: Record<string, number> = {};
  const parts = str.split(',').map((p) => p.trim());
  for (const part of parts) {
    const colonIdx = part.lastIndexOf(':');
    if (colonIdx > 0) {
      const key = normalise(part.slice(0, colonIdx));
      const val = parseFloat(part.slice(colonIdx + 1));
      if (!isNaN(val)) result[key] = val;
    }
  }
  return result;
}
