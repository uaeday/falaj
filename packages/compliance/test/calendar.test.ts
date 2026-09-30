import { aed } from '@falaj/core';
import { SAMPLE_LICENCES, companyFromLicence } from '@falaj/company';
import { describe, expect, it } from 'vitest';
import { addMonths, complianceCalendar, nextOccurrences } from '../src/index.ts';

let n = 0;
const r = companyFromLicence(SAMPLE_LICENCES[0]!, { tenantId: 't', today: '2026-10-01', now: '2026-10-01T00:00:00Z', newId: () => `id${++n}` });
if (!r.ok) throw new Error('fixture');
const company = r.value; // Sidra: issued 2026-09-29, expires 2027-09-28
const range = { from: '2026-10-01', to: '2027-12-31' };

describe('compliance calendar (Launch Kit)', () => {
  it('month arithmetic clamps to month end', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2026-09-29', 3)).toBe('2026-12-29');
  });

  it('a new consultancy gets licence, CT, e-invoicing and UBO obligations', () => {
    const cal = complianceCalendar({ company, firstFinancialYearEnd: '2027-12-31', expectedAnnualRevenue: aed('2000000') }, range);
    expect(cal.map((o) => [o.kind, o.due])).toEqual([
      ['CT_REGISTRATION', '2026-12-29'],
      ['EINVOICE_ASP', '2027-03-31'],
      ['EINVOICE_GO_LIVE', '2027-07-01'],
      ['LICENCE_RENEWAL', '2027-09-28'],
      ['UBO_REGISTER', null],
    ]);
    const renewal = cal.find((o) => o.kind === 'LICENCE_RENEWAL')!;
    expect(renewal.remindOn).toEqual(['2027-06-30', '2027-07-30', '2027-08-29', '2027-09-21']);
    expect(cal.find((o) => o.kind === 'EINVOICE_GO_LIVE')!.verify).toBe(true);
  });

  it('the first CT return falls 9 months after the first financial year end', () => {
    const cal = complianceCalendar({ company, firstFinancialYearEnd: '2027-12-31' }, { from: '2026-10-01', to: '2028-12-31' });
    expect(cal.find((o) => o.kind === 'CT_RETURN')!.due).toBe('2028-09-30');
  });

  it('flags VAT registration when expected supplies pass AED 375,000', () => {
    const below = complianceCalendar({ company, firstFinancialYearEnd: '2027-12-31', expectedAnnualTaxableSupplies: aed('300000') }, range);
    expect(below.some((o) => o.kind === 'VAT_REGISTRATION')).toBe(false);
    const above = complianceCalendar({ company, firstFinancialYearEnd: '2027-12-31', expectedAnnualTaxableSupplies: aed('375000') }, range);
    expect(above.find((o) => o.kind === 'VAT_REGISTRATION')!.title.en).toBe('Register for VAT within 30 days of taxable supplies passing AED 375,000');
  });

  it('quarterly VAT returns are due on the 28th day after each period', () => {
    const cal = complianceCalendar(
      { company, firstFinancialYearEnd: '2027-12-31', vat: { registered: true, firstPeriodEnd: '2026-12-31', periodMonths: 3 } },
      { from: '2026-10-01', to: '2027-10-31' },
    );
    expect(cal.filter((o) => o.kind === 'VAT_RETURN').map((o) => o.due)).toEqual(['2027-01-28', '2027-04-28', '2027-07-28', '2027-10-28']);
  });

  it('employers get monthly WPS reminders; ≥ AED 50m companies get the 2027-01-01 e-invoicing date', () => {
    const cal = complianceCalendar(
      { company, firstFinancialYearEnd: '2027-12-31', hasEmployees: true, expectedAnnualRevenue: aed('60000000') },
      { from: '2026-10-01', to: '2027-01-31' },
    );
    expect(cal.filter((o) => o.kind === 'WPS_SALARY').map((o) => o.due)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15']);
    expect(cal.find((o) => o.kind === 'EINVOICE_GO_LIVE')!.due).toBe('2027-01-01');
    const short = nextOccurrences(cal);
    expect(short.filter((o) => o.kind === 'WPS_SALARY')).toMatchObject([{ due: '2026-11-15', recurring: true }]);
  });
});
