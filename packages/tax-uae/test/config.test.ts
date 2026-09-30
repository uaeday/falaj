import { aed } from '@falaj/core';
import { describe, expect, it } from 'vitest';
import { RegulatoryConfig, defaultUaeConfig, eInvoiceMandate } from '../src/index.ts';

const config = defaultUaeConfig();

describe('regulatory configuration', () => {
  it('fails loudly when no value is in force', () => {
    expect(() => config.value('ct.rate.standard', '2022-12-31')).toThrow(/No regulatory value/);
  });

  it('rejects overlapping versions', () => {
    expect(() => new RegulatoryConfig([
      { key: 'x', value: '1', effectiveFrom: '2020-01-01', source: 's', authority: 'FTA', verify: false },
      { key: 'x', value: '2', effectiveFrom: '2021-01-01', source: 's', authority: 'FTA', verify: false },
    ])).toThrow(/Overlapping/);
  });

  it('lists unverified values for compliance review', () => {
    const keys = config.unverified().map((r) => r.key);
    expect(keys).toContain('einvoice.standard.go_live');
    expect(keys).toContain('ct.sbr.last_period_end');
    expect(keys).not.toContain('vat.rate.standard');
  });
});

describe('e-invoicing mandate calendar (E-07)', () => {
  it('< AED 50m tenants: appoint ASP by 31 Mar 2027, go live 1 Jul 2027 (provisional)', () => {
    expect(eInvoiceMandate({ annualRevenue: aed('38000000'), isGovernment: false }, '2026-09-30', config)).toEqual({
      band: 'STANDARD', aspDeadline: '2027-03-31', goLive: '2027-07-01', provisional: true,
    });
  });

  it('≥ AED 50m tenants go live 1 Jan 2027; government 1 Oct 2027', () => {
    expect(eInvoiceMandate({ annualRevenue: aed('50000000'), isGovernment: false }, '2026-09-30', config).goLive).toBe('2027-01-01');
    expect(eInvoiceMandate({ annualRevenue: aed('1'), isGovernment: true }, '2026-09-30', config).goLive).toBe('2027-10-01');
  });

  it('an amended timeline is a config change, not a code change', () => {
    const amended = config.with([
      { key: 'einvoice.standard.go_live', value: '2027-07-01', effectiveFrom: '2025-09-01', effectiveTo: '2026-12-31', source: 'MD 244/2025', authority: 'MoF', verify: true },
      { key: 'einvoice.standard.go_live', value: '2027-10-01', effectiveFrom: '2027-01-01', source: 'hypothetical amendment', authority: 'MoF', verify: true },
    ]);
    expect(eInvoiceMandate({ annualRevenue: aed('1000000'), isGovernment: false }, '2027-02-01', amended).goLive).toBe('2027-10-01');
  });
});
