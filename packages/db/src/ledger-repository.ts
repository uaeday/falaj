import { type Emirate, Money } from '@falaj/core';
import {
  type Account, type AuditEvent, type AuditEventInput, type AuditSink, type FiscalPeriod, GENESIS_HASH,
  type JournalEntry, type JournalLine, type LedgerRepository, PeriodCalendar, type SourceType, type SubLedger,
  hashAuditEvent,
} from '@falaj/ledger';
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { accounts, auditEvents, fiscalPeriods, journalEntries, journalLines, outboxEvents } from './schema.ts';
import { type Db, rows } from './tenant.ts';

/**
 * Postgres implementation of the ledger port. Construct one per tenant transaction (see withTenant):
 * the sequence, entry, lines and outbox event then commit or roll back together, and the DB's
 * deferred balance check runs at COMMIT as a second line of defence.
 */
export class PgLedgerRepository implements LedgerRepository {
  constructor(private readonly tx: Db) {}

  async nextSequence(entityId: string, fiscalYear: number): Promise<number> {
    const [r] = await rows<{ last_seq: number }>(
      this.tx,
      sql`insert into entry_sequences (tenant_id, entity_id, fiscal_year, last_seq)
          values (app_tenant_id(), ${entityId}, ${fiscalYear}, 1)
          on conflict (entity_id, fiscal_year) do update set last_seq = entry_sequences.last_seq + 1
          returning last_seq`,
    );
    return r!.last_seq;
  }

  async insert(entry: JournalEntry): Promise<void> {
    const tenantId = sql`app_tenant_id()`;
    await this.tx.insert(journalEntries).values({
      id: entry.id,
      tenantId,
      entityId: entry.entityId,
      fiscalYear: entry.fiscalYear,
      seq: entry.seq,
      entryNo: entry.entryNo,
      postingDate: entry.postingDate,
      documentDate: entry.documentDate,
      sourceType: entry.source.type,
      sourceId: entry.source.id ?? null,
      memo: entry.memo,
      currency: entry.currency,
      reversesId: entry.reversesId ?? null,
      hash: entry.hash,
      postedAt: new Date(entry.postedAt),
      postedBy: entry.postedBy,
    });
    await this.tx.insert(journalLines).values(
      entry.lines.map((l) => ({
        tenantId,
        journalEntryId: entry.id,
        lineNo: l.lineNo,
        accountId: l.accountId,
        debitMinor: l.side === 'DEBIT' ? l.amount.minor : 0n,
        creditMinor: l.side === 'CREDIT' ? l.amount.minor : 0n,
        txnCurrency: l.txn?.amount.currency ?? null,
        txnAmountMinor: l.txn?.amount.minor ?? null,
        fxRate: l.txn?.rate ?? null,
        taxCode: l.taxCode ?? null,
        taxBaseMinor: l.taxBase?.minor ?? null,
        vatEmirate: l.emirate ?? null,
        counterpartyId: l.counterpartyId ?? null,
        dimensions: l.dimensions ?? {},
        memo: l.memo ?? null,
      })),
    );
    await this.tx.insert(outboxEvents).values({
      tenantId,
      aggregateType: 'journal_entry',
      aggregateId: entry.id,
      eventType: entry.reversesId ? 'JournalReversed' : 'JournalPosted',
      payload: { entryId: entry.id, entryNo: entry.entryNo, entityId: entry.entityId, source: entry.source, hash: entry.hash },
    });
  }

  async get(id: string): Promise<JournalEntry | undefined> {
    const [e] = await this.tx.select().from(journalEntries).where(eq(journalEntries.id, id));
    if (!e) return undefined;
    return (await this.hydrate([e]))[0];
  }

  async reversalOf(id: string): Promise<string | undefined> {
    const [r] = await this.tx.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.reversesId, id));
    return r?.id;
  }

  async list(entityId: string, range: { from?: string; to: string }): Promise<JournalEntry[]> {
    const es = await this.tx
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.entityId, entityId),
          lte(journalEntries.postingDate, range.to),
          range.from ? gte(journalEntries.postingDate, range.from) : undefined,
        ),
      )
      .orderBy(asc(journalEntries.fiscalYear), asc(journalEntries.seq));
    return this.hydrate(es);
  }

  private async hydrate(es: (typeof journalEntries.$inferSelect)[]): Promise<JournalEntry[]> {
    if (!es.length) return [];
    const ls = await this.tx
      .select()
      .from(journalLines)
      .where(inArray(journalLines.journalEntryId, es.map((e) => e.id)))
      .orderBy(asc(journalLines.journalEntryId), asc(journalLines.lineNo));
    return es.map((e) => {
      const lines = ls.filter((l) => l.journalEntryId === e.id).map((l) => toLine(l, e.currency));
      const entry: JournalEntry = {
        id: e.id,
        entityId: e.entityId,
        fiscalYear: e.fiscalYear,
        seq: e.seq,
        entryNo: e.entryNo,
        postingDate: e.postingDate,
        documentDate: e.documentDate,
        source: e.sourceId ? { type: e.sourceType as SourceType, id: e.sourceId } : { type: e.sourceType as SourceType },
        memo: e.memo,
        currency: e.currency,
        lines,
        ...(e.reversesId ? { reversesId: e.reversesId } : {}),
        postedAt: e.postedAt.toISOString(),
        postedBy: e.postedBy,
        hash: e.hash,
      };
      return Object.freeze(entry);
    });
  }
}

