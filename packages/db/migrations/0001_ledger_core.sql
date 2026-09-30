-- Falaj · 0001 ledger core
-- Source of truth for tenant isolation (RLS), append-only ledger, and posting invariants I-1…I-10 (docs/06 §6.6).
-- Runs as the schema owner. The application connects as `falaj_app`: not the owner, no BYPASSRLS.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'falaj_app') then create role falaj_app nologin; end if;
end $$;

-- Current tenant from the transaction-local setting. NULL (no rows visible) when unset.
create or replace function app_tenant_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create table tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  data_residency  text not null default 'uae-north',
  created_at      timestamptz not null default now()
);

create table legal_entities (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id),
  legal_name_en           text not null,
  legal_name_ar           text not null,
  jurisdiction_type       text not null check (jurisdiction_type in ('MAINLAND','FREE_ZONE','DESIGNATED_ZONE','DIFC','ADGM')),
  emirate                 char(3) not null check (emirate in ('AUH','DXB','SHJ','AJM','UAQ','RAK','FUJ')),
  licensing_authority     text,
  vat_trn                 char(15) check (vat_trn ~ '^[0-9]{15}$'),
  ct_trn                  text,
  functional_currency     char(3) not null default 'AED',
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  created_at              timestamptz not null default now(),
  unique (id, tenant_id)
);

create table fiscal_periods (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  entity_id      uuid not null,
  period_key     text not null,
  fiscal_year    int  not null,
  start_date     date not null,
  end_date       date not null,
  status         text not null default 'OPEN' check (status in ('OPEN','SOFT_CLOSED','LOCKED')),
  closed_modules text[] not null default '{}',
  foreign key (entity_id, tenant_id) references legal_entities(id, tenant_id),
  unique (entity_id, period_key),
  check (start_date <= end_date)
);

create table accounts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  entity_id         uuid not null,
  code              text not null,
  name_en           text not null,
  name_ar           text not null,
  type              text not null check (type in ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  control_subledger text check (control_subledger in ('AR','AP','INVENTORY','PAYROLL','VAT','BANK','FIXED_ASSET')),
  ct_treatment      text check (ct_treatment in ('DEDUCTIBLE','NON_DEDUCTIBLE','PARTIAL_50','EXEMPT_INCOME')),
  is_active         boolean not null default true,
  parent_id         uuid references accounts(id),
  foreign key (entity_id, tenant_id) references legal_entities(id, tenant_id),
  unique (entity_id, code),
  unique (id, tenant_id)
);

-- Gapless numbering (I-7): the posting transaction takes the row lock via INSERT … ON CONFLICT DO UPDATE.
create table entry_sequences (
  tenant_id   uuid not null,
  entity_id   uuid not null,
  fiscal_year int  not null,
  last_seq    int  not null,
  primary key (entity_id, fiscal_year),
  foreign key (entity_id, tenant_id) references legal_entities(id, tenant_id)
);

create table journal_entries (
  id            uuid primary key,
  tenant_id     uuid not null,
  entity_id     uuid not null,
  fiscal_year   int  not null,
  seq           int  not null,
  entry_no      text not null,
  posting_date  date not null,
  document_date date not null,
  source_type   text not null,
  source_id     text,
  memo          text not null,
  currency      char(3) not null,
  reverses_id   uuid unique references journal_entries(id),          -- I-6: reversed at most once
  hash          char(64) not null,
  posted_at     timestamptz not null,
  posted_by     text not null,
  foreign key (entity_id, tenant_id) references legal_entities(id, tenant_id),
  unique (entity_id, fiscal_year, seq),
  unique (id, tenant_id),
  check (source_type = 'MANUAL' or source_id is not null)
);

create table journal_lines (
  tenant_id         uuid not null,
  journal_entry_id  uuid not null,
  line_no           smallint not null,
  account_id        uuid not null,
  debit_minor       bigint not null default 0 check (debit_minor >= 0),
  credit_minor      bigint not null default 0 check (credit_minor >= 0),
  txn_currency      char(3),
  txn_amount_minor  bigint,
  fx_rate           text check (fx_rate ~ '^[0-9]+(\.[0-9]+)?$'),        -- text keeps the exact rate string used
  tax_code          text,
  tax_base_minor    bigint,
  vat_emirate       char(3),
  counterparty_id   uuid,
  dimensions        jsonb not null default '{}',
  memo              text,
  primary key (journal_entry_id, line_no),
  foreign key (journal_entry_id, tenant_id) references journal_entries(id, tenant_id),
  foreign key (account_id, tenant_id) references accounts(id, tenant_id),
  check ((debit_minor > 0) <> (credit_minor > 0)),                      -- I-3
  check (tax_code is null or tax_base_minor is not null),               -- I-10
  check ((txn_currency is null) = (txn_amount_minor is null))
);
create index journal_lines_account_idx on journal_lines (account_id);

