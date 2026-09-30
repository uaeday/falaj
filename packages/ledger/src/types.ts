import type { CurrencyCode, Emirate, Money } from '@falaj/core';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

/** Sub-ledgers that own control accounts. Only their postings may touch those accounts. */
export type SubLedger = 'AR' | 'AP' | 'INVENTORY' | 'PAYROLL' | 'VAT' | 'BANK' | 'FIXED_ASSET';

/** Corporate Tax treatment tag on an account (drives the CT working paper). */
export type CtTreatment = 'DEDUCTIBLE' | 'NON_DEDUCTIBLE' | 'PARTIAL_50' | 'EXEMPT_INCOME';

export interface Account {
  id: string;
  entityId: string;
  code: string;
  name: { en: string; ar: string };
  type: AccountType;
  isActive: boolean;
  /** Set on control accounts (AR, AP, VAT…). Manual journals cannot post here. */
  control?: SubLedger;
  ctTreatment?: CtTreatment;
}

export type SourceType =
  | 'MANUAL'
  | 'OPENING_BALANCE'
  | 'AR_INVOICE'
  | 'AR_CREDIT_NOTE'
  | 'AR_RECEIPT'
  | 'AR_PDC'
  | 'AP_BILL'
  | 'AP_DEBIT_NOTE'
  | 'AP_PAYMENT'
  | 'AP_PDC'
  | 'BANK'
  | 'INVENTORY'
  | 'PAYROLL'
  | 'FIXED_ASSET'
  | 'FX_REVALUATION'
  | 'VAT_SETTLEMENT';

export interface SourceRef {
  type: SourceType;
  /** Id of the source document (invoice, bill, pay run…). Required for everything except MANUAL. */
  id?: string;
}

/** Amount in the transaction currency, when it differs from the functional currency. */
export interface TxnAmount {
  amount: Money;
  /** Units of functional currency per 1 unit of transaction currency, e.g. "3.6725". */
  rate: string;
}

export interface JournalLineInput {
  accountId: string;
  /** Functional-currency amount. Exactly one of debit/credit must be positive. */
  debit?: Money;
  credit?: Money;
  txn?: TxnAmount;
  taxCode?: string;
  /** Taxable base for a tax-coded line (VAT201 box amounts come from here). */
  taxBase?: Money;
  emirate?: Emirate;
  counterpartyId?: string;
  dimensions?: Readonly<Record<string, string>>;
  memo?: string;
}

export interface JournalEntryInput {
  entityId: string;
  /** ISO date, YYYY-MM-DD. Determines the period. */
  postingDate: string;
  documentDate?: string;
  source: SourceRef;
  memo: string;
  lines: readonly JournalLineInput[];
}

/** A posted line in canonical form: one amount + side, optional attributes only when present. */
export interface JournalLine {
  lineNo: number;
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  /** Absolute functional-currency amount of the line. */
  amount: Money;
  txn?: TxnAmount;
  taxCode?: string;
  taxBase?: Money;
  emirate?: Emirate;
  counterpartyId?: string;
  dimensions?: Readonly<Record<string, string>>;
  memo?: string;
}

export interface JournalEntry {
  readonly id: string;
  readonly entityId: string;
  readonly fiscalYear: number;
  /** Gapless sequence within (entity, fiscal year). */
  readonly seq: number;
  /** Display number derived from fiscal year and sequence, e.g. "JE-2027-000042". */
  readonly entryNo: string;
  readonly postingDate: string;
  readonly documentDate: string;
  readonly source: SourceRef;
  readonly memo: string;
  readonly currency: CurrencyCode;
  readonly lines: readonly JournalLine[];
  readonly reversesId?: string;
  readonly postedAt: string;
  readonly postedBy: string;
  /** SHA-256 of the canonical entry content. */
  readonly hash: string;
}

export interface Actor {
  userId: string;
  permissions: ReadonlySet<string>;
}

export type LedgerErrorCode =
  | 'INVALID_DATE'
  | 'TOO_FEW_LINES'
  | 'LINE_BOTH_SIDES'
  | 'LINE_ZERO'
  | 'NEGATIVE_AMOUNT'
  | 'CURRENCY_MISMATCH'
  | 'TXN_SIDE_MISMATCH'
  | 'TXN_UNBALANCED'
  | 'UNKNOWN_ACCOUNT'
  | 'INACTIVE_ACCOUNT'
  | 'WRONG_ENTITY'
  | 'CONTROL_ACCOUNT'
  | 'TAX_BASE_REQUIRED'
  | 'UNBALANCED'
  | 'SOURCE_ID_REQUIRED'
  | 'PERIOD_NOT_FOUND'
  | 'PERIOD_LOCKED'
  | 'PERIOD_SOFT_CLOSED'
  | 'PERIOD_MODULE_CLOSED'
  | 'ENTRY_NOT_FOUND'
  | 'ALREADY_REVERSED'
  | 'CANNOT_REVERSE_REVERSAL'
  | 'REASON_REQUIRED';

export interface LedgerError {
  code: LedgerErrorCode;
  message: string;
  lineNo?: number;
}
