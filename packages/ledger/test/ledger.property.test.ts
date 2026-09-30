import { Money } from '@falaj/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { JournalLineInput } from '../src/index.ts';
import { ENTITY, accountant, makeLedger } from './fixtures.ts';

const NON_CONTROL = ['bank', 'capital', 'sales', 'rent'];
const aedMinor = (m: bigint) => Money.of(m, 'AED');

/** Arbitrary balanced journal: random debits, credits allocated from the same total. */
const balancedLines = fc
  .tuple(
    fc.array(fc.bigInt({ min: 1n, max: 10n ** 11n }), { minLength: 1, maxLength: 6 }),
    fc.array(fc.bigInt({ min: 1n, max: 1000n }), { minLength: 1, maxLength: 6 }),
    fc.array(fc.constantFrom(...NON_CONTROL), { minLength: 12, maxLength: 12 }),
  )
  .map(([debits, creditWeights, accts]) => {
    const total = debits.reduce((a, b) => a + b, 0n);
    const credits = aedMinor(total).allocate(creditWeights).filter((c) => c.isPositive());
    const lines: JournalLineInput[] = [
      ...debits.map((d, i) => ({ accountId: accts[i]!, debit: aedMinor(d) })),
      ...credits.map((c, i) => ({ accountId: accts[6 + i]!, credit: c })),
    ];
    return lines;
  });

const day = fc.integer({ min: 1, max: 28 }).map((d) => `2027-06-${String(d).padStart(2, '0')}`);

describe('ledger properties', () => {
  it('any balanced journal posts, and the trial balance always balances', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.tuple(balancedLines, day), { minLength: 1, maxLength: 40 }), async (journals) => {
        const { ledger } = makeLedger();
        for (const [lines, date] of journals) {
          const r = await ledger.post({ entityId: ENTITY, postingDate: date, source: { type: 'MANUAL' }, memo: 'p', lines }, accountant);
          expect(r.ok).toBe(true);
        }
        const tb = await ledger.trialBalance(ENTITY, { to: '2027-12-31' });
        expect(tb.totalDebit.equals(tb.totalCredit)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('any imbalance, however small, is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(balancedLines, fc.bigInt({ min: 1n, max: 10n ** 9n }), fc.boolean(), async (lines, delta, onDebit) => {
        const { ledger } = makeLedger();
        const skewed = [...lines, onDebit ? { accountId: 'rent', debit: aedMinor(delta) } : { accountId: 'rent', credit: aedMinor(delta) }];
        const r = await ledger.post({ entityId: ENTITY, postingDate: '2027-06-01', source: { type: 'MANUAL' }, memo: 'p', lines: skewed }, accountant);
        expect(r.ok).toBe(false);
        expect(!r.ok && r.error.map((e) => e.code)).toContain('UNBALANCED');
      }),
      { numRuns: 500 },
    );
  });

  it('reversing every entry brings every account back to zero', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(balancedLines, { minLength: 1, maxLength: 20 }), async (journals) => {
        const { ledger } = makeLedger();
        for (const lines of journals) {
          const r = await ledger.post({ entityId: ENTITY, postingDate: '2027-06-01', source: { type: 'MANUAL' }, memo: 'p', lines }, accountant);
          if (!r.ok) throw new Error('unexpected');
          expect((await ledger.reverse(r.value.id, { postingDate: '2027-06-02', reason: 'prop' }, accountant)).ok).toBe(true);
        }
        for (const row of (await ledger.trialBalance(ENTITY, { to: '2027-12-31' })).rows) expect(row.net.isZero()).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
