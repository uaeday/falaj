import { Money, aed } from '@falaj/core';
import { describe, expect, it } from 'vitest';
import { Ledger, verifyChain } from '../src/index.ts';
import { ENTITY, accountant, cashSale, controller, makeLedger } from './fixtures.ts';

const codes = (r: { ok: boolean; error?: { code: string }[] }) => (r.ok ? [] : r.error!.map((e) => e.code));

describe('posting (E-02 US-02.1)', () => {
  it('posts a balanced entry with a gapless entry number', async () => {
    const { ledger } = makeLedger();
    const a = await ledger.post(cashSale(), accountant);
    const b = await ledger.post(cashSale(), accountant);
    expect(a.ok && a.value.entryNo).toBe('JE-2027-000001');
    expect(b.ok && b.value.entryNo).toBe('JE-2027-000002');
  });

  it('numbering restarts per fiscal year', async () => {
    const { ledger } = makeLedger();
    await ledger.post(cashSale('2027-12-31'), accountant);
    const r = await ledger.post(cashSale('2028-01-01'), accountant);
    expect(r.ok && r.value.entryNo).toBe('JE-2028-000001');
  });

  it('rejects an unbalanced entry and reports the difference', async () => {
    const { ledger } = makeLedger();
    const r = await ledger.post(
      { ...cashSale(), lines: [{ accountId: 'bank', debit: aed('1050.00') }, { accountId: 'sales', credit: aed('1049.99') }] },
      accountant,
    );
    expect(codes(r)).toEqual(['UNBALANCED']);
    expect(!r.ok && r.error[0]!.message).toContain('difference 0.01');
  });

  it('rejects a line with both sides, a zero line, negatives and single-line entries', async () => {
    const { ledger } = makeLedger();
    expect(codes(await ledger.post({ ...cashSale(), lines: [{ accountId: 'bank', debit: aed('10'), credit: aed('10') }] }, accountant)))
      .toEqual(expect.arrayContaining(['TOO_FEW_LINES', 'LINE_BOTH_SIDES']));
    expect(codes(await ledger.post({ ...cashSale(), lines: [{ accountId: 'bank', debit: aed('0') }, { accountId: 'sales', credit: aed('0') }] }, accountant)))
      .toContain('LINE_ZERO');
    expect(codes(await ledger.post({ ...cashSale(), lines: [{ accountId: 'bank', debit: aed('-5') }, { accountId: 'sales', credit: aed('-5') }] }, accountant)))
      .toContain('NEGATIVE_AMOUNT');
  });

  it('blocks manual postings to control accounts but allows the owning sub-ledger', async () => {
    const { ledger } = makeLedger();
    const lines = [{ accountId: 'ar', debit: aed('105') }, { accountId: 'sales', credit: aed('100') }, { accountId: 'vat-out', credit: aed('5') }];
    expect(codes(await ledger.post({ ...cashSale(), lines }, accountant))).toEqual(['CONTROL_ACCOUNT', 'CONTROL_ACCOUNT']);
    const r = await ledger.post({ ...cashSale(), source: { type: 'AR_INVOICE', id: 'INV-1001' }, lines }, accountant);
    expect(r.ok).toBe(true);
  });

  it('requires source documents for sub-ledger postings', async () => {
    const { ledger } = makeLedger();
    expect(codes(await ledger.post({ ...cashSale(), source: { type: 'AR_INVOICE' } }, accountant))).toContain('SOURCE_ID_REQUIRED');
  });

  it('rejects unknown, inactive and other-entity accounts, and non-AED functional amounts', async () => {
    const { ledger } = makeLedger();
    const r = await ledger.post(
      {
        ...cashSale(),
        lines: [
          { accountId: 'nope', debit: aed('1') },
          { accountId: 'old', debit: aed('1') },
          { accountId: 'other-entity', debit: aed('1') },
          { accountId: 'sales', credit: Money.fromDecimal('3', 'USD') },
        ],
      },
      accountant,
    );
    expect(codes(r)).toEqual(expect.arrayContaining(['UNKNOWN_ACCOUNT', 'INACTIVE_ACCOUNT', 'WRONG_ENTITY', 'CURRENCY_MISMATCH']));
  });

  it('requires a taxable base on tax-coded lines (I-10)', async () => {
    const { ledger } = makeLedger();
    const lines = [{ accountId: 'bank', debit: aed('100') }, { accountId: 'sales', credit: aed('100'), taxCode: 'SR' }];
    expect(codes(await ledger.post({ ...cashSale(), lines }, accountant))).toEqual(['TAX_BASE_REQUIRED']);
  });

  it('rejects invalid calendar dates', async () => {
    const { ledger } = makeLedger();
    expect(codes(await ledger.post(cashSale('2027-02-30'), accountant))).toContain('INVALID_DATE');
  });
});

describe('multi-currency (US-02.3)', () => {
  it('USD invoice at the peg balances in USD and AED', async () => {
    const { ledger } = makeLedger();
    const usd = Money.fromDecimal('1000.00', 'USD');
    const aedAmt = usd.convert('3.6725', 'AED');
    expect(aedAmt.toDecimalString()).toBe('3672.50');
    const r = await ledger.post(
      {
        ...cashSale(),
        lines: [
          { accountId: 'bank', debit: aedAmt, txn: { amount: usd, rate: '3.6725' } },
          { accountId: 'sales', credit: aedAmt, txn: { amount: usd, rate: '3.6725' } },
        ],
      },
      accountant,
    );
    expect(r.ok).toBe(true);
  });

  it('rejects an entry balanced in AED but not in its single transaction currency', async () => {
    const { ledger } = makeLedger();
    const r = await ledger.post(
      {
        ...cashSale(),
        lines: [
          { accountId: 'bank', debit: aed('3672.50'), txn: { amount: Money.fromDecimal('1000', 'USD'), rate: '3.6725' } },
          { accountId: 'sales', credit: aed('3672.50'), txn: { amount: Money.fromDecimal('999', 'USD'), rate: '3.6762' } },
        ],
      },
      accountant,
    );
    expect(codes(r)).toEqual(['TXN_UNBALANCED']);
  });
});

