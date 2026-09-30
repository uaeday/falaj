/**
 * Drizzle mirror of migrations/0001_ledger_core.sql for typed queries.
 * The SQL migration is the source of truth: RLS policies, triggers and grants live only there.
 */
import {
  bigint, bigserial, boolean, char, date, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  dataResidency: text('data_residency').notNull().default('uae-north'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const legalEntities = pgTable('legal_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalNameEn: text('legal_name_en').notNull(),
  legalNameAr: text('legal_name_ar').notNull(),
  jurisdictionType: text('jurisdiction_type').$type<'MAINLAND' | 'FREE_ZONE' | 'DESIGNATED_ZONE' | 'DIFC' | 'ADGM'>().notNull(),
  emirate: char('emirate', { length: 3 }).notNull(),
  licensingAuthority: text('licensing_authority'),
  vatTrn: char('vat_trn', { length: 15 }),
  ctTrn: text('ct_trn'),
  functionalCurrency: char('functional_currency', { length: 3 }).notNull().default('AED'),
  fiscalYearStartMonth: smallint('fiscal_year_start_month').notNull().default(1),
});

export const fiscalPeriods = pgTable('fiscal_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  periodKey: text('period_key').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  status: text('status').$type<'OPEN' | 'SOFT_CLOSED' | 'LOCKED'>().notNull().default('OPEN'),
  closedModules: text('closed_modules').array().notNull().default([]),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  code: text('code').notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  type: text('type').$type<'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'>().notNull(),
  controlSubledger: text('control_subledger'),
  ctTreatment: text('ct_treatment'),
  isActive: boolean('is_active').notNull().default(true),
  parentId: uuid('parent_id'),
});

export const entrySequences = pgTable(
  'entry_sequences',
  {
    tenantId: uuid('tenant_id').notNull(),
    entityId: uuid('entity_id').notNull(),
    fiscalYear: integer('fiscal_year').notNull(),
    lastSeq: integer('last_seq').notNull(),
  },
  (t) => [primaryKey({ columns: [t.entityId, t.fiscalYear] })],
);

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  seq: integer('seq').notNull(),
  entryNo: text('entry_no').notNull(),
  postingDate: date('posting_date', { mode: 'string' }).notNull(),
  documentDate: date('document_date', { mode: 'string' }).notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  memo: text('memo').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  reversesId: uuid('reverses_id'),
  hash: char('hash', { length: 64 }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true, mode: 'date' }).notNull(),
  postedBy: text('posted_by').notNull(),
});

export const journalLines = pgTable(
  'journal_lines',
  {
    tenantId: uuid('tenant_id').notNull(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    lineNo: smallint('line_no').notNull(),
    accountId: uuid('account_id').notNull(),
    debitMinor: bigint('debit_minor', { mode: 'bigint' }).notNull().default(0n),
    creditMinor: bigint('credit_minor', { mode: 'bigint' }).notNull().default(0n),
    txnCurrency: char('txn_currency', { length: 3 }),
    txnAmountMinor: bigint('txn_amount_minor', { mode: 'bigint' }),
    fxRate: text('fx_rate'),
    taxCode: text('tax_code'),
    taxBaseMinor: bigint('tax_base_minor', { mode: 'bigint' }),
    vatEmirate: char('vat_emirate', { length: 3 }),
    counterpartyId: uuid('counterparty_id'),
    dimensions: jsonb('dimensions').$type<Record<string, string>>().notNull().default({}),
    memo: text('memo'),
  },
  (t) => [primaryKey({ columns: [t.journalEntryId, t.lineNo] })],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    tenantId: uuid('tenant_id').notNull(),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    actorId: text('actor_id').notNull(),
    at: timestamp('at', { withTimezone: true, mode: 'date' }).notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    prevHash: char('prev_hash', { length: 64 }).notNull(),
    hash: char('hash', { length: 64 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.seq] })],
);

export const outboxEvents = pgTable('outbox_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});
