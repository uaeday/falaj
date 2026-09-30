import { Money, aed } from '@falaj/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateVatDocument, calculateVatLine, defaultUaeConfig, type VatCode } from '../src/index.ts';

const config = defaultUaeConfig();
const ctx = { date: '2027-02-10', config };

describe('VAT line calculation — worked examples (US-03.1)', () => {
  it.each([
    // qty, unit price, code, mode, discount, expected net, vat, gross
    ['1', '1000.00', 'SR', 'EXCLUSIVE', undefined, '1000.00', '50.00', '1050.00'],
    ['3', '33.33', 'SR', 'EXCLUSIVE', undefined, '99.99', '5.00', '104.99'],
    ['1', '0.10', 'SR', 'EXCLUSIVE', undefined, '0.10', '0.01', '0.11'],
    ['1', '0.09', 'SR', 'EXCLUSIVE', undefined, '0.09', '0.00', '0.09'],
    ['7', '14.29', 'SR', 'EXCLUSIVE', undefined, '100.03', '5.00', '105.03'],
    ['2.5', '19.99', 'SR', 'EXCLUSIVE', undefined, '49.98', '2.50', '52.48'],
    ['10', '100.00', 'SR', 'EXCLUSIVE', '50.00', '950.00', '47.50', '997.50'],
    ['1', '105.00', 'SR', 'INCLUSIVE', undefined, '100.00', '5.00', '105.00'],
    ['1', '1.00', 'SR', 'INCLUSIVE', undefined, '0.95', '0.05', '1.00'],
    ['1', '99.99', 'SR', 'INCLUSIVE', undefined, '95.23', '4.76', '99.99'],
    ['1', '1000.00', 'ZR', 'EXCLUSIVE', undefined, '1000.00', '0.00', '1000.00'],
    ['1', '1000.00', 'EX', 'EXCLUSIVE', undefined, '1000.00', '0.00', '1000.00'],
    ['1', '1000.00', 'OOS', 'EXCLUSIVE', undefined, '1000.00', '0.00', '1000.00'],
    ['1', '1000.00', 'ZR', 'INCLUSIVE', undefined, '1000.00', '0.00', '1000.00'],
  ] as const)('%s × %s %s (%s, discount %s) → net %s vat %s gross %s', (qty, price, code, mode, discount, net, vat, gross) => {
    const r = calculateVatLine(
      { quantity: qty, unitPrice: aed(price), code, priceMode: mode, ...(discount ? { discount: aed(discount) } : {}) },
      ctx,
    );
    expect([r.net, r.vat, r.gross].map((m) => m.toDecimalString())).toEqual([net, vat, gross]);
  });

  it('reverse-charge lines carry no VAT on the document but compute the self-accounted VAT', () => {
    const r = calculateVatLine({ quantity: '1', unitPrice: aed('20000.00'), code: 'RC_SVC' }, ctx);
    expect(r.vat.isZero()).toBe(true);
    expect(r.selfAccountedVat.toDecimalString()).toBe('1000.00');
  });

  it('USD lines are calculated in USD', () => {
    const r = calculateVatLine({ quantity: '1', unitPrice: Money.fromDecimal('1000', 'USD'), code: 'SR' }, ctx);
    expect(r.vat.toString()).toBe('USD 50.00');
  });

  it('refuses discounts larger than the line', () => {
    expect(() => calculateVatLine({ quantity: '1', unitPrice: aed('10'), discount: aed('11'), code: 'SR' }, ctx)).toThrow();
  });

  it('uses the rate in force on the document date', () => {
    const future = config.with([
      { key: 'vat.rate.standard', value: '0.05', effectiveFrom: '2018-01-01', effectiveTo: '2029-12-31', source: 'test', authority: 'FTA', verify: false },
      { key: 'vat.rate.standard', value: '0.075', effectiveFrom: '2030-01-01', source: 'hypothetical', authority: 'FTA', verify: true },
    ]);
    const line = { quantity: '1', unitPrice: aed('100.00'), code: 'SR' as const };
    expect(calculateVatLine(line, { date: '2029-12-31', config: future }).vat.toDecimalString()).toBe('5.00');
    expect(calculateVatLine(line, { date: '2030-01-01', config: future }).vat.toDecimalString()).toBe('7.50');
  });
});

describe('VAT document totals', () => {
  it('sums line-rounded VAT and groups by rate (brand-book sample invoice)', () => {
    const doc = calculateVatDocument(
      [
        { quantity: '2', unitPrice: aed('4500.00'), code: 'SR' },
        { quantity: '1', unitPrice: aed('3000.00'), code: 'SR' },
        { quantity: '1', unitPrice: aed('200.00'), code: 'ZR' },
      ],
      ctx,
    );
    expect(doc.net.toDecimalString()).toBe('12200.00');
    expect(doc.vat.toDecimalString()).toBe('600.00');
    expect(doc.gross.toDecimalString()).toBe('12800.00');
    expect(doc.byRate.map((g) => [g.rate, g.net.toDecimalString(), g.vat.toDecimalString()])).toEqual([
      ['0.05', '12000.00', '600.00'],
      ['0', '200.00', '0.00'],
    ]);
  });
});

describe('VAT properties', () => {
  const minor = fc.bigInt({ min: 0n, max: 10n ** 12n });
  const codes = fc.constantFrom<VatCode>('SR', 'ZR', 'EX', 'OOS');

  it('inclusive split always recombines exactly: net + vat = gross', () => {
    fc.assert(fc.property(minor, codes, (m, code) => {
      const r = calculateVatLine({ quantity: '1', unitPrice: Money.of(m, 'AED'), code, priceMode: 'INCLUSIVE' }, ctx);
      expect(r.net.add(r.vat).equals(r.gross)).toBe(true);
    }));
  });

  it('exclusive VAT is within half a fils of the exact 5%', () => {
    fc.assert(fc.property(minor, (m) => {
      const r = calculateVatLine({ quantity: '1', unitPrice: Money.of(m, 'AED'), code: 'SR' }, ctx);
      const diff = r.vat.minor * 100n - m * 5n; // scaled by 100 to stay integral
      expect(diff >= -50n && diff <= 50n).toBe(true);
    }));
  });
});
