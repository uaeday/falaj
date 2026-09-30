import { aed } from '@falaj/core';
import { describe, expect, it } from 'vitest';
import { annualLeaveEntitlement, buildWpsSif, defaultPayrollConfig, endOfServiceGratuity } from '../src/index.ts';

const config = defaultPayrollConfig();
const asOf = '2027-06-30';
const years = (y: number) => Math.round(y * 365);

describe('end-of-service gratuity (E-09, worked examples in docs/09)', () => {
  it.each([
    ['10000.00', years(0.9), '0.00', false],
    ['10000.00', years(1), '7000.00', false],
    ['10000.00', years(3), '21000.00', false],
    ['10000.00', years(5), '35000.00', false],
    ['10000.00', years(7), '55000.00', false],
    ['10000.00', years(30), '240000.00', true],
    ['7500.00', 913, '13132.19', false], // 7500 × 21 × 913 / (365 × 30)
    ['4321.00', 400, '3314.74', false], // 4321 × 21 × 400 / 10950 = 3314.7397…
  ])('basic %s, %s days → %s', (basic, days, expected, capped) => {
    const r = endOfServiceGratuity({ basicMonthly: aed(basic), serviceDays: days, asOf }, config);
    expect(r.amount.toDecimalString()).toBe(expected);
    expect(r.capped).toBe(capped);
  });

  it('shows its working', () => {
    const r = endOfServiceGratuity({ basicMonthly: aed('10000'), serviceDays: years(7), asOf }, config);
    expect(r.entitlementDays).toBe('165.00');
    expect(r.explanation).toBe('165.00 days at 10000.00/30');
  });
});

describe('annual leave', () => {
  it.each([[5, 0], [6, 12], [11, 22], [12, 30], [60, 30]])('%s months → %s days', (months, days) => {
    expect(annualLeaveEntitlement(months, asOf, config)).toBe(days);
  });
});

describe('WPS SIF', () => {
  const rec = (n: number, fixed: string) => ({
    personId: `1000000000000${n}`, routingCode: '803320101', account: 'AE070331234567890123456',
    payStart: '2027-03-01', payEnd: '2027-03-31', daysInPeriod: 31, fixedIncome: aed(fixed), variableIncome: aed('0'), daysOnLeave: 0,
  });

  it('writes one EDR per employee and a totalling SCR', () => {
    const f = buildWpsSif({
      employerId: '1234567890123', employerRoutingCode: '803320101', createdAt: new Date('2027-03-28T09:05:07Z'),
      salaryMonth: '2027-03', records: [rec(1, '8500.00'), rec(2, '12000.50')],
    });
    const lines = f.content.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('EDR,10000000000001,803320101,AE070331234567890123456,2027-03-01,2027-03-31,31,8500.00,0.00,0');
    expect(lines[2]).toBe('SCR,1234567890123,803320101,2027-03-28,0905,032027,2,20500.50,AED,');
    expect(f.fileName).toBe('1234567890123270328090507.SIF');
  });

  it('refuses malformed identifiers', () => {
    expect(() => buildWpsSif({
      employerId: '1234567890123', employerRoutingCode: '803320101', createdAt: new Date(), salaryMonth: '2027-03',
      records: [{ ...rec(1, '100'), personId: '123' }],
    })).toThrow(/person id/);
  });
});
