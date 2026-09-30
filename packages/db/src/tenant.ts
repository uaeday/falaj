import { type SQL, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// biome-ignore lint: drizzle's schema generic is irrelevant here
export type Db = PgDatabase<PgQueryResultHKT, any>;

/** Rows from `db.execute` across drivers (node-postgres and PGlite both expose `.rows`). */
export async function rows<T>(db: Db, query: SQL): Promise<T[]> {
  return ((await db.execute(query)) as unknown as { rows: T[] }).rows;
}

/**
 * Runs `fn` in a transaction scoped to one tenant. `app.tenant_id` is transaction-local, so a pooled connection
 * can never leak one tenant's context into another request. RLS returns nothing if this is skipped.
 */
export async function withTenant<T>(
  db: Db,
  tenantId: string,
  fn: (tx: Db) => Promise<T>,
  opts: { allowSoftClosed?: boolean } = {},
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    if (opts.allowSoftClosed) await tx.execute(sql`select set_config('app.allow_soft_closed', 'on', true)`);
    return fn(tx as unknown as Db);
  });
}
