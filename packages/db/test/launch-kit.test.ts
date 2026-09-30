import { PGlite } from '@electric-sql/pglite';
import { aed } from '@falaj/core';
import { FixtureLicenceSource, SAMPLE_LICENCES } from '@falaj/company';
import { Ledger, PERMISSIONS } from '@falaj/ledger';
import { FakeAspOnboarding, FakeOpenFinance, type LaunchState, newLaunch, runLaunch } from '@falaj/provisioning';
import { FakeSitePublisher } from '@falaj/website';
import { FakeEmailProvider, FakeRegistrar } from '@falaj/workspace';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Db, PgAuditSink, PgLaunchStore, PgLedgerRepository, loadAccounts, loadPeriods, materialiseLaunch, migrationFiles, rows, withTenant,
} from '../src/index.ts';

const TENANT = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000b1';
const PARTNER = '00000000-0000-4000-8000-0000000000c1';
let pg: PGlite;
let db: Db;
let live: LaunchState;

const deps = () => {
  let t = Date.parse('2026-10-01T05:00:00Z');
  return {
    licences: new FixtureLicenceSource(SAMPLE_LICENCES),
    registrar: new FakeRegistrar(),
    email: new FakeEmailProvider('GOOGLE'),
    sites: new FakeSitePublisher(),
    openFinance: new FakeOpenFinance(),
    asp: new FakeAspOnboarding(),
    now: () => new Date((t += 180_000)),
    newId: () => crypto.randomUUID(),
    sitesHost: { apexIp: '203.0.113.10', cname: 'sites.falaj.ae' },
  };
};

beforeAll(async () => {
  pg = new PGlite();
  for (const m of migrationFiles()) await pg.exec(m.sql);
  await pg.exec(`insert into tenants (id, name) values ('${TENANT}', 'Sidra'), ('${OTHER}', 'Other');
                 insert into partners (id, type, name) values ('${PARTNER}', 'SETUP_AGENT', 'Sample Setup Services');`);
  await pg.exec('set role falaj_app');
  db = drizzle(pg) as unknown as Db;
});

describe('Launch Kit persistence (migration 0002)', () => {
  it('persists every step of a launch run as it happens', async () => {
    live = await withTenant(db, TENANT, async (tx) => {
      const store = new PgLaunchStore(tx);
      const d = { ...deps(), audit: new PgAuditSink(tx), save: (s: LaunchState) => store.save(s) };
      const input = { licence: { authority: 'DET', licenceNo: '1234567' }, emailProvider: 'GOOGLE' as const, headcount: 3,
        partner: { partnerId: PARTNER, type: 'SETUP_AGENT' as const }, expectedAnnualRevenueAed: '900000' };
      return runLaunch(newLaunch('launch-sidra', TENANT, input, d.now()), d);
    });
    expect(live.status).toBe('LIVE');
    const stored = await withTenant(db, TENANT, (tx) => new PgLaunchStore(tx).get('launch-sidra'));
    expect(stored).toEqual(live);
    const audit = await withTenant(db, TENANT, (tx) => rows<{ action: string }>(tx, sql`select action from audit_events order by seq`));
    expect(audit.map((a) => a.action)).toContain('launch.go_live.done');
  });

  it('materialises the company into the ledger, and the new books accept a balanced invoice', async () => {
    const { entityId } = await withTenant(db, TENANT, (tx) => materialiseLaunch(tx, live));
    const posted = await withTenant(db, TENANT, async (tx) => {
      const accounts = await loadAccounts(tx, entityId);
      const byCode = new Map([...accounts.values()].map((a) => [a.code, a.id]));
      const ledger = new Ledger({ tenantId: TENANT, repo: new PgLedgerRepository(tx), accounts: (id) => accounts.get(id), periods: await loadPeriods(tx, entityId), audit: new PgAuditSink(tx) });
      return ledger.post({
        entityId, postingDate: '2026-10-05', source: { type: 'AR_INVOICE', id: 'INV-0001' }, memo: 'First invoice on Falaj',
        lines: [
          { accountId: byCode.get('1200')!, debit: aed('10500') },
          { accountId: byCode.get('4000')!, credit: aed('10000'), taxCode: 'SR', taxBase: aed('10000'), emirate: 'DXB' },
          { accountId: byCode.get('2200')!, credit: aed('500') },
        ],
      }, { userId: 'owner', permissions: new Set([PERMISSIONS.postManual]) });
    });
    expect(posted.ok && posted.value.entryNo).toBe('JE-2026-000001');

    const obligations = await withTenant(db, TENANT, (tx) => rows<{ kind: string; verify: boolean }>(tx, sql`select kind, verify from compliance_obligations order by due_date nulls last`));
    expect(obligations.map((o) => o.kind)).toEqual(expect.arrayContaining(['CT_REGISTRATION', 'EINVOICE_GO_LIVE', 'VAT_REGISTRATION', 'UBO_REGISTER']));
    const company = await withTenant(db, TENANT, (tx) => rows<{ partner_type: string; vertical: string }>(tx, sql`select partner_type, vertical from companies`));
    expect(company).toEqual([{ partner_type: 'SETUP_AGENT', vertical: 'PROFESSIONAL_SERVICES' }]);
  });

  it('another tenant sees none of it, and cannot onboard the same licence again', async () => {
    for (const table of ['companies', 'company_people', 'launch_runs', 'compliance_obligations']) {
      const r = await withTenant(db, OTHER, (tx) => rows(tx, sql.raw(`select * from ${table}`)));
      expect(r, table).toHaveLength(0);
    }
    const copy: LaunchState = {
      ...live,
      company: { ...live.company!, id: crypto.randomUUID(), tenantId: OTHER, people: [] },
      finance: { ...live.finance!, accounts: live.finance!.accounts.map((a) => ({ ...a, id: crypto.randomUUID() })) },
      calendar: [],
    };
    try {
      await withTenant(db, OTHER, (tx) => materialiseLaunch(tx, copy));
      throw new Error('expected a duplicate-licence error');
    } catch (e) {
      const err = e as Error & { cause?: Error };
      expect(`${err.message} ${err.cause?.message ?? ''}`).toMatch(/companies_licence_authority_licence_no_key/);
    }
  });
});
