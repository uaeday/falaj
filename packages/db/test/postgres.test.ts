import { PGlite } from '@electric-sql/pglite';
import { aed } from '@falaj/core';
import { type Actor, Ledger, PERMISSIONS, verifyChain } from '@falaj/ledger';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Db, PgAuditSink, PgLedgerRepository, loadAccounts, loadAuditChain, loadPeriods, migrationFiles, rows, withTenant,
} from '../src/index.ts';

const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ENTITY_A = '00000000-0000-4000-8000-0000000000e1';
const ENTITY_B = '00000000-0000-4000-8000-0000000000e2';
const acct = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BANK = acct(1100);
const SALES = acct(4000);
const AR = acct(1200);

const actor: Actor = { userId: 'u-accountant', permissions: new Set([PERMISSIONS.postManual]) };

let pg: PGlite;
let db: Db;

async function seed() {
  await pg.exec(`
    insert into tenants (id, name) values ('${TENANT_A}', 'Al Qattara Group'), ('${TENANT_B}', 'Other Co');
    insert into legal_entities (id, tenant_id, legal_name_en, legal_name_ar, jurisdiction_type, emirate, licensing_authority, vat_trn) values
      ('${ENTITY_A}', '${TENANT_A}', 'Al Qattara Trading LLC', 'القطارة للتجارة ذ.م.م', 'MAINLAND', 'DXB', 'DET', '100234567890003'),
      ('${ENTITY_B}', '${TENANT_B}', 'Other Co FZE', 'شركة أخرى', 'FREE_ZONE', 'SHJ', 'SAIF', null);
    insert into fiscal_periods (tenant_id, entity_id, period_key, fiscal_year, start_date, end_date)
      select t, e, to_char(d, 'YYYY-MM'), 2027, d, (d + interval '1 month - 1 day')::date
      from (values ('${TENANT_A}'::uuid, '${ENTITY_A}'::uuid), ('${TENANT_B}'::uuid, '${ENTITY_B}'::uuid)) x(t, e),
           generate_series('2027-01-01'::date, '2027-12-01'::date, interval '1 month') d;
    insert into accounts (id, tenant_id, entity_id, code, name_en, name_ar, type, control_subledger) values
      ('${BANK}', '${TENANT_A}', '${ENTITY_A}', '1100', 'Bank', 'البنك', 'ASSET', null),
      ('${AR}', '${TENANT_A}', '${ENTITY_A}', '1200', 'Accounts receivable', 'الذمم المدينة', 'ASSET', 'AR'),
      ('${SALES}', '${TENANT_A}', '${ENTITY_A}', '4000', 'Sales', 'المبيعات', 'INCOME', null),
      ('${acct(9100)}', '${TENANT_B}', '${ENTITY_B}', '1100', 'Bank', 'البنك', 'ASSET', null);
  `);
}

async function ledgerFor(tx: Db, tenantId: string, entityId: string) {
  const accounts = await loadAccounts(tx, entityId);
  return new Ledger({
    tenantId,
    repo: new PgLedgerRepository(tx),
    accounts: (id) => accounts.get(id),
    periods: await loadPeriods(tx, entityId),
    audit: new PgAuditSink(tx),
  });
}

const sale = (date = '2027-02-10', amount = '1000.00') => ({
  entityId: ENTITY_A,
  postingDate: date,
  source: { type: 'MANUAL' as const },
  memo: 'Cash sale',
  lines: [
    { accountId: BANK, debit: aed(amount), dimensions: { branch: 'DXB-01' } },
    { accountId: SALES, credit: aed(amount), taxCode: 'SR', taxBase: aed(amount), emirate: 'DXB' as const },
  ],
});

async function post(input = sale()) {
  return withTenant(db, TENANT_A, async (tx) => {
    const r = await (await ledgerFor(tx, TENANT_A, ENTITY_A)).post(input, actor);
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    return r.value;
  });
}

/** Drizzle wraps driver errors ("Failed query: …"); match against the Postgres error underneath. */
async function dbError(p: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    expect(`${err.message}\n${err.cause?.message ?? String(err.cause ?? '')}`).toMatch(pattern);
    return;
  }
  throw new Error(`Expected a database error matching ${pattern}`);
}

