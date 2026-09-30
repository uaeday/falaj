/**
 * Exact decimal helpers on bigint. Money never touches floating point.
 */

export interface ScaledDecimal {
  /** Value as an integer, i.e. `units / 10^scale` is the decimal. */
  units: bigint;
  scale: number;
}

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

export function parseDecimal(input: string): ScaledDecimal {
  const m = DECIMAL_RE.exec(input.trim().replaceAll(',', ''));
  if (!m) throw new RangeError(`Not a decimal number: "${input}"`);
  const [, sign, whole, frac = ''] = m;
  const units = BigInt(`${whole}${frac}`) * (sign === '-' ? -1n : 1n);
  return { units, scale: frac.length };
}

export const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** Integer division rounding half away from zero (the "commercial" rounding used for AED fils). */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = n / d;
  const r = n % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}

/** Multiply an integer by a decimal string and round half-up to an integer. */
export function mulDecimalRound(value: bigint, factor: string): bigint {
  const { units, scale } = parseDecimal(factor);
  return divRoundHalfUp(value * units, pow10(scale));
}
