export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;      // ISO date string
  leftAt?: string | null; // ISO date string or null if still active
  role: 'admin' | 'member';
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  currency: string;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

export type SplitType = 'equal' | 'exact' | 'percentage';

export interface ExpenseShare {
  userId: string;
  userName: string;
  shareAmount: number;   // in INR
  percentage?: number;
  isExact?: boolean;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;          // original amount
  currency: string;        // original currency
  amountInr: number;       // converted to INR
  exchangeRate?: number;   // rate used
  paidById: string;
  paidByName: string;
  splitType: SplitType;
  shares: ExpenseShare[];
  date: string;            // ISO date string
  notes?: string;
  isSettlement: boolean;
  createdAt: string;
  importRowNum?: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface Balance {
  userId: string;
  userName: string;
  net: number;           // positive = owed money, negative = owes money
  totalPaid: number;
  totalOwed: number;
  expenseBreakdown: Array<{
    expenseId: string;
    description: string;
    date: string;
    youPaid: number;
    yourShare: number;
    net: number;
  }>;
}

export interface DebtSummary {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

// ─── Import / Anomaly types ───────────────────────────────────────────────────

export type AnomalyType =
  | 'NEGATIVE_AMOUNT'
  | 'EXACT_DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'FOREIGN_CURRENCY'
  | 'SETTLEMENT_AS_EXPENSE'
  | 'MEMBER_MISMATCH'
  | 'INVALID_DATE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_MEMBER'
  | 'EXPENSE_AFTER_LEFT'
  | 'SPLIT_MISMATCH'
  | 'INVALID_SPLIT_TYPE'
  | 'ZERO_AMOUNT'
  | 'FUTURE_DATE';

export type AnomalyAction =
  | 'import_as_settlement'
  | 'import_as_refund'
  | 'skip'
  | 'import_anyway'
  | 'use_first'
  | 'use_second'
  | 'convert_currency'
  | 'flag_for_review'
  | 'auto_fixed'
  | 'pending';

export interface ImportAnomaly {
  rowIndex: number;
  rowData: Record<string, string>;
  type: AnomalyType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  detail: string;
  suggestedAction: AnomalyAction;
  userAction?: AnomalyAction;
  relatedRowIndex?: number;  // for duplicates
}

export interface ImportRow {
  rowIndex: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitBetween: string[];
  splitType: SplitType;
  notes: string;
  raw: Record<string, string>;
  anomalies: ImportAnomaly[];
  action: 'import' | 'skip' | 'pending';
}

export interface ImportReport {
  id: string;
  filename: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  anomalies: ImportAnomaly[];
  createdAt: string;
  groupId: string;
  status: 'pending_review' | 'completed' | 'rejected';
  parsedRows: ImportRow[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
