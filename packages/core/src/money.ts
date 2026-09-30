import { type CurrencyCode, assertCurrency, minorUnits } from './currency.ts';
import { divRoundHalfUp, mulDecimalRound, parseDecimal, pow10 } from './decimal.ts';

/**
 * Immutable monetary amount stored as integer minor units (fils for AED).
 * Rounding is always explicit and half-up.
 */
export class Money {
  private constructor(
    readonly minor: bigint,
    readonly currency: CurrencyCode,
  ) {
    Object.freeze(this);
  }

  static of(minor: bigint | number, currency: CurrencyCode): Money {
    assertCurrency(currency);
    if (typeof minor === 'number' && !Number.isSafeInteger(minor)) {
      throw new RangeError(`Minor units must be a safe integer, got ${minor}`);
    }
    return new Money(BigInt(minor), currency);
  }

  static zero(currency: CurrencyCode): Money {
    return Money.of(0n, currency);
  }

  /** Parses "1,234.50". Rejects more decimals than the currency allows, to avoid silent rounding. */
  static fromDecimal(amount: string, currency: CurrencyCode): Money {
    const exp = minorUnits(currency);
    const { units, scale } = parseDecimal(amount);
    if (scale > exp) throw new RangeError(`${amount} has more than ${exp} decimals for ${currency}`);
    return Money.of(units * pow10(exp - scale), currency);
  }

  add(other: Money): Money {
    this.assertSame(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSame(other);
    return new Money(this.minor - other.minor, this.currency);
  }

  negate(): Money {
    return new Money(-this.minor, this.currency);
  }

  abs(): Money {
    return this.minor < 0n ? this.negate() : this;
  }

  /** Multiplies by a decimal factor (e.g. a VAT rate "0.05" or a quantity "2.5"), rounding half-up. */
  multiply(factor: string): Money {
    return new Money(mulDecimalRound(this.minor, factor), this.currency);
  }

  /** Divides by a decimal divisor (e.g. "1.05" to strip VAT from a tax-inclusive price), rounding half-up. */
  divide(divisor: string): Money {
    const { units, scale } = parseDecimal(divisor);
    return new Money(divRoundHalfUp(this.minor * pow10(scale), units), this.currency);
  }

  /** Converts at `rate` (units of target per 1 unit of this currency), rounding half-up in the target. */
  convert(rate: string, target: CurrencyCode): Money {
    const shift = minorUnits(target) - minorUnits(this.currency);
    const { units, scale } = parseDecimal(rate);
    const num = this.minor * units * (shift >= 0 ? pow10(shift) : 1n);
    const den = pow10(scale) * (shift < 0 ? pow10(-shift) : 1n);
    return Money.of(divRoundHalfUp(num, den), target);
  }

  /** Splits into parts proportional to `weights` without losing a fils (largest-remainder method). */
  allocate(weights: readonly bigint[]): Money[] {
    const total = weights.reduce((a, b) => a + b, 0n);
    if (weights.length === 0 || total <= 0n || weights.some((w) => w < 0n)) {
      throw new RangeError('Weights must be non-negative with a positive sum');
    }
    const sign = this.minor < 0n ? -1n : 1n;
    const amount = this.minor * sign;
    const shares = weights.map((w, i) => ({ i, q: (amount * w) / total, r: (amount * w) % total }));
    let leftover = amount - shares.reduce((a, s) => a + s.q, 0n);
    for (const s of [...shares].sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i))) {
      if (leftover === 0n) break;
      s.q += 1n;
      leftover -= 1n;
    }
    return shares.map((s) => new Money(s.q * sign, this.currency));
  }

  isZero(): boolean {
    return this.minor === 0n;
  }
  isNegative(): boolean {
    return this.minor < 0n;
  }
  isPositive(): boolean {
    return this.minor > 0n;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSame(other);
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0;
  }

  toDecimalString(): string {
    const exp = minorUnits(this.currency);
    const neg = this.minor < 0n;
    const digits = (neg ? -this.minor : this.minor).toString().padStart(exp + 1, '0');
    const whole = exp === 0 ? digits : digits.slice(0, -exp);
    const frac = exp === 0 ? '' : `.${digits.slice(-exp)}`;
    return `${neg ? '-' : ''}${whole}${frac}`;
  }

  /** Locale formatting for display only. Amounts stay LTR with Western digits unless the locale says otherwise. */
  format(locale = 'en-AE'): string {
    const exp = minorUnits(this.currency);
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(this.toDecimalString() as unknown as number);
    return `${this.currency} ${formatted}`;
  }

  toJSON(): { minor: string; currency: CurrencyCode } {
    return { minor: this.minor.toString(), currency: this.currency };
  }

  toString(): string {
    return `${this.currency} ${this.toDecimalString()}`;
  }

  private assertSame(other: Money): void {
    if (other.currency !== this.currency) {
      throw new TypeError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}

export const aed = (amount: string): Money => Money.fromDecimal(amount, 'AED');
