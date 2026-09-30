import { Money } from '@falaj/core';

/**
 * WPS Salary Information File (F-PAY-06). Layout follows the commonly published CBUAE WPS SIF structure:
 * one EDR (employee detail record) per employee and one SCR (salary control record).
 * VERIFY the exact field order, widths and file naming with the employer's WPS agent/bank. Agents vary,
 * so a production build selects an agent profile.
 */
export interface WpsEmployeeRecord {
  /** MOHRE person code (14 digits). */
  personId: string;
  /** Agent/bank routing code (9 digits). */
  routingCode: string;
  /** IBAN or agent account. */
  account: string;
  payStart: string;
  payEnd: string;
  daysInPeriod: number;
  fixedIncome: Money;
  variableIncome: Money;
  daysOnLeave: number;
}

export interface WpsFileInput {
  /** MOHRE employer establishment id (13 digits). */
  employerId: string;
  employerRoutingCode: string;
  createdAt: Date;
  /** Salary month as YYYY-MM. */
  salaryMonth: string;
  employerReference?: string;
  records: readonly WpsEmployeeRecord[];
}

export interface WpsFile {
  fileName: string;
  content: string;
  total: Money;
  recordCount: number;
}

const two = (n: number) => String(n).padStart(2, '0');

export function buildWpsSif(input: WpsFileInput): WpsFile {
  if (!/^\d{13}$/.test(input.employerId)) throw new RangeError('Employer id must be 13 digits');
  if (!input.records.length) throw new RangeError('A SIF needs at least one employee');
  const errors: string[] = [];
  input.records.forEach((r, i) => {
    if (!/^\d{14}$/.test(r.personId)) errors.push(`record ${i + 1}: person id must be 14 digits`);
    if (!/^\d{9}$/.test(r.routingCode)) errors.push(`record ${i + 1}: routing code must be 9 digits`);
    if (r.fixedIncome.currency !== 'AED' || r.variableIncome.currency !== 'AED') errors.push(`record ${i + 1}: AED only`);
    if (r.fixedIncome.isNegative() || r.variableIncome.isNegative()) errors.push(`record ${i + 1}: negative pay`);
  });
  if (errors.length) throw new RangeError(errors.join('; '));

  const d = input.createdAt;
  const date = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
  const time = `${two(d.getUTCHours())}${two(d.getUTCMinutes())}`;
  const [yyyy, mm] = input.salaryMonth.split('-');

  const edr = input.records.map((r) =>
    ['EDR', r.personId, r.routingCode, r.account, r.payStart, r.payEnd, r.daysInPeriod,
      r.fixedIncome.toDecimalString(), r.variableIncome.toDecimalString(), r.daysOnLeave].join(','),
  );
  const total = input.records.reduce((a, r) => a.add(r.fixedIncome).add(r.variableIncome), Money.zero('AED'));
  const scr = ['SCR', input.employerId, input.employerRoutingCode, date, time, `${mm}${yyyy}`, input.records.length,
    total.toDecimalString(), 'AED', input.employerReference ?? ''].join(',');

  const stamp = `${String(d.getUTCFullYear()).slice(2)}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}`;
  return { fileName: `${input.employerId}${stamp}.SIF`, content: `${[...edr, scr].join('\r\n')}\r\n`, total, recordCount: edr.length };
}
