import type { Actor, LedgerError, SourceType, SubLedger } from './types.ts';

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'LOCKED';

export interface FiscalPeriod {
  entityId: string;
  /** e.g. "2027-01" */
  key: string;
  fiscalYear: number;
  start: string;
  end: string;
  status: PeriodStatus;
  /** Sub-ledgers closed early within an otherwise open period (e.g. AR closed on day 2). */
  closedModules?: readonly SubLedger[];
}

export const PERMISSIONS = {
  postSoftClosed: 'period.post_soft_closed',
  reopen: 'period.reopen',
  postManual: 'journal.post_manual',
} as const;

/** Which sub-ledger each source belongs to (for module locks and control-account ownership). */
export const SOURCE_SUBLEDGERS: Record<SourceType, readonly SubLedger[]> = {
  MANUAL: [],
  OPENING_BALANCE: ['AR', 'AP', 'INVENTORY', 'PAYROLL', 'VAT', 'BANK', 'FIXED_ASSET'],
  AR_INVOICE: ['AR', 'VAT', 'INVENTORY'],
  AR_CREDIT_NOTE: ['AR', 'VAT', 'INVENTORY'],
  AR_RECEIPT: ['AR', 'BANK'],
  AR_PDC: ['AR', 'BANK'],
  AP_BILL: ['AP', 'VAT', 'INVENTORY'],
  AP_DEBIT_NOTE: ['AP', 'VAT', 'INVENTORY'],
  AP_PAYMENT: ['AP', 'BANK'],
  AP_PDC: ['AP', 'BANK'],
  BANK: ['BANK'],
  INVENTORY: ['INVENTORY'],
  PAYROLL: ['PAYROLL', 'BANK'],
  FIXED_ASSET: ['FIXED_ASSET'],
  FX_REVALUATION: ['AR', 'AP', 'BANK'],
  VAT_SETTLEMENT: ['VAT', 'BANK'],
};

/** Monthly periods for a calendar fiscal year, all OPEN. */
export function monthlyPeriods(entityId: string, fiscalYear: number): FiscalPeriod[] {
  return Array.from({ length: 12 }, (_, m) => {
    const month = String(m + 1).padStart(2, '0');
    const lastDay = new Date(Date.UTC(fiscalYear, m + 1, 0)).getUTCDate();
    return {
      entityId,
      key: `${fiscalYear}-${month}`,
      fiscalYear,
      start: `${fiscalYear}-${month}-01`,
      end: `${fiscalYear}-${month}-${String(lastDay).padStart(2, '0')}`,
      status: 'OPEN' as const,
    };
  });
}

export class PeriodCalendar {
  private readonly periods: FiscalPeriod[];

  constructor(periods: readonly FiscalPeriod[]) {
    this.periods = periods.map((p) => ({ ...p }));
  }

  find(entityId: string, date: string): FiscalPeriod | undefined {
    return this.periods.find((p) => p.entityId === entityId && p.start <= date && date <= p.end);
  }

  /** Returns an error if `actor` may not post a `source` document on `date`. */
  check(entityId: string, date: string, source: SourceType, actor: Actor): LedgerError | undefined {
    const p = this.find(entityId, date);
    if (!p) return { code: 'PERIOD_NOT_FOUND', message: `No fiscal period covers ${date}` };
    if (p.status === 'LOCKED') return { code: 'PERIOD_LOCKED', message: `Period ${p.key} is locked` };
    if (p.status === 'SOFT_CLOSED' && !actor.permissions.has(PERMISSIONS.postSoftClosed)) {
      return { code: 'PERIOD_SOFT_CLOSED', message: `Period ${p.key} is soft-closed` };
    }
    const closed = SOURCE_SUBLEDGERS[source].find((m) => p.closedModules?.includes(m));
    if (closed && source !== 'OPENING_BALANCE') {
      return { code: 'PERIOD_MODULE_CLOSED', message: `${closed} is closed for ${p.key}` };
    }
    return undefined;
  }

  setStatus(entityId: string, key: string, status: PeriodStatus): FiscalPeriod {
    const p = this.periods.find((x) => x.entityId === entityId && x.key === key);
    if (!p) throw new RangeError(`Unknown period ${key}`);
    p.status = status;
    return { ...p };
  }
}