describe('periods (US-01.3)', () => {
  it('locked periods refuse postings; soft-closed need a permission', async () => {
    const { ledger, periods } = makeLedger();
    periods.setStatus(ENTITY, '2027-01', 'LOCKED');
    expect(codes(await ledger.post(cashSale('2027-01-31'), controller))).toEqual(['PERIOD_LOCKED']);
    periods.setStatus(ENTITY, '2027-01', 'SOFT_CLOSED');
    expect(codes(await ledger.post(cashSale('2027-01-31'), accountant))).toEqual(['PERIOD_SOFT_CLOSED']);
    expect((await ledger.post(cashSale('2027-01-31'), controller)).ok).toBe(true);
  });

  it('has no period for dates outside the calendar', async () => {
    const { ledger } = makeLedger();
    expect(codes(await ledger.post(cashSale('2026-12-31'), accountant))).toEqual(['PERIOD_NOT_FOUND']);
  });
});

describe('immutability and reversal (US-02.2)', () => {
  it('posted entries are frozen', async () => {
    const { ledger } = makeLedger();
    const r = await ledger.post(cashSale(), accountant);
    if (!r.ok) throw new Error('post failed');
    expect(Object.isFrozen(r.value)).toBe(true);
    expect(Object.isFrozen(r.value.lines[0])).toBe(true);
    expect(() => {
      (r.value as { memo: string }).memo = 'edited';
    }).toThrow(TypeError);
    expect(Ledger.verifyEntryHash(r.value)).toBe(true);
    expect(Ledger.verifyEntryHash({ ...r.value, memo: 'tampered' })).toBe(false);
  });

  it('reversal mirrors the original, links both ways, and happens once', async () => {
    const { ledger } = makeLedger();
    const orig = await ledger.post(cashSale(), accountant);
    if (!orig.ok) throw new Error('post failed');
    const rev = await ledger.reverse(orig.value.id, { postingDate: '2027-02-15', reason: 'Duplicate' }, accountant);
    if (!rev.ok) throw new Error(JSON.stringify(rev.error));
    expect(rev.value.reversesId).toBe(orig.value.id);
    expect((await ledger.get(orig.value.id))?.reversedById).toBe(rev.value.id);
    expect(rev.value.lines.map((l) => [l.accountId, l.side, l.amount.toDecimalString()])).toEqual([
      ['bank', 'CREDIT', '1050.00'],
      ['sales', 'DEBIT', '1000.00'],
      ['capital', 'DEBIT', '50.00'],
    ]);
    expect(codes(await ledger.reverse(orig.value.id, { postingDate: '2027-02-16', reason: 'Again' }, accountant))).toEqual(['ALREADY_REVERSED']);
    expect(codes(await ledger.reverse(rev.value.id, { postingDate: '2027-02-16', reason: 'Undo' }, accountant))).toEqual(['CANNOT_REVERSE_REVERSAL']);
    expect(codes(await ledger.reverse('missing', { postingDate: '2027-02-16', reason: 'x' }, accountant))).toEqual(['ENTRY_NOT_FOUND']);
  });

  it('a reversal into a locked period is refused', async () => {
    const { ledger, periods } = makeLedger();
    const orig = await ledger.post(cashSale(), accountant);
    if (!orig.ok) throw new Error();
    periods.setStatus(ENTITY, '2027-02', 'LOCKED');
    expect(codes(await ledger.reverse(orig.value.id, { postingDate: '2027-02-20', reason: 'x' }, accountant))).toEqual(['PERIOD_LOCKED']);
    expect((await ledger.reverse(orig.value.id, { postingDate: '2027-03-01', reason: 'x' }, accountant)).ok).toBe(true);
  });
});

describe('trial balance & drill-down (US-02.4)', () => {
  it('balances and drills down to journal lines', async () => {
    const { ledger } = makeLedger();
    await ledger.post(cashSale('2027-02-10'), accountant);
    await ledger.post(cashSale('2027-03-10'), accountant);
    const tb = await ledger.trialBalance(ENTITY, { from: '2027-01-01', to: '2027-02-28' });
    expect(tb.totalDebit.equals(tb.totalCredit)).toBe(true);
    const sales = tb.rows.find((r) => r.account.code === '4000')!;
    expect(sales.net.toDecimalString()).toBe('-1000.00');
    expect(sales.lineRefs).toEqual([{ entryId: 'je-1', entryNo: 'JE-2027-000001', lineNo: 2 }]);
  });
});

describe('audit trail (US-01.4)', () => {
  it('every posting and reversal lands in a verifiable hash chain', async () => {
    const { ledger, chain } = makeLedger();
    const r = await ledger.post(cashSale(), accountant);
    if (!r.ok) throw new Error();
    await ledger.reverse(r.value.id, { postingDate: '2027-02-11', reason: 'x' }, accountant);
    expect(chain.all().map((e) => e.action)).toEqual(['journal.posted', 'journal.reversed']);
    expect(verifyChain(chain.all())).toMatchObject({ valid: true, length: 2 });
  });
});
