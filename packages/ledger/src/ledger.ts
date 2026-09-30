import { type CurrencyCode, FUNCTIONAL_CURRENCY, type Result, err, ok } from '@falaj/core';
import { type AuditEventInput, canonicalJson, sha256 } from './hash.ts';
import type { PeriodCalendar } from './periods.ts';
import type { LedgerRepository } from './repository.ts';
import { type TrialBalance, buildTrialBalance } from './trial-balance.ts';
import type { Account, Actor, JournalEntry, JournalEntryInput, JournalLineInput, LedgerError } from './types.ts';
import { isIsoDate, validateEntry } from './validate.ts';

export interface AuditSink {
  record(event: AuditEventInput): Promise<void> | void;
}

export interface LedgerDeps {
  tenantId: string;
  repo: LedgerRepository;
  accounts: (id: string) => Account | undefined;
  periods: PeriodCalendar;
  audit: AuditSink;
  functionalCurrency?: CurrencyCode;
  now?: () => Date;
  newId?: () => string;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * The only writer of journal entries. Entries are immutable once posted; corrections are reversals.
 */
export class Ledger {
  private readonly fc: CurrencyCode;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(private readonly deps: LedgerDeps) {
    this.fc = deps.functionalCurrency ?? FUNCTIONAL_CURRENCY;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  async post(input: JournalEntryInput, actor: Actor, reversesId?: string): Promise<Result<JournalEntry, LedgerError[]>> {
    const validated = validateEntry(input, {
      functionalCurrency: this.fc,
      account: this.deps.accounts,
      periods: this.deps.periods,
      actor,
    });
    if (!validated.ok) return validated;

    const period = this.deps.periods.find(input.entityId, input.postingDate)!;
    const seq = await this.deps.repo.nextSequence(input.entityId, period.fiscalYear);
    const content = {
      entityId: input.entityId,
      fiscalYear: period.fiscalYear,
      seq,
      entryNo: `JE-${period.fiscalYear}-${String(seq).padStart(6, '0')}`,
      postingDate: input.postingDate,
      documentDate: input.documentDate ?? input.postingDate,
      source: input.source.id ? { type: input.source.type, id: input.source.id } : { type: input.source.type },
      memo: input.memo,
      currency: this.fc,
      lines: validated.value,
      ...(reversesId ? { reversesId } : {}),
    };
    const entry: JournalEntry = deepFreeze({
      id: this.newId(),
      ...content,
      postedAt: this.now().toISOString(),
      postedBy: actor.userId,
      hash: sha256(canonicalJson(content)),
    });

    await this.deps.repo.insert(entry);
    await this.deps.audit.record({
      tenantId: this.deps.tenantId,
      action: reversesId ? 'journal.reversed' : 'journal.posted',
      entityType: 'journal_entry',
      entityId: entry.id,
      actorId: actor.userId,
      at: entry.postedAt,
      after: { entryNo: entry.entryNo, hash: entry.hash, ...(reversesId ? { reversesId } : {}) },
    });
    return ok(entry);
  }

  /**
   * Posts a mirror-image entry and links both ways. An entry can be reversed once, and reversals are not themselves reversible.
   * To undo a reversal, re-post the original transaction.
   */
  async reverse(
    entryId: string,
    opts: { postingDate: string; reason: string },
    actor: Actor,
  ): Promise<Result<JournalEntry, LedgerError[]>> {
    const original = await this.deps.repo.get(entryId);
    if (!original) return err([{ code: 'ENTRY_NOT_FOUND', message: `Entry ${entryId} not found` }]);
    if (await this.deps.repo.reversalOf(entryId)) {
      return err([{ code: 'ALREADY_REVERSED', message: `${original.entryNo} is already reversed` }]);
    }
    if (original.reversesId) return err([{ code: 'CANNOT_REVERSE_REVERSAL', message: 'Re-post the original instead' }]);
    if (!opts.reason.trim()) return err([{ code: 'REASON_REQUIRED', message: 'A reversal needs a reason' }]);
    if (!isIsoDate(opts.postingDate)) return err([{ code: 'INVALID_DATE', message: `Invalid date ${opts.postingDate}` }]);

    const lines: JournalLineInput[] = original.lines.map(({ lineNo: _n, side, amount, ...rest }) =>
      side === 'DEBIT' ? { ...rest, credit: amount } : { ...rest, debit: amount },
    );
    return this.post(
      {
        entityId: original.entityId,
        postingDate: opts.postingDate,
        source: original.source,
        memo: `Reversal of ${original.entryNo}: ${opts.reason}`,
        lines,
      },
      actor,
      original.id,
    );
  }

  async get(id: string): Promise<(JournalEntry & { reversedById?: string }) | undefined> {
    const e = await this.deps.repo.get(id);
    if (!e) return undefined;
    const reversedById = await this.deps.repo.reversalOf(id);
    return reversedById ? { ...e, reversedById } : e;
  }

  async trialBalance(entityId: string, range: { from?: string; to: string }): Promise<TrialBalance> {
    return buildTrialBalance(await this.deps.repo.list(entityId, range), this.deps.accounts, this.fc, range);
  }

  /** Recomputes an entry's content hash; false means stored data no longer matches what was posted. */
  static verifyEntryHash(entry: JournalEntry): boolean {
    const { id: _id, postedAt: _p, postedBy: _b, hash, ...content } = entry;
    return sha256(canonicalJson(content)) === hash;
  }
}
