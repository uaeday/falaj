import { aed } from '@falaj/core';
import { describe, expect, it } from 'vitest';
import { buildVat201, type VatTransaction } from '../src/index.ts';

const period = { start: '2027-01-01', end: '2027-03-31' };
const t = (p: Partial<VatTransaction> & Pick<VatTransaction, 'ref' | 'direction' | 'code' | 'net' | 'vat'>): VatTransaction => ({ date: '2027-02-15', ...p });

function build(txns: VatTransaction[]) {
  const r = buildVat201(txns, period);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe('VAT201 (US-03.2, US-03.3)', () => {
  it('splits standard-rated outputs by emirate and totals box 8', () => {
    const ret = build([
      t({ ref: 'INV-1', direction: 'OUTPUT', code: 'SR', net: aed('400000'), vat: aed('20000'), emirate: 'DXB' }),
      t({ ref: 'INV-2', direction: 'OUTPUT', code: 'SR', net: aed('100000'), vat: aed('5000'), emirate: 'AUH' }),
    ]);
    expect(ret.boxes['1b'].amount.toDecimalString()).toBe('400000.00');
    expect(ret.boxes['1b'].vat.toDecimalString()).toBe('20000.00');
    expect(ret.boxes['1a'].vat.toDecimalString()).toBe('5000.00');
    expect(ret.boxes['8'].vat.toDecimalString()).toBe('25000.00');
    expect(ret.boxes['1b'].refs).toEqual(['INV-1']);
  });

  it('computes net payable (box 14 = box 12 − box 13)', () => {
    const ret = build([
      t({ ref: 'S', direction: 'OUTPUT', code: 'SR', net: aed('500000'), vat: aed('25000'), emirate: 'DXB' }),
      t({ ref: 'P', direction: 'INPUT', code: 'SR', net: aed('190000'), vat: aed('9500') }),
    ]);
    expect(ret.boxes['12'].vat.toDecimalString()).toBe('25000.00');
    expect(ret.boxes['13'].vat.toDecimalString()).toBe('9500.00');
    expect(ret.netPayable.toDecimalString()).toBe('15500.00');
  });

  it('reverse charge on imported services: box 3 output and box 10 input net to zero', () => {
    const ret = build([t({ ref: 'BILL-9', direction: 'INPUT', code: 'RC_SVC', net: aed('20000'), vat: aed('1000') })]);
    expect(ret.boxes['3'].vat.toDecimalString()).toBe('1000.00');
    expect(ret.boxes['10'].vat.toDecimalString()).toBe('1000.00');
    expect(ret.netPayable.isZero()).toBe(true);
  });

  it('imports of goods go to box 6 and box 10', () => {
    const ret = build([t({ ref: 'CUS-1', direction: 'INPUT', code: 'RC_IMP', net: aed('80000'), vat: aed('4000') })]);
    expect(ret.boxes['6'].vat.toDecimalString()).toBe('4000.00');
    expect(ret.boxes['10'].vat.toDecimalString()).toBe('4000.00');
  });

  it('excludes blocked input VAT and lists it separately', () => {
    const ret = build([
      t({ ref: 'ENT-1', direction: 'INPUT', code: 'SR', net: aed('5000'), vat: aed('250'), recoverable: false, blockedReason: 'ENTERTAINMENT' }),
    ]);
    expect(ret.boxes['9'].vat.isZero()).toBe(true);
    expect(ret.blockedInputs.map((b) => b.ref)).toEqual(['ENT-1']);
  });

  it('blocked reverse charge still declares the output tax', () => {
    const ret = build([t({ ref: 'RC-B', direction: 'INPUT', code: 'RC_SVC', net: aed('1000'), vat: aed('50'), recoverable: false })]);
    expect(ret.boxes['3'].vat.toDecimalString()).toBe('50.00');
    expect(ret.boxes['10'].vat.isZero()).toBe(true);
    expect(ret.netPayable.toDecimalString()).toBe('50.00');
  });

  it('reports zero-rated and exempt supplies without VAT; ignores out-of-scope', () => {
    const ret = build([
      t({ ref: 'Z', direction: 'OUTPUT', code: 'ZR', net: aed('7000'), vat: aed('0') }),
      t({ ref: 'E', direction: 'OUTPUT', code: 'EX', net: aed('3000'), vat: aed('0') }),
      t({ ref: 'O', direction: 'OUTPUT', code: 'OOS', net: aed('9999'), vat: aed('0') }),
    ]);
    expect(ret.boxes['4'].amount.toDecimalString()).toBe('7000.00');
    expect(ret.boxes['5'].amount.toDecimalString()).toBe('3000.00');
    expect(ret.boxes['8'].amount.toDecimalString()).toBe('10000.00');
  });

  it('tourist refunds reduce box 2', () => {
    const ret = build([t({ ref: 'TRS', direction: 'OUTPUT', code: 'SR', net: aed('1000'), vat: aed('50'), adjustment: 'TOURIST_REFUND' })]);
    expect(ret.boxes['2'].vat.toDecimalString()).toBe('-50.00');
  });

  it('reports every problem instead of filing a wrong return', () => {
    const r = buildVat201(
      [
        t({ ref: 'A', direction: 'OUTPUT', code: 'SR', net: aed('100'), vat: aed('5') }),
        t({ ref: 'B', date: '2027-04-01', direction: 'OUTPUT', code: 'SR', net: aed('100'), vat: aed('5'), emirate: 'DXB' }),
        t({ ref: 'C', direction: 'OUTPUT', code: 'ZR', net: aed('100'), vat: aed('5') }),
        t({ ref: 'D', direction: 'OUTPUT', code: 'RC_SVC', net: aed('100'), vat: aed('5') }),
      ],
      period,
    );
    expect(!r.ok && r.error.map((i) => `${i.ref}:${i.code}`)).toEqual(['A:EMIRATE_REQUIRED', 'B:OUT_OF_PERIOD', 'C:ZERO_RATED_WITH_VAT', 'D:RC_ON_OUTPUT']);
  });
});
