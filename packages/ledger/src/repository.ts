import type { JournalEntry } from './types.ts';

/**
 * Persistence port for the ledger. The Postgres implementation lives in @falaj/db and runs every call
 * of one posting inside a single transaction (entry number, entry, audit event, outbox).
 */
export interface LedgerRepository {
  /** Next gapless sequence for (entity, fiscal year). Must be taken under a row lock in SQL implementations. */
  nextSequence(entityId: string, fiscalYear: number): Promise<number>;
  insert(entry: JournalEntry): Promise<void>;
  get(id: string): Promise<JournalEntry | undefined>;
  /** Id of the entry that reverses `id`, if any. */
  reversalOf(id: string): Promise<string | undefined>;
  list(entityId: string, range: { from?: string; to: string }): Promise<JournalEntry[]>;
}

export class InMemoryLedgerRepository implements LedgerRepository {
  private readonly entries = new Map<string, JournalEntry>();
  private readonly sequences = new Map<string, number>();
  private readonly reversals = new Map<string, string>();

  async nextSequence(entityId: string, fiscalYear: number): Promise<number> {
    const key = `${entityId}:${fiscalYear}`;
    const next = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, next);
    return next;
  }

  async insert(entry: JournalEntry): Promise<void> {
    if (this.entries.has(entry.id)) throw new Error(`Entry ${entry.id} already exists`);
    if (entry.reversesId) {
      if (this.reversals.has(entry.reversesId)) throw new Error(`Entry ${entry.reversesId} already reversed`);
      this.reversals.set(entry.reversesId, entry.id);
    }
    this.entries.set(entry.id, entry);
  }

  async get(id: string): Promise<JournalEntry | undefined> {
    return this.entries.get(id);
  }

  async reversalOf(id: string): Promise<string | undefined> {
    return this.reversals.get(id);
  }

  async list(entityId: string, range: { from?: string; to: string }): Promise<JournalEntry[]> {
    return [...this.entries.values()].filter(
      (e) => e.entityId === entityId && e.postingDate <= range.to && (!range.from || e.postingDate >= range.from),
    );
  }
}
