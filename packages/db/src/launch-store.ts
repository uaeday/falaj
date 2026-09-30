import type { LaunchState, LaunchStore } from '@falaj/provisioning';
import { sql } from 'drizzle-orm';
import { type Db, rows } from './tenant.ts';

const JURISDICTION: Record<string, string> = { MAINLAND: 'MAINLAND', FREE_ZONE: 'FREE_ZONE', DIFC: 'DIFC', ADGM: 'ADGM' };

/** Launch runs as jsonb snapshots, one row per run, updated after every step. */
export class PgLaunchStore implements LaunchStore {
  constructor(private readonly tx: Db) {}

  async save(s: LaunchState): Promise<void> {
    await this.tx.execute(sql`
      insert into launch_runs (id, tenant_id, company_id, status, state, started_at, live_at, updated_at)
      values (${s.runId}, app_tenant_id(), ${s.company?.id ?? null}, ${s.status}, ${JSON.stringify(s)}::jsonb, ${s.startedAt}, ${s.liveAt ?? null}, now())
      on conflict (id) do update set company_id = excluded.company_id, status = excluded.status, state = excluded.state,
        live_at = excluded.live_at, updated_at = now()`);
  }

  async get(runId: string): Promise<LaunchState | undefined> {
    const [r] = await rows<{ state: LaunchState }>(this.tx, sql`select state from launch_runs where id = ${runId}`);
    return r?.state;
  }
}

/**
 * Turns a LIVE launch into records the rest of the platform runs on: the legal entity, fiscal periods and
 * chart of accounts for the ledger, plus the company, its people and its compliance calendar. One transaction.
 */
export async function materialiseLaunch(tx: Db, s: LaunchState): Promise<{ entityId: string }> {
  const c = s.company;
  const f = s.finance;
  if (s.status !== 'LIVE' || !c || !f) throw new Error(`Launch ${s.runId} is not live`);

  await tx.execute(sql`
    insert into legal_entities (id, tenant_id, legal_name_en, legal_name_ar, jurisdiction_type, emirate, licensing_authority)
    values (${c.id}, app_tenant_id(), ${c.legalName.en}, ${c.legalName.ar ?? c.legalName.en}, ${JURISDICTION[c.jurisdiction]!}, ${c.emirate}, ${c.authority})`);

  for (const p of f.periods) {
    await tx.execute(sql`
      insert into fiscal_periods (tenant_id, entity_id, period_key, fiscal_year, start_date, end_date)
      values (app_tenant_id(), ${c.id}, ${p.key}, ${p.fiscalYear}, ${p.start}, ${p.end})`);
  }
  for (const a of f.accounts) {
    await tx.execute(sql`
      insert into accounts (id, tenant_id, entity_id, code, name_en, name_ar, type, control_subledger, ct_treatment)
      values (${a.id}, app_tenant_id(), ${c.id}, ${a.code}, ${a.name.en}, ${a.name.ar}, ${a.type}, ${a.control ?? null}, ${a.ctTreatment ?? null})`);
  }

  await tx.execute(sql`
    insert into companies (id, tenant_id, legal_entity_id, licence_authority, licence_no, legal_form, legal_name_en, legal_name_ar,
      trade_name_en, trade_name_ar, vertical, licence_issue_date, licence_expiry_date, activities, address,
      partner_id, partner_type, partner_attributed_at, created_at)
    values (${c.id}, app_tenant_id(), ${c.id}, ${c.authority}, ${c.licenceNo}, ${c.legalForm}, ${c.legalName.en}, ${c.legalName.ar ?? null},
      ${c.tradeName.en}, ${c.tradeName.ar ?? null}, ${c.vertical}, ${c.licenceIssueDate}, ${c.licenceExpiryDate},
      ${JSON.stringify(c.activities)}::jsonb, ${JSON.stringify(c.address)}::jsonb,
      ${c.partner?.partnerId ?? null}, ${c.partner?.type ?? null}, ${c.partner?.attributedAt ?? null}, ${c.createdAt})`);

  for (const p of c.people) {
    await tx.execute(sql`
      insert into company_people (id, tenant_id, company_id, name_en, name_ar, nationality, roles, share_pct, email, mobile)
      values (${p.id}, app_tenant_id(), ${c.id}, ${p.name.en}, ${p.name.ar ?? null}, ${p.nationality},
        ${`{${p.roles.join(',')}}`}::text[], ${p.sharePct ?? null}, ${p.email ?? null}, ${p.mobile ?? null})`);
  }
  for (const o of s.calendar ?? []) {
    await tx.execute(sql`
      insert into compliance_obligations (tenant_id, company_id, obligation_id, kind, due_date, title_en, title_ar, source, verify)
      values (app_tenant_id(), ${c.id}, ${o.id}, ${o.kind}, ${o.due}, ${o.title.en}, ${o.title.ar}, ${o.source}, ${o.verify})`);
  }
  return { entityId: c.id };
}