function toLine(l: typeof journalLines.$inferSelect, currency: string): JournalLine {
  const debit = l.debitMinor > 0n;
  const line: JournalLine = {
    lineNo: l.lineNo,
    accountId: l.accountId,
    side: debit ? 'DEBIT' : 'CREDIT',
    amount: Money.of(debit ? l.debitMinor : l.creditMinor, currency),
  };
  if (l.txnCurrency && l.txnAmountMinor !== null && l.fxRate) {
    line.txn = { amount: Money.of(l.txnAmountMinor, l.txnCurrency), rate: l.fxRate };
  }
  if (l.taxCode) line.taxCode = l.taxCode;
  if (l.taxBaseMinor !== null) line.taxBase = Money.of(l.taxBaseMinor, currency);
  if (l.vatEmirate) line.emirate = l.vatEmirate as Emirate;
  if (l.counterpartyId) line.counterpartyId = l.counterpartyId;
  if (Object.keys(l.dimensions).length) line.dimensions = l.dimensions;
  if (l.memo) line.memo = l.memo;
  return line;
}

/**
 * Persists audit events into the per-tenant hash chain. A transaction-scoped advisory lock serialises appends
 * per tenant, so two concurrent postings cannot fork the chain.
 */
export class PgAuditSink implements AuditSink {
  constructor(private readonly tx: Db) {}

  async record(input: AuditEventInput): Promise<void> {
    await this.tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 0))`);
    const [last] = await this.tx
      .select({ seq: auditEvents.seq, hash: auditEvents.hash })
      .from(auditEvents)
      .orderBy(sql`${auditEvents.seq} desc`)
      .limit(1);
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS_HASH;
    const event = { ...input, at: new Date(input.at).toISOString() };
    await this.tx.insert(auditEvents).values({
      tenantId: sql`app_tenant_id()`,
      seq,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
      at: new Date(event.at),
      before: event.before ?? null,
      after: event.after ?? null,
      reason: event.reason ?? null,
      prevHash,
      hash: hashAuditEvent(prevHash, { ...event, seq }),
    });
  }
}

/** Reads the tenant's audit chain in order, in the shape verifyChain() expects. */
export async function loadAuditChain(tx: Db): Promise<AuditEvent[]> {
  const es = await tx.select().from(auditEvents).orderBy(asc(auditEvents.seq));
  return es.map((e) => ({
    tenantId: e.tenantId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    actorId: e.actorId,
    at: e.at.toISOString(),
    ...(e.before !== null ? { before: e.before } : {}),
    ...(e.after !== null ? { after: e.after } : {}),
    ...(e.reason !== null ? { reason: e.reason } : {}),
    seq: e.seq,
    prevHash: e.prevHash,
    hash: e.hash,
  }));
}

export async function loadAccounts(tx: Db, entityId: string): Promise<Map<string, Account>> {
  const as = await tx.select().from(accounts).where(eq(accounts.entityId, entityId));
  return new Map(
    as.map((a) => [
      a.id,
      {
        id: a.id,
        entityId: a.entityId,
        code: a.code,
        name: { en: a.nameEn, ar: a.nameAr },
        type: a.type,
        isActive: a.isActive,
        ...(a.controlSubledger ? { control: a.controlSubledger as SubLedger } : {}),
        ...(a.ctTreatment ? { ctTreatment: a.ctTreatment as Account['ctTreatment'] & string } : {}),
      },
    ]),
  );
}

export async function loadPeriods(tx: Db, entityId: string): Promise<PeriodCalendar> {
  const ps = await tx.select().from(fiscalPeriods).where(eq(fiscalPeriods.entityId, entityId));
  return new PeriodCalendar(
    ps.map(
      (p): FiscalPeriod => ({
        entityId: p.entityId,
        key: p.periodKey,
        fiscalYear: p.fiscalYear,
        start: p.startDate,
        end: p.endDate,
        status: p.status,
        closedModules: p.closedModules as SubLedger[],
      }),
    ),
  );
}
