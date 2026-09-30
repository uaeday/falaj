import { type CurrencyCode, Money, type Result, err, ok } from '@falaj/core';
import { type PeriodCalendar, SOURCE_SUBLEDGERS } from './periods.ts';
import type { Account, Actor, JournalEntryInput, JournalLine, JournalLineInput, LedgerError } from './types.ts';

export interface ValidationContext {
  functionalCurrency: CurrencyCode;
  account: (id: string) => Account | undefined;
  periods: PeriodCalendar;
  actor: Actor;
}

/** Canonical line shape: drops absent/empty attributes so the content hash survives a storage round-trip. */
export function canonicalLine(line: JournalLineInput, lineNo: number, side: JournalLine['side'], amount: Money): JournalLine {
  const out: JournalLine = { lineNo, accountId: line.accountId, side, amount };
  if (line.txn) out.txn = { amount: line.txn.amount, rate: line.txn.rate };
  if (line.taxCode) out.taxCode = line.taxCode;
  if (line.taxBase) out.taxBase = line.taxBase;
  if (line.emirate) out.emirate = line.emirate;
  if (line.counterpartyId) out.counterpartyId = line.counterpartyId;
  if (line.dimensions && Object.keys(line.dimensions).length) out.dimensions = { ...line.dimensions };
  if (line.memo) out.memo = line.memo;
  return out;
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/**
 * Validates a journal before posting. Returns every problem found (not just the first) so the UI can show them together.
 * Invariants: I-1 balanced, I-2 single-txn-currency balanced, I-3 debit XOR credit, I-5 open period,
 * I-9 control accounts owned by sub-ledgers, I-10 tax-coded lines carry a base.
 */
export function validateEntry(input: JournalEntryInput, ctx: ValidationContext): Result<JournalLine[], LedgerError[]> {
  const errors: LedgerError[] = [];
  const fc = ctx.functionalCurrency;

  if (!isIsoDate(input.postingDate)) errors.push({ code: 'INVALID_DATE', message: `Invalid posting date ${input.postingDate}` });
  if (input.documentDate !== undefined && !isIsoDate(input.documentDate)) {
    errors.push({ code: 'INVALID_DATE', message: `Invalid document date ${input.documentDate}` });
  }
  if (input.lines.length < 2) errors.push({ code: 'TOO_FEW_LINES', message: 'A journal needs at least two lines' });
  if (input.source.type !== 'MANUAL' && !input.source.id) {
    errors.push({ code: 'SOURCE_ID_REQUIRED', message: `${input.source.type} postings must reference their source document` });
  }

  const lines: JournalLine[] = [];
  let debits = Money.zero(fc);
  let credits = Money.zero(fc);
  const txnTotals = new Map<CurrencyCode, bigint>();

  input.lines.forEach((line, i) => {
    const lineNo = i + 1;
    const push = (e: Omit<LedgerError, 'lineNo'>) => errors.push({ ...e, lineNo });
    const { debit, credit } = line;

    for (const m of [debit, credit, line.taxBase]) {
      if (m && m.currency !== fc) push({ code: 'CURRENCY_MISMATCH', message: `Functional amounts must be in ${fc}` });
    }
    if (debit?.isNegative() || credit?.isNegative()) push({ code: 'NEGATIVE_AMOUNT', message: 'Amounts must not be negative' });
    const hasDebit = debit?.isPositive() ?? false;
    const hasCredit = credit?.isPositive() ?? false;
    if (hasDebit && hasCredit) push({ code: 'LINE_BOTH_SIDES', message: 'A line is either a debit or a credit' });
    if (!hasDebit && !hasCredit) push({ code: 'LINE_ZERO', message: 'A line must carry a positive amount' });

    const account = ctx.account(line.accountId);
    if (!account) push({ code: 'UNKNOWN_ACCOUNT', message: `Unknown account ${line.accountId}` });
    else {
      if (account.entityId !== input.entityId) push({ code: 'WRONG_ENTITY', message: `Account ${account.code} belongs to another entity` });
      if (!account.isActive) push({ code: 'INACTIVE_ACCOUNT', message: `Account ${account.code} is inactive` });
      if (account.control && !SOURCE_SUBLEDGERS[input.source.type].includes(account.control)) {
        push({ code: 'CONTROL_ACCOUNT', message: `Account ${account.code} is controlled by ${account.control}` });
      }
    }
    if (line.taxCode && !line.taxBase) push({ code: 'TAX_BASE_REQUIRED', message: 'Tax-coded lines need a taxable base' });

    if (line.txn) {
      const t = line.txn.amount;
      if (t.isNegative() || t.isZero()) push({ code: 'NEGATIVE_AMOUNT', message: 'Transaction amount must be positive' });
      const signed = hasDebit ? t.minor : -t.minor;
      txnTotals.set(t.currency, (txnTotals.get(t.currency) ?? 0n) + signed);
    }

    if (hasDebit !== hasCredit) {
      const amount = (hasDebit ? debit : credit)!;
      if (amount.currency === fc) {
        if (hasDebit) debits = debits.add(amount);
        else credits = credits.add(amount);
        lines.push(canonicalLine(line, lineNo, hasDebit ? 'DEBIT' : 'CREDIT', amount));
      }
    }
  });

  if (!debits.equals(credits)) {
    errors.push({
      code: 'UNBALANCED',
      message: `Debits ${debits.toDecimalString()} ≠ credits ${credits.toDecimalString()} (difference ${debits.subtract(credits).abs().toDecimalString()})`,
    });
  }

  // I-2: when every line carries the same transaction currency, the entry must balance in it too.
  const allTxn = input.lines.every((l) => l.txn);
  if (allTxn && txnTotals.size === 1) {
    const [[cur, total]] = [...txnTotals.entries()] as [[CurrencyCode, bigint]];
    if (total !== 0n) errors.push({ code: 'TXN_UNBALANCED', message: `Entry does not balance in ${cur}` });
  }

  if (isIsoDate(input.postingDate)) {
    const periodError = ctx.periods.check(input.entityId, input.postingDate, input.source.type, ctx.actor);
    if (periodError) errors.push(periodError);
  }

  return errors.length ? err(errors) : ok(lines);
}
