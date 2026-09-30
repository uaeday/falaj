-- Falaj · 0002 Launch Kit (strategy v2: company operating system)
-- The one company record, channel partners, licence-to-live runs and the compliance calendar.

-- Channel partners are platform-level (setup agents, free zones, banks, accounting firms).
-- Revenue share stays NULL until a partner agreement sets it; the product never invents a rate.
create table partners (
  id                uuid primary key default gen_random_uuid(),
  type              text not null check (type in ('SETUP_AGENT','FREE_ZONE','BANK','ACCOUNTING_FIRM')),
  name              text not null,
  revenue_share_pct numeric(5,2) check (revenue_share_pct is null or revenue_share_pct between 0 and 100),
  created_at        timestamptz not null default now()
);

create table companies (
  id                   uuid primary key,
  tenant_id            uuid not null references tenants(id),
  legal_entity_id      uuid,
  licence_authority    text not null,
  licence_no           text not null,
  legal_form           text not null,
  legal_name_en        text not null,
  legal_name_ar        text,
  trade_name_en        text not null,
  trade_name_ar        text,
  vertical             text not null check (vertical in ('PROFESSIONAL_SERVICES','TRADING','ECOMMERCE','CONTRACTING','OTHER')),
  licence_issue_date   date not null,
  licence_expiry_date  date not null,
  activities           jsonb not null,
  address              jsonb not null,
  partner_id           uuid references partners(id),
  partner_type         text,
  partner_attributed_at timestamptz,
  created_at           timestamptz not null,
  -- A licence is onboarded once across the platform (prevents duplicate companies from two partners).
  unique (licence_authority, licence_no),
  unique (id, tenant_id),
  foreign key (legal_entity_id, tenant_id) references legal_entities(id, tenant_id),
  check ((partner_id is null) = (partner_type is null))
);

create table company_people (
  id                     uuid primary key,
  tenant_id              uuid not null,
  company_id             uuid not null,
  name_en                text not null,
  name_ar                text,
  nationality            text not null,
  roles                  text[] not null,
  share_pct              numeric(7,4),
  -- Field-level encrypted by the application (envelope encryption, KMS); never stored in clear.
  emirates_id_ciphertext text,
  email                  text,
  mobile                 text,
  foreign key (company_id, tenant_id) references companies(id, tenant_id)
);

create table launch_runs (
  id          text primary key,
  tenant_id   uuid not null references tenants(id),
  company_id  uuid,
  status      text not null check (status in ('RUNNING','WAITING','FAILED','LIVE')),
  state       jsonb not null,
  started_at  timestamptz not null,
  live_at     timestamptz,
  updated_at  timestamptz not null default now()
);
create index launch_runs_open_idx on launch_runs (status) where status <> 'LIVE';

create table compliance_obligations (
  tenant_id     uuid not null,
  company_id    uuid not null,
  obligation_id text not null,
  kind          text not null,
  due_date      date,
  title_en      text not null,
  title_ar      text not null,
  source        text not null,
  verify        boolean not null,
  status        text not null default 'OPEN' check (status in ('OPEN','DONE','DISMISSED')),
  completed_at  timestamptz,
  primary key (company_id, obligation_id),
  foreign key (company_id, tenant_id) references companies(id, tenant_id)
);
create index compliance_due_idx on compliance_obligations (due_date) where status = 'OPEN';

do $$
declare t text;
begin
  foreach t in array array['companies','company_people','launch_runs','compliance_obligations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())', t);
  end loop;
end $$;

grant select on partners to falaj_app;
grant select, insert, update on companies, company_people, launch_runs, compliance_obligations to falaj_app;