/** Raw SQL as the app role inside a tenant transaction, to prove the DB enforces invariants on its own. */
const raw = (tenantId: string, ...stmts: string[]) =>
  withTenant(db, tenantId, async (tx) => {
    for (const s of stmts) await tx.execute(sql.raw(s));
  });

beforeAll(async () => {
  pg = new PGlite();
  for (const m of migrationFiles()) await pg.exec(m.sql);
  await seed();
  await pg.exec('set role falaj_app');
  db = drizzle(pg) as unknown as Db;
});

describe('Postgres ledger (RLS, append-only, deferred balance)', () => {
  it('posts through the domain, persists, and the content hash survives the round trip', async () => {
    const posted = await post();
    const reloaded = await withTenant(db, TENANT_A, (tx) => new PgLedgerRepository(tx).get(posted.id));
    expect(reloaded).toBeDefined();
    expect(reloaded!.entryNo).toBe('JE-2027-000001');
    expect(Ledger.verifyEntryHash(reloaded!)).toBe(true);
    expect(reloaded!.lines[1]).toMatchObject({ taxCode: 'SR', emirate: 'DXB' });
    expect(reloaded!.lines[0]!.dimensions).toEqual({ branch: 'DXB-01' });
    const outbox = await withTenant(db, TENANT_A, (tx) => rows<{ event_type: string }>(tx, sql`select event_type from outbox_events`));
    expect(outbox.map((o) => o.event_type)).toEqual(['JournalPosted']);
  });

  it('tenant B and sessions without a tenant see nothing of tenant A (US-01.2)', async () => {
    const seenByB = await withTenant(db, TENANT_B, (tx) => rows(tx, sql`select * from journal_entries`));
    expect(seenByB).toHaveLength(0);
    const noTenant = await rows(db, sql`select * from journal_entries`);
    expect(noTenant).toHaveLength(0);
    const accountsNoTenant = await rows(db, sql`select * from accounts`);
    expect(accountsNoTenant).toHaveLength(0);
  });

  it('refuses writes that claim another tenant', async () => {
    await dbError(raw(TENANT_A, `insert into tenants (id, name) values ('00000000-0000-4000-8000-0000000000cc', 'sneaky')`), /row-level security/);
    await dbError(raw(TENANT_A, `insert into accounts (tenant_id, entity_id, code, name_en, name_ar, type) values ('${TENANT_B}', '${ENTITY_B}', '9', 'x', 'x', 'ASSET')`), /row-level security/);
  });

  it('the app role cannot UPDATE or DELETE ledger rows; even the owner hits the immutability trigger', async () => {
    await dbError(raw(TENANT_A, `update journal_entries set memo = 'edited'`), /permission denied/);
    await dbError(raw(TENANT_A, `delete from journal_lines`), /permission denied/);
    await pg.exec('reset role');
    try {
      await expect(pg.exec(`update journal_entries set memo = 'edited'`)).rejects.toThrow(/IMMUTABLE/);
      await expect(pg.exec(`delete from audit_events`)).rejects.toThrow(/IMMUTABLE/);
    } finally {
      await pg.exec('set role falaj_app');
    }
  });

  it('an unbalanced entry inserted behind the domain layer fails at COMMIT', async () => {
    const id = '00000000-0000-4000-8000-00000000f001';
    await dbError(raw(TENANT_A, `
        insert into journal_entries (id, tenant_id, entity_id, fiscal_year, seq, entry_no, posting_date, document_date, source_type, memo, currency, hash, posted_at, posted_by)
          values ('${id}', app_tenant_id(), '${ENTITY_A}', 2027, 900, 'JE-X', '2027-03-01', '2027-03-01', 'MANUAL', 'bad', 'AED', repeat('0', 64), now(), 'sql')`,
        `insert into journal_lines (tenant_id, journal_entry_id, line_no, account_id, debit_minor) values (app_tenant_id(), '${id}', 1, '${BANK}', 100)`,
        `insert into journal_lines (tenant_id, journal_entry_id, line_no, account_id, credit_minor) values (app_tenant_id(), '${id}', 2, '${SALES}', 99)`), /UNBALANCED/);
    await dbError(raw(TENANT_A, `insert into journal_lines (tenant_id, journal_entry_id, line_no, account_id, debit_minor, credit_minor)
                     values (app_tenant_id(), '${id}', 1, '${BANK}', 100, 100)`), /violates check constraint/);
  });

  it('locked periods are enforced by the database as well as the domain', async () => {
    await raw(TENANT_A, `update fiscal_periods set status = 'LOCKED' where period_key = '2027-04'`);
    await dbError(post(sale('2027-04-15')), /PERIOD_LOCKED/);
    await dbError(raw(TENANT_A, `insert into journal_entries (id, tenant_id, entity_id, fiscal_year, seq, entry_no, posting_date, document_date, source_type, memo, currency, hash, posted_at, posted_by)
                     values (gen_random_uuid(), app_tenant_id(), '${ENTITY_A}', 2027, 901, 'JE-Y', '2027-04-15', '2027-04-15', 'MANUAL', 'x', 'AED', repeat('0', 64), now(), 'sql')`), /PERIOD_LOCKED/);
  });

  it('numbering stays gapless when a posting transaction rolls back', async () => {
    await expect(
      withTenant(db, TENANT_A, async (tx) => {
        await (await ledgerFor(tx, TENANT_A, ENTITY_A)).post(sale('2027-05-01'), actor);
        throw new Error('simulated failure after posting');
      }),
    ).rejects.toThrow(/simulated/);
    const next = await post(sale('2027-05-02'));
    expect(next.entryNo).toBe('JE-2027-000002');
  });

  it('reversal works once; the DB refuses a second one', async () => {
    const orig = await post(sale('2027-06-01', '250.00'));
    const rev = await withTenant(db, TENANT_A, async (tx) =>
      (await ledgerFor(tx, TENANT_A, ENTITY_A)).reverse(orig.id, { postingDate: '2027-06-02', reason: 'Duplicate' }, actor),
    );
    expect(rev.ok).toBe(true);
    const again = await withTenant(db, TENANT_A, async (tx) =>
      (await ledgerFor(tx, TENANT_A, ENTITY_A)).reverse(orig.id, { postingDate: '2027-06-03', reason: 'Again' }, actor),
    );
    expect(!again.ok && again.error[0]!.code).toBe('ALREADY_REVERSED');
    await dbError(raw(TENANT_A, `insert into journal_entries (id, tenant_id, entity_id, fiscal_year, seq, entry_no, posting_date, document_date, source_type, memo, currency, reverses_id, hash, posted_at, posted_by)
                     values (gen_random_uuid(), app_tenant_id(), '${ENTITY_A}', 2027, 902, 'JE-Z', '2027-06-03', '2027-06-03', 'MANUAL', 'x', 'AED', '${orig.id}', repeat('0', 64), now(), 'sql')`), /duplicate key|unique/);
  });

  it('trial balance from Postgres balances', async () => {
    const tb = await withTenant(db, TENANT_A, async (tx) => (await ledgerFor(tx, TENANT_A, ENTITY_A)).trialBalance(ENTITY_A, { to: '2027-12-31' }));
    expect(tb.totalDebit.equals(tb.totalCredit)).toBe(true);
    expect(tb.rows.find((r) => r.account.code === '4000')!.net.toDecimalString()).toBe('-2000.00');
  });

  it('the persisted audit chain verifies, and tampering is detected (US-01.4)', async () => {
    const chain = await withTenant(db, TENANT_A, (tx) => loadAuditChain(tx));
    expect(chain.map((e) => e.action)).toEqual(['journal.posted', 'journal.posted', 'journal.posted', 'journal.reversed']);
    expect(verifyChain(chain)).toMatchObject({ valid: true, length: 4 });

    // A DBA disabling the trigger to edit history still cannot hide it.
    await pg.exec('reset role');
    await pg.exec('alter table audit_events disable trigger audit_events_immutable');
    await pg.exec(`update audit_events set actor_id = 'someone-else' where seq = 2`);
    await pg.exec('alter table audit_events enable trigger audit_events_immutable');
    await pg.exec('set role falaj_app');
    const tampered = await withTenant(db, TENANT_A, (tx) => loadAuditChain(tx));
    expect(verifyChain(tampered)).toEqual({ valid: false, brokenAt: 2 });
  });
});
