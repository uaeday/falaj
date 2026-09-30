import { type CurrencyCode, Money } from '@falaj/core';
import type { Account, JournalEntry } from './types.ts';

export interface TrialBalanceRow {
  account: Account;
  debit: Money;
  credit: Money;
  /** Debit-positive net balance. */
  net: Money;
  /** Journal line references so every figure drills down to source (rule: no number without a trail). */
  lineRefs: readonly { entryId: string; entryNo: string; lineNo: number }[];
}

export interface TrialBalance {
  from?: string;
  to: string;
  rows: TrialBalanceRow[];
  totalDebit: Money;
  totalCredit: Money;
}

export function buildTrialBalance(
  entries: Iterable<JournalEntry>,
  account: (id: string) => Account | undefined,
  currency: CurrencyCode,
  range: { from?: string; to: string },
): TrialBalance {
  const acc = new Map<string, { debit: Money; credit: Money; refs: TrialBalanceRow['lineRefs'][number][] }>();
  for (const e of entries) {
    if (e.postingDate > range.to || (range.from && e.postingDate < range.from)) continue;
    for (const l of e.lines) {
      const row = acc.get(l.accountId) ?? { debit: Money.zero(currency), credit: Money.zero(currency), refs: [] };
      if (l.side === 'DEBIT') row.debit = row.debit.add(l.amount);
      else row.credit = row.credit.add(l.amount);
      row.refs.push({ entryId: e.id, entryNo: e.entryNo, lineNo: l.lineNo });
      acc.set(l.accountId, row);
    }
  }
  const rows = [...acc.entries()]
    .map(([id, r]) => {
      const a = account(id);
      if (!a) throw new Error(`Account ${id} missing from directory`);
      return { account: a, debit: r.debit, credit: r.credit, net: r.debit.subtract(r.credit), lineRefs: r.refs };
    })
    .sort((a, b) => a.account.code.localeCompare(b.account.code));
  const totalDebit = rows.reduce((s, r) => s.add(r.debit), Money.zero(currency));
  const totalCredit = rows.reduce((s, r) => s.add(r.credit), Money.zero(currency));
  return { ...(range.from ? { from: range.from } : {}), to: range.to, rows, totalDebit, totalCredit };
}