create table audit_events (
  tenant_id   uuid not null references tenants(id),
  seq         bigint not null,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  actor_id    text not null,
  at          timestamptz not null,
  before      jsonb,
  after       jsonb,
  reason      text,
  prev_hash   char(64) not null,
  hash        char(64) not null,
  primary key (tenant_id, seq)
);

create table outbox_events (
  id             bigserial primary key,
  tenant_id      uuid not null references tenants(id),
  aggregate_type text not null,
  aggregate_id   text not null,
  event_type     text not null,
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  published_at   timestamptz
);
create index outbox_unpublished_idx on outbox_events (created_at) where published_at is null;

-- ── I-4: append-only ledger & audit log ────────────────────────────────
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'IMMUTABLE: % is append-only; post a reversal instead', tg_table_name using errcode = 'P0001';
end $$;

create trigger journal_entries_immutable before update or delete on journal_entries for each row execute function forbid_mutation();
create trigger journal_lines_immutable   before update or delete on journal_lines   for each row execute function forbid_mutation();
create trigger audit_events_immutable    before update or delete on audit_events    for each row execute function forbid_mutation();
create trigger journal_entries_no_truncate before truncate on journal_entries for each statement execute function forbid_mutation();
create trigger journal_lines_no_truncate   before truncate on journal_lines   for each statement execute function forbid_mutation();
create trigger audit_events_no_truncate    before truncate on audit_events    for each statement execute function forbid_mutation();

-- ── I-5: posting date must fall in an open period ──────────────────────
create or replace function check_posting_period() returns trigger language plpgsql as $$
declare p fiscal_periods%rowtype;
begin
  select * into p from fiscal_periods
   where entity_id = new.entity_id and new.posting_date between start_date and end_date;
  if not found then
    raise exception 'PERIOD_NOT_FOUND: no fiscal period covers %', new.posting_date using errcode = 'P0001';
  end if;
  if p.status = 'LOCKED' then
    raise exception 'PERIOD_LOCKED: period % is locked', p.period_key using errcode = 'P0001';
  end if;
  if p.status = 'SOFT_CLOSED' and coalesce(current_setting('app.allow_soft_closed', true), '') <> 'on' then
    raise exception 'PERIOD_SOFT_CLOSED: period % is soft-closed', p.period_key using errcode = 'P0001';
  end if;
  if new.fiscal_year <> p.fiscal_year then
    raise exception 'FISCAL_YEAR_MISMATCH' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger journal_entries_period before insert on journal_entries for each row execute function check_posting_period();

-- ── I-9 (entity part): lines post only to active accounts of the entry's entity ──
create or replace function check_line_account() returns trigger language plpgsql as $$
declare a accounts%rowtype; e_entity uuid;
begin
  select entity_id into e_entity from journal_entries where id = new.journal_entry_id;
  select * into a from accounts where id = new.account_id;
  if a.entity_id <> e_entity then raise exception 'WRONG_ENTITY: account % belongs to another entity', a.code using errcode = 'P0001'; end if;
  if not a.is_active then raise exception 'INACTIVE_ACCOUNT: %', a.code using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger journal_lines_account before insert on journal_lines for each row execute function check_line_account();

-- ── I-1: every entry balances with ≥ 2 lines, checked at COMMIT ────────
create or replace function check_entry_balanced() returns trigger language plpgsql as $$
declare entry_id uuid; n int; dr bigint; cr bigint;
begin
  -- Branch on the table: PL/pgSQL would fail resolving NEW.journal_entry_id on journal_entries inside a CASE.
  if tg_table_name = 'journal_entries' then entry_id := new.id; else entry_id := new.journal_entry_id; end if;
  select count(*), coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0) into n, dr, cr
    from journal_lines where journal_entry_id = entry_id;
  if n < 2 then raise exception 'TOO_FEW_LINES: entry % has % line(s)', entry_id, n using errcode = 'P0001'; end if;
  if dr <> cr then raise exception 'UNBALANCED: entry % debits % credits %', entry_id, dr, cr using errcode = 'P0001'; end if;
  return null;
end $$;
create constraint trigger journal_entries_balanced after insert on journal_entries
  deferrable initially deferred for each row execute function check_entry_balanced();
create constraint trigger journal_lines_balanced after insert on journal_lines
  deferrable initially deferred for each row execute function check_entry_balanced();

-- ── Row-level security ─────────────────────────────────────────────────
alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenant_self on tenants using (id = app_tenant_id()) with check (id = app_tenant_id());

do $$
declare t text;
begin
  foreach t in array array['legal_entities','fiscal_periods','accounts','entry_sequences','journal_entries',
                           'journal_lines','audit_events','outbox_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())', t);
  end loop;
end $$;

-- ── Grants: ledger tables are INSERT/SELECT only for the app ───────────
grant usage on schema public to falaj_app;
grant select, insert on journal_entries, journal_lines, audit_events to falaj_app;
grant select, insert, update on tenants, legal_entities, fiscal_periods, accounts, entry_sequences to falaj_app;
grant select, insert on outbox_events to falaj_app;
grant update (published_at) on outbox_events to falaj_app;
grant usage on sequence outbox_events_id_seq to falaj_app;
