import type { RegulatoryConfig } from '@falaj/core';

/**
 * Annual-leave entitlement for a leave year (F-PAY-03): nothing before 6 months, 2 days per completed month
 * between 6 and 12 months, then the full annual entitlement. VERIFY Art. 29 and part-time pro-rating.
 */
export function annualLeaveEntitlement(completedMonthsOfService: number, asOf: string, config: RegulatoryConfig): number {
  if (completedMonthsOfService < 6) return 0;
  if (completedMonthsOfService < 12) {
    return completedMonthsOfService * Number(config.value('payroll.leave.first_year_days_per_month', asOf));
  }
  return Number(config.value('payroll.leave.annual_days', asOf));
}
