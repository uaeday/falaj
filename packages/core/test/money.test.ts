import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Money, aed } from '../src/index.ts';

describe('Money', () => {
  it('parses and prints decimals exactly', () => {
    expect(aed('1,234.5').minor).toBe(123450n);
    expect(aed('-0.01').toDecimalString()).toBe('-0.01');
    expect(Money.fromDecimal('1.234', 'KWD').toDecimalString()).toBe('1.234');
  });

  it('refuses precision it cannot hold', () => {
    expect(() => aed('1.005')).toThrow(/more than 2 decimals/);
  });

  it('refuses mixed-currency arithmetic', () => {
    expect(() => aed('1').add(Money.fromDecimal('1', 'USD'))).toThrow(/Currency mismatch/);
  });

  it('rounds half away from zero when multiplying', () => {
    expect(aed('99.99').multiply('0.05').toDecimalString()).toBe('5.00'); // 4.9995
    expect(aed('0.10').multiply('0.05').toDecimalString()).toBe('0.01'); // 0.005
    expect(aed('-0.10').multiply('0.05').toDecimalString()).toBe('-0.01');
    expect(aed('100.03').multiply('0.05').toDecimalString()).toBe('5.00'); // 5.0015
  });

  it('converts USD to AED at the peg', () => {
    expect(Money.fromDecimal('1000', 'USD').convert('3.6725', 'AED').toDecimalString()).toBe('3672.50');
    expect(Money.fromDecimal('1', 'KWD').convert('11.95', 'AED').toDecimalString()).toBe('11.95');
  });

  it('allocates without losing or creating a fils', () => {
    const parts = aed('100.00').allocate([1n, 1n, 1n]);
    expect(parts.map((p) => p.toDecimalString())).toEqual(['33.34', '33.33', '33.33']);
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
        fc.array(fc.bigInt({ min: 0n, max: 10_000n }), { minLength: 1, maxLength: 12 }).filter((w) => w.some((x) => x > 0n)),
        (minor, weights) => {
          const parts = Money.of(minor, 'AED').allocate(weights);
          expect(parts.reduce((a, p) => a + p.minor, 0n)).toBe(minor);
        },
      ),
    );
  });

  it('addition is associative and exact for any amounts', () => {
    const amt = fc.bigInt({ min: -(10n ** 15n), max: 10n ** 15n }).map((m) => Money.of(m, 'AED'));
    fc.assert(fc.property(amt, amt, amt, (a, b, c) => a.add(b).add(c).equals(a.add(b.add(c)))));
  });
});
