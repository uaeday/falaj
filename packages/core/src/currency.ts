/** ISO 4217 minor-unit exponents for currencies common in UAE trade. Unlisted codes default to 2. */
const MINOR_UNITS: Record<string, number> = {
  AED: 2, USD: 2, EUR: 2, GBP: 2, INR: 2, PKR: 2, SAR: 2, QAR: 2, CNY: 2, PHP: 2, EGP: 2,
  KWD: 3, BHD: 3, OMR: 3, JOD: 3,
  JPY: 0, KRW: 0,
};

export type CurrencyCode = string;

export const FUNCTIONAL_CURRENCY: CurrencyCode = 'AED';

export function minorUnits(currency: CurrencyCode): number {
  assertCurrency(currency);
  return MINOR_UNITS[currency] ?? 2;
}

export function assertCurrency(currency: string): asserts currency is CurrencyCode {
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError(`Invalid ISO 4217 code: ${currency}`);
}
