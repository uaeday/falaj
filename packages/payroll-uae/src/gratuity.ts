import { Money, type RegulatoryConfig, divRoundHalfUp } from '@falaj/core';

export interface GratuityInput {
  /** Last basic monthly wage (allowances excluded). */
  basicMonthly: Money;
  /** Continuous service in days, after excluding unpaid absence (VERIFY exclusion rules). */
  serviceDays: number;
  /** Date the rules are read as of (normally the last working day). */
  asOf: string;
}

export interface GratuityResult {
  amount: Money;
  entitlementDays: string;
  capped: boolean;
  explanation: string;
}

/**
 * End-of-service gratuity (F-PAY-04). With divisor D (30), year basis Y (365), rates r1 (21) and r2 (30) and s service days:
 *   amount = basic × (r1·min(s, 5Y) + r2·max(s − 5Y, 0)) / (Y · D), capped at `cap_months` × basic.
 * One rounding step, half-up to the fils. Service under the minimum earns nothing.
 */
export function endOfServiceGratuity(input: GratuityInput, config: RegulatoryConfig): GratuityResult {
  const v = (k: string) => BigInt(config.value(`payroll.gratuity.${k}`, input.asOf));
  const s = BigInt(input.serviceDays);
  const zero = Money.zero(input.basicMonthly.currency);
  if (input.serviceDays < 0) throw new RangeError('Service days cannot be negative');
  if (s < v('min_service_days')) {
    return { amount: zero, entitlementDays: '0', capped: false, explanation: 'Less than one year of continuous service' };
  }
  const Y = v('days_per_year_basis');
  const D = v('daily_wage_divisor');
  const first = s < 5n * Y ? s : 5n * Y;
  const rest = s > 5n * Y ? s - 5n * Y : 0n;
  const dayYears = v('days_per_year.first_5') * first + v('days_per_year.after_5') * rest; // entitlement days × Y
  const uncapped = Money.of(divRoundHalfUp(input.basicMonthly.minor * dayYears, Y * D), input.basicMonthly.currency);
  const cap = Money.of(input.basicMonthly.minor * v('cap_months'), input.basicMonthly.currency);
  const capped = uncapped.compare(cap) > 0;
  const days = Number((dayYears * 100n) / Y) / 100;
  return {
    amount: capped ? cap : uncapped,
    entitlementDays: days.toFixed(2),
    capped,
    explanation: `${days.toFixed(2)} days at ${input.basicMonthly.toDecimalString()}/${D}${capped ? `, capped at ${v('cap_months')} months' wage` : ''}`,
  };
}

/** Monthly accrual = change in the gratuity liability since last month (IAS 19 simplified). */
export function gratuityAccrual(prior: GratuityResult, current: GratuityResult): Money {
  return current.amount.subtract(prior.amount);
}
