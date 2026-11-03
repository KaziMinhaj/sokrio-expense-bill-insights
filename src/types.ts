// TA/DA Insights — Core Type Definitions

export type AllowanceType = 'Transportation' | 'Daily Allowance' | 'Others' | 'Accommodation';
export type ClaimStatus = 'Accepted' | 'Approved' | 'Pending' | 'Rejected' | 'Cancelled';
export type RoleFamily = 'TSO' | 'ASM' | 'RSI';

export const KNOWN_STATUSES: ClaimStatus[] = ['Accepted', 'Approved', 'Pending', 'Rejected', 'Cancelled'];
export const KNOWN_ALLOWANCE_TYPES: AllowanceType[] = ['Transportation', 'Daily Allowance', 'Others', 'Accommodation'];

export interface ParsedHierarchy {
  country: string;
  national: string;
  nationalHead: string;
  region: string;
  regionalHead: string;    // "-" if no RSI level
  area: string;            // raw area name or "-"
  areaLabel: string;       // "Area . Region" or "-"
  areaManager: string;     // ASM name or "-"
  territory: string;       // raw territory name or "-"
  territoryLabel: string;  // "Territory . Area" or "-"
  officer: string;         // last element
}

export interface HeaderMeta {
  dateRange: { from: string; to: string };
  territory: string;
  totalRecords: number;
  totals: {
    transport: number;
    allowance: number;
    accommodation: number;
    otherCosts: number;
    submitAmount: number;
    payableAmount: number;
  };
}

export interface ClaimRow {
  sl: number;
  date: string;           // ISO YYYY-MM-DD
  month: string;          // YYYY-MM
  empId: string;
  empName: string;
  empPhone: string;
  role: string;
  roleFamily: RoleFamily | string;
  hierarchy: string;
  parsedHierarchy: ParsedHierarchy;
  allowanceType: AllowanceType | string;
  expenseType: string;
  from: string;
  to: string;
  submitAmount: number;
  payableAmount: number;
  status: ClaimStatus | string;
  remarks: string;
}

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  rowSl?: number;
}

export interface ReconciliationResult {
  ok: boolean;
  submitDiff: number;
  payableDiff: number;
  transportDiff: number;
  allowanceDiff: number;
  accommodationDiff: number;
  otherCostsDiff: number;
  messages: ValidationMessage[];
}

export interface MonthStats {
  rowCount: number;
  employeeCount: number;
  submitTotal: number;
  payableTotal: number;
}

export interface MonthlyDataset {
  id: string;           // YYYY-MM (primary key)
  month: string;        // YYYY-MM
  uploadedAt: number;
  fileName: string;
  meta: HeaderMeta;
  rows: ClaimRow[];
  reconciliation: ReconciliationResult;
  stats: MonthStats;
}

// Web Worker message types
export interface WorkerRequest {
  type: 'PARSE';
  buffer: ArrayBuffer;
  fileName: string;
}

export interface WorkerProgress {
  type: 'PROGRESS';
  message: string;
  percent: number;
}

export interface WorkerResult {
  type: 'RESULT';
  datasets: MonthlyDataset[];
  errors: string[];
}

export interface WorkerError {
  type: 'ERROR';
  message: string;
}

export type WorkerMessage = WorkerProgress | WorkerResult | WorkerError;

// Conflict resolution
export interface MonthConflict {
  month: string;
  existingDataset: MonthlyDataset;
  incomingDataset: MonthlyDataset;
}
