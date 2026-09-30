import { aed } from '@falaj/core';
import {
  type Account, type Actor, type AuditEventInput, HashChain, InMemoryLedgerRepository, Ledger, PERMISSIONS,
  PeriodCalendar, monthlyPeriods,
} from '../src/index.ts';

export const ENTITY = 'ent-acme';

export const ACCOUNTS: Account[] = [
  { id: 'bank', entityId: ENTITY, code: '1100', name: { en: 'Bank', ar: 'البنك' }, type: 'ASSET', isActive: true },
  { id: 'ar', entityId: ENTITY, code: '1200', name: { en: 'Accounts receivable', ar: 'الذمم المدينة' }, type: 'ASSET', isActive: true, control: 'AR' },
  { id: 'vat-out', entityId: ENTITY, code: '2200', name: { en: 'VAT output', ar: 'ضريبة المخرجات' }, type: 'LIABILITY', isActive: true, control: 'VAT' },
  { id: 'capital', entityId: ENTITY, code: '3000', name: { en: 'Share capital', ar: 'رأس المال' }, type: 'EQUITY', isActive: true },
  { id: 'sales', entityId: ENTITY, code: '4000', name: { en: 'Sales', ar: 'المبيعات' }, type: 'INCOME', isActive: true },
  { id: 'rent', entityId: ENTITY, code: '6100', name: { en: 'Rent', ar: 'الإيجار' }, type: 'EXPENSE', isActive: true },
  { id: 'old', entityId: ENTITY, code: '6999', name: { en: 'Old', ar: 'قديم' }, type: 'EXPENSE', isActive: false },
  { id: 'other-entity', entityId: 'ent-other', code: '1100', name: { en: 'Bank', ar: 'البنك' }, type: 'ASSET', isActive: true },
];

export const accountant: Actor = { userId: 'u-accountant', permissions: new Set([PERMISSIONS.postManual]) };
export const controller: Actor = {
  userId: 'u-controller',
  permissions: new Set([PERMISSIONS.postManual, PERMISSIONS.postSoftClosed, PERMISSIONS.reopen]),
};

export function makeLedger() {
  const byId = new Map(ACCOUNTS.map((a) => [a.id, a]));
  const periods = new PeriodCalendar([...monthlyPeriods(ENTITY, 2027), ...monthlyPeriods(ENTITY, 2028)]);
  const repo = new InMemoryLedgerRepository();
  const chain = new HashChain();
  let n = 0;
  const ledger = new Ledger({
    tenantId: 'tenant-a',
    repo,
    accounts: (id) => byId.get(id),
    periods,
    audit: { record: (e: AuditEventInput) => void chain.append(e) },
    now: () => new Date('2027-02-10T08:00:00Z'),
    newId: () => `je-${++n}`,
  });
  return { ledger, periods, repo, chain };
}

export const cashSale = (date = '2027-02-10') => ({
  entityId: ENTITY,
  postingDate: date,
  source: { type: 'MANUAL' as const },
  memo: 'Cash sale',
  lines: [
    { accountId: 'bank', debit: aed('1050.00') },
    { accountId: 'sales', credit: aed('1000.00') },
    { accountId: 'capital', credit: aed('50.00') },
  ],
});
