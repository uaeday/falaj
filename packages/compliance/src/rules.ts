import type { RuleVersion } from '@falaj/core';

/** Calendar-specific values. NOT LEGAL OR TAX ADVICE; all dates and periods are verify: true until reviewed. */
export const COMPLIANCE_RULES: readonly RuleVersion[] = [
  { key: 'ct.registration.months_after_incorporation', value: '3', effectiveFrom: '2024-03-01', source: 'FTA Decision 3/2024 (new juridical persons)', authority: 'FTA', verify: true },
  { key: 'ct.return.months_after_period_end', value: '9', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 53', authority: 'FTA', verify: true },
  { key: 'vat.registration.days_after_threshold', value: '30', effectiveFrom: '2018-01-01', source: 'FDL 8/2017 Art. 13; Exec. Reg.', authority: 'FTA', verify: true },
  { key: 'wps.salary.days_after_month_end', value: '15', effectiveFrom: '2022-02-02', source: 'MOHRE WPS rules (salary due and late-payment window)', authority: 'MOHRE', verify: true },
  { key: 'licence.renewal.reminder_days', value: '90,60,30,7', effectiveFrom: '2018-01-01', source: 'Falaj product rule', authority: 'MOHRE', verify: false },
];
