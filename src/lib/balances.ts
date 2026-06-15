import type { Expense, Settlement, Group, Balance, DebtSummary } from '../types';

/**
 * Round to 2 decimal places using banker-style rounding
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate net balances for a group.
 * Returns a map: userId -> net amount (positive = owed money, negative = owes money)
 */
export function calculateBalances(
  groupId: string,
  expenses: Expense[],
  settlements: Settlement[],
  group: Group
): Balance[] {
  // Only non-settlement expenses for this group
  const groupExpenses = expenses.filter(
    (e) => e.groupId === groupId && !e.isSettlement
  );
  const groupSettlements = settlements.filter((s) => s.groupId === groupId);

  // net[userId] = how much they are owed (positive) or owe (negative)
  const net: Record<string, number> = {};
  const totalPaid: Record<string, number> = {};
  const totalOwed: Record<string, number> = {};

  // Collect all user IDs from group members
  for (const m of group.members) {
    net[m.userId] = 0;
    totalPaid[m.userId] = 0;
    totalOwed[m.userId] = 0;
  }

  // Process expenses
  const expenseBreakdownMap: Record<
    string,
    Array<{
      expenseId: string;
      description: string;
      date: string;
      youPaid: number;
      yourShare: number;
      net: number;
    }>
  > = {};

  for (const uid of Object.keys(net)) {
    expenseBreakdownMap[uid] = [];
  }

  for (const expense of groupExpenses) {
    const payer = expense.paidById;
    const total = expense.amountInr;

    // Payer gets credit for the full amount
    if (net[payer] !== undefined) {
      net[payer] = round2(net[payer] + total);
      totalPaid[payer] = round2(totalPaid[payer] + total);
    }

    // Each person owes their share
    for (const share of expense.shares) {
      const uid = share.userId;
      if (net[uid] !== undefined) {
        net[uid] = round2(net[uid] - share.shareAmount);
        totalOwed[uid] = round2(totalOwed[uid] + share.shareAmount);
      }
    }

    // Build per-user breakdown
    for (const uid of Object.keys(net)) {
      const share = expense.shares.find((s) => s.userId === uid);
      const yourShare = share ? share.shareAmount : 0;
      const youPaid = uid === payer ? total : 0;
      const entryNet = round2(youPaid - yourShare);

      if (youPaid !== 0 || yourShare !== 0) {
        expenseBreakdownMap[uid]?.push({
          expenseId: expense.id,
          description: expense.description,
          date: expense.date,
          youPaid,
          yourShare,
          net: entryNet,
        });
      }
    }
  }

  // Process settlements
  for (const s of groupSettlements) {
    // Payer's debt decreases (net goes up / less negative)
    if (net[s.payerId] !== undefined) {
      net[s.payerId] = round2(net[s.payerId] + s.amount);
    }
    // Payee's credit decreases (net goes down)
    if (net[s.payeeId] !== undefined) {
      net[s.payeeId] = round2(net[s.payeeId] - s.amount);
    }
  }

  return group.members.map((m) => ({
    userId: m.userId,
    userName: m.name,
    net: round2(net[m.userId] ?? 0),
    totalPaid: round2(totalPaid[m.userId] ?? 0),
    totalOwed: round2(totalOwed[m.userId] ?? 0),
    expenseBreakdown: expenseBreakdownMap[m.userId] ?? [],
  }));
}

/**
 * Simplify debts to the minimum number of transactions
 * (greedy min-cost algorithm)
 */
export function simplifyDebts(
  balances: Balance[],
  memberMap: Record<string, string>
): DebtSummary[] {
  const result: DebtSummary[] = [];

  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  for (const b of balances) {
    const rounded = round2(b.net);
    if (rounded > 0.01) creditors.push({ id: b.userId, amount: rounded });
    else if (rounded < -0.01) debtors.push({ id: b.userId, amount: Math.abs(rounded) });
  }

  // Sort descending
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = round2(Math.min(creditor.amount, debtor.amount));

    if (amount > 0.01) {
      result.push({
        from: debtor.id,
        fromName: memberMap[debtor.id] ?? debtor.id,
        to: creditor.id,
        toName: memberMap[creditor.id] ?? creditor.id,
        amount,
      });
    }

    creditor.amount = round2(creditor.amount - amount);
    debtor.amount = round2(debtor.amount - amount);

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return result;
}
