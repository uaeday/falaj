import type { RuleVersion } from '@falaj/core';

/**
 * Baseline UAE values as understood on 2026-09-30. NOT LEGAL OR TAX ADVICE. Anything marked verify: true
 * must be confirmed with the named authority before use in production.
 */
export const UAE_DEFAULT_RULES: readonly RuleVersion[] = [
  // ── VAT ──────────────────────────────────────────────────────────────
  { key: 'vat.rate.standard', value: '0.05', effectiveFrom: '2018-01-01', source: 'FDL 8/2017 Art. 3', authority: 'FTA', verify: false },
  { key: 'vat.registration.mandatory_threshold', value: '375000', effectiveFrom: '2018-01-01', source: 'FDL 8/2017 Art. 13', authority: 'FTA', verify: false },
  { key: 'vat.registration.voluntary_threshold', value: '187500', effectiveFrom: '2018-01-01', source: 'FDL 8/2017 Art. 17', authority: 'FTA', verify: false },
  { key: 'vat.simplified_invoice.max_total', value: '10000', effectiveFrom: '2018-01-01', source: 'VAT Exec. Reg. Art. 59 (as amended)', authority: 'FTA', verify: true,
    note: 'Simplified tax invoice allowed when the recipient is not registered, or the supply value does not exceed this amount' },
  { key: 'vat.return.due_days_after_period', value: '28', effectiveFrom: '2018-01-01', source: 'FTA filing guidance', authority: 'FTA', verify: false },

  // ── Corporate Tax ────────────────────────────────────────────────────
  { key: 'ct.rate.standard', value: '0.09', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 3; Cabinet Decision 116/2022', authority: 'MoF', verify: false },
  { key: 'ct.zero_rate_band', value: '375000', effectiveFrom: '2023-06-01', source: 'Cabinet Decision 116/2022', authority: 'MoF', verify: false },
  { key: 'ct.sbr.revenue_threshold', value: '3000000', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 21; MD 73/2023', authority: 'MoF', verify: false },
  { key: 'ct.sbr.last_period_end', value: '2026-12-31', effectiveFrom: '2023-06-01', effectiveTo: '2026-05-31', source: 'MD 73/2023', authority: 'MoF', verify: false },
  { key: 'ct.sbr.last_period_end', value: '2029-12-31', effectiveFrom: '2026-06-01', source: 'MD 131/2026 (per product brief)', authority: 'MoF', verify: true,
    note: 'Extension of SBR window to tax periods ending on or before 31 Dec 2029. Confirm decision number and effective date.' },
  { key: 'ct.entertainment.disallowed_share', value: '0.5', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 32', authority: 'MoF', verify: true },
  { key: 'ct.loss_relief.cap_share', value: '0.75', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 37', authority: 'MoF', verify: true },
  { key: 'ct.interest_cap.ebitda_share', value: '0.30', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 30', authority: 'MoF', verify: true },
  { key: 'ct.interest_cap.de_minimis', value: '12000000', effectiveFrom: '2023-06-01', source: 'Cabinet Decision / MD on interest limitation', authority: 'MoF', verify: true },
  { key: 'ct.qfzp.de_minimis.share', value: '0.05', effectiveFrom: '2023-06-01', source: 'Cabinet Decision on QFZP (100/2023 and successors)', authority: 'MoF', verify: true },
  { key: 'ct.qfzp.de_minimis.absolute', value: '5000000', effectiveFrom: '2023-06-01', source: 'Cabinet Decision on QFZP (100/2023 and successors)', authority: 'MoF', verify: true },
  { key: 'ct.wht.rate', value: '0', effectiveFrom: '2023-06-01', source: 'FDL 47/2022 Art. 45', authority: 'MoF', verify: true,
    note: 'Withholding tax on specified UAE-sourced income of non-residents is 0%. No WHT logic on resident payments.' },

  // ── E-invoicing ──────────────────────────────────────────────────────
  { key: 'einvoice.large.revenue_threshold', value: '50000000', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },
  { key: 'einvoice.large.asp_deadline', value: '2026-07-31', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },
  { key: 'einvoice.large.go_live', value: '2027-01-01', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },
  { key: 'einvoice.standard.asp_deadline', value: '2027-03-31', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },
  { key: 'einvoice.standard.go_live', value: '2027-07-01', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },
  { key: 'einvoice.government.asp_deadline', value: '2027-03-31', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },
  { key: 'einvoice.government.go_live', value: '2027-10-01', effectiveFrom: '2025-09-01', source: 'MD 244/2025', authority: 'MoF', verify: true },

  // ── FX ───────────────────────────────────────────────────────────────
  { key: 'fx.usd_aed.peg', value: '3.6725', effectiveFrom: '1997-11-01', source: 'CBUAE USD peg', authority: 'CBUAE', verify: false },
];
