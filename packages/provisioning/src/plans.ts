/**
 * Plan tiers from the strategy's business model. Prices are deliberately unset (null) until the
 * willingness-to-pay study: the product never invents a price.
 */
export type PlanCode = 'LAUNCH' | 'GROW' | 'SCALE';

export type Module =
  | 'DOMAIN' | 'EMAIL' | 'WEBSITE' | 'INVOICING' | 'VAT' | 'EINVOICING' | 'COMPLIANCE_CALENDAR' | 'CONTACTS' | 'BANK_FEEDS'
  | 'ERP' | 'HRMS' | 'PAYROLL_WPS' | 'CRM' | 'WHATSAPP'
  | 'MULTI_ENTITY' | 'PROJECTS' | 'FPA' | 'AUDIT';

export interface Plan {
  code: PlanCode;
  name: { en: string; ar: string };
  headcount: { min: number; max: number | null };
  modules: Module[];
  /** AED per month (minor units) and per employee; null = not set yet. */
  price: { baseMinor: bigint | null; perEmployeeMinor: bigint | null; quoted: boolean };
}

const LAUNCH_MODULES: Module[] = ['DOMAIN', 'EMAIL', 'WEBSITE', 'INVOICING', 'VAT', 'EINVOICING', 'COMPLIANCE_CALENDAR', 'CONTACTS', 'BANK_FEEDS'];
const GROW_MODULES: Module[] = [...LAUNCH_MODULES, 'ERP', 'HRMS', 'PAYROLL_WPS', 'CRM', 'WHATSAPP'];

export const PLANS: readonly Plan[] = [
  { code: 'LAUNCH', name: { en: 'Launch', ar: 'انطلاق' }, headcount: { min: 1, max: 5 }, modules: LAUNCH_MODULES, price: { baseMinor: null, perEmployeeMinor: null, quoted: false } },
  { code: 'GROW', name: { en: 'Grow', ar: 'نمو' }, headcount: { min: 6, max: 50 }, modules: GROW_MODULES, price: { baseMinor: null, perEmployeeMinor: null, quoted: false } },
  { code: 'SCALE', name: { en: 'Scale', ar: 'توسع' }, headcount: { min: 51, max: 250 }, modules: [...GROW_MODULES, 'MULTI_ENTITY', 'PROJECTS', 'FPA', 'AUDIT'], price: { baseMinor: null, perEmployeeMinor: null, quoted: true } },
];

export function recommendPlan(headcount: number): Plan {
  if (!Number.isInteger(headcount) || headcount < 1) throw new RangeError('Headcount must be a positive integer');
  return PLANS.find((p) => headcount >= p.headcount.min && (p.headcount.max === null || headcount <= p.headcount.max)) ?? PLANS[2]!;
}
