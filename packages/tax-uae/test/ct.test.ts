import { aed } from '@falaj/core';
import { describe, expect, it } from 'vitest';
import { computeCorporateTax, defaultUaeConfig, entertainmentAddBack, qfzpDeMinimis, type CtInput } from '../src/index.ts';

const config = defaultUaeConfig();
const period = { periodStart: '2027-01-01', periodEnd: '2027-12-31' };

describe('Corporate Tax working paper (E-10)', () => {
  it('9% above the AED 375,000 band, with an entertainment add-back', () => {
    const addBack = entertainmentAddBack(aed('40000'), '2027-12-31', config, ['JE-2027-000311#1']);
    expect(addBack.amount.toDecimalString()).toBe('20000.00');
    const r = computeCorporateTax({ ...period, revenue: aed('9000000'), accountingProfit: aed('1000000'), adjustments: [addBack] }, config);
    expect(r.taxableIncome.toDecimalString()).toBe('1020000.00');
    expect(r.taxPayable.toDecimalString()).toBe('58050.00');
    expect(r.adjustments[0]!.sourceRefs).toEqual(['JE-2027-000311#1']);
  });

  it.each([
    ['375000', '0.00'],
    ['375001', '0.09'],
    ['0', '0.00'],
    ['-50000', '0.00'],
  ])('profit %s → CT %s', (profit, ct) => {
    expect(computeCorporateTax({ ...period, revenue: aed('5000000'), accountingProfit: aed(profit), adjustments: [] }, config).taxPayable.toDecimalString()).toBe(ct);
  });

  const sbr = (revenue: string, prior = false, periodEnd = '2027-12-31', asOf?: string): CtInput => ({
    periodStart: '2027-01-01', periodEnd, revenue: aed(revenue), accountingProfit: aed('900000'), adjustments: [],
    sbr: { elected: true, revenueExceededInPriorPeriod: prior }, ...(asOf ? { asOf } : {}),
  });

  it('Small Business Relief: revenue within threshold → nil', () => {
    const r = computeCorporateTax(sbr('2800000'), config);
    expect(r.sbr.applied).toBe(true);
    expect(r.taxPayable.isZero()).toBe(true);
  });

  it('SBR breach in a prior period is permanent', () => {
    const r = computeCorporateTax(sbr('2500000', true), config);
    expect(r.sbr).toEqual({ applied: false, reason: 'Threshold exceeded in a prior period' });
    expect(r.taxPayable.toDecimalString()).toBe('47250.00');
  });

  it('SBR revenue above threshold is refused', () => {
    expect(computeCorporateTax(sbr('3000000.01'), config).sbr.applied).toBe(false);
    expect(computeCorporateTax(sbr('3000000.00'), config).sbr.applied).toBe(true);
  });

  it('SBR window follows configuration (extension marked VERIFY)', () => {
    // Under the original window (as known before June 2026) a 2027 period would not qualify.
    expect(computeCorporateTax(sbr('1000000', false, '2027-12-31', '2026-01-01'), config).sbr.applied).toBe(false);
    // With the configured extension it does.
    expect(computeCorporateTax(sbr('1000000', false, '2027-12-31', '2027-12-31'), config).sbr.applied).toBe(true);
    expect(computeCorporateTax(sbr('1000000', false, '2030-12-31', '2030-12-31'), config).sbr.applied).toBe(false);
    expect(config.get('ct.sbr.last_period_end', '2027-01-01').verify).toBe(true);
  });

  it('QFZP de minimis is the lower of 5% of revenue and AED 5m', () => {
    const small = qfzpDeMinimis(aed('20000000'), aed('900000'), '2027-12-31', config);
    expect(small.limit.toDecimalString()).toBe('1000000.00');
    expect(small.breached).toBe(false);
    const large = qfzpDeMinimis(aed('200000000'), aed('5000000.01'), '2027-12-31', config);
    expect(large.limit.toDecimalString()).toBe('5000000.00');
    expect(large.breached).toBe(true);
  });
});
