// Reconciliation engine for TA/DA Insights
import type {
  ClaimRow,
  HeaderMeta,
  ReconciliationResult,
  ValidationMessage,
} from '../types';

const EPSILON = 0.005; // rounding tolerance

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function reconcile(
  rows: ClaimRow[],
  meta: HeaderMeta,
  existingMessages: ValidationMessage[] = [],
): ReconciliationResult {
  // Compute sums from rows
  let submitSum = 0;
  let payableSum = 0;
  let transportSum = 0;
  let allowanceSum = 0;
  let accommodationSum = 0;
  let otherCostsSum = 0;

  for (const row of rows) {
    submitSum += row.submitAmount;
    payableSum += row.payableAmount;

    switch (row.allowanceType) {
      case 'Transportation':
        transportSum += row.submitAmount;
        break;
      case 'Daily Allowance':
        allowanceSum += row.submitAmount;
        break;
      case 'Accommodation':
        accommodationSum += row.submitAmount;
        break;
      case 'Others':
        otherCostsSum += row.submitAmount;
        break;
    }
  }

  const submitDiff = round2(submitSum - meta.totals.submitAmount);
  const payableDiff = round2(payableSum - meta.totals.payableAmount);
  const transportDiff = round2(transportSum - meta.totals.transport);
  const allowanceDiff = round2(allowanceSum - meta.totals.allowance);
  const accommodationDiff = round2(accommodationSum - meta.totals.accommodation);
  const otherCostsDiff = round2(otherCostsSum - meta.totals.otherCosts);

  const messages: ValidationMessage[] = [...existingMessages];

  if (Math.abs(submitDiff) > EPSILON) {
    messages.push({
      level: 'error',
      message: `Submit Amount mismatch: rows sum to ${submitSum.toFixed(2)}, header says ${meta.totals.submitAmount.toFixed(2)} (diff ${submitDiff > 0 ? '+' : ''}${submitDiff.toFixed(2)})`,
    });
  }
  if (Math.abs(payableDiff) > EPSILON) {
    messages.push({
      level: 'error',
      message: `Payable Amount mismatch: rows sum to ${payableSum.toFixed(2)}, header says ${meta.totals.payableAmount.toFixed(2)} (diff ${payableDiff > 0 ? '+' : ''}${payableDiff.toFixed(2)})`,
    });
  }
  if (Math.abs(transportDiff) > EPSILON) {
    messages.push({
      level: 'warning',
      message: `Transportation subtotal mismatch: rows ${transportSum.toFixed(2)} vs header ${meta.totals.transport.toFixed(2)} (diff ${transportDiff.toFixed(2)})`,
    });
  }
  if (Math.abs(allowanceDiff) > EPSILON) {
    messages.push({
      level: 'warning',
      message: `Daily Allowance subtotal mismatch: rows ${allowanceSum.toFixed(2)} vs header ${meta.totals.allowance.toFixed(2)} (diff ${allowanceDiff.toFixed(2)})`,
    });
  }
  if (Math.abs(accommodationDiff) > EPSILON) {
    messages.push({
      level: 'warning',
      message: `Accommodation subtotal mismatch: rows ${accommodationSum.toFixed(2)} vs header ${meta.totals.accommodation.toFixed(2)} (diff ${accommodationDiff.toFixed(2)})`,
    });
  }
  if (Math.abs(otherCostsDiff) > EPSILON) {
    messages.push({
      level: 'warning',
      message: `Other Costs subtotal mismatch: rows ${otherCostsSum.toFixed(2)} vs header ${meta.totals.otherCosts.toFixed(2)} (diff ${otherCostsDiff.toFixed(2)})`,
    });
  }

  const ok =
    Math.abs(submitDiff) <= EPSILON &&
    Math.abs(payableDiff) <= EPSILON &&
    Math.abs(transportDiff) <= EPSILON &&
    Math.abs(allowanceDiff) <= EPSILON &&
    Math.abs(accommodationDiff) <= EPSILON &&
    Math.abs(otherCostsDiff) <= EPSILON;

  return {
    ok,
    submitDiff,
    payableDiff,
    transportDiff,
    allowanceDiff,
    accommodationDiff,
    otherCostsDiff,
    messages,
  };
}

export function computeStats(rows: ClaimRow[]): import('../types').MonthStats {
  const empIds = new Set(rows.map(r => r.empId));
  const submitTotal = rows.reduce((s, r) => s + r.submitAmount, 0);
  const payableTotal = rows.reduce((s, r) => s + r.payableAmount, 0);
  return {
    rowCount: rows.length,
    employeeCount: empIds.size,
    submitTotal,
    payableTotal,
  };
}
