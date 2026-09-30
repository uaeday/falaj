import { RegulatoryConfig, type RuleVersion } from '@falaj/core';

/**
 * Labour-law values under FDL 33/2021 and Cabinet Resolution 1/2022 as understood on 2026-09-30.
 * NOT LEGAL ADVICE. All are verify: true until an HR/legal reviewer signs off the worked examples.
 */
export const UAE_PAYROLL_RULES: readonly RuleVersion[] = [
  { key: 'payroll.gratuity.min_service_days', value: '365', effectiveFrom: '2022-02-02', source: 'FDL 33/2021 Art. 51', authority: 'MOHRE', verify: true },
  { key: 'payroll.gratuity.days_per_year.first_5', value: '21', effectiveFrom: '2022-02-02', source: 'FDL 33/2021 Art. 51', authority: 'MOHRE', verify: true },
  { key: 'payroll.gratuity.days_per_year.after_5', value: '30', effectiveFrom: '2022-02-02', source: 'FDL 33/2021 Art. 51', authority: 'MOHRE', verify: true },
  { key: 'payroll.gratuity.cap_months', value: '24', effectiveFrom: '2022-02-02', source: 'FDL 33/2021 Art. 51 (cap: two years\' wage)', authority: 'MOHRE', verify: true },
  { key: 'payroll.gratuity.daily_wage_divisor', value: '30', effectiveFrom: '2022-02-02', source: 'Basic monthly wage ÷ 30 (market practice)', authority: 'MOHRE', verify: true },
  { key: 'payroll.gratuity.days_per_year_basis', value: '365', effectiveFrom: '2022-02-02', source: 'Service-year basis for pro-rating', authority: 'MOHRE', verify: true },
  { key: 'payroll.leave.annual_days', value: '30', effectiveFrom: '2022-02-02', source: 'FDL 33/2021 Art. 29', authority: 'MOHRE', verify: true },
  { key: 'payroll.leave.first_year_days_per_month', value: '2', effectiveFrom: '2022-02-02', source: 'FDL 33/2021 Art. 29 (after 6 months, < 1 year)', authority: 'MOHRE', verify: true },
];

export const defaultPayrollConfig = (): RegulatoryConfig => new RegulatoryConfig(UAE_PAYROLL_RULES);
