# 06 — Domain model / ERD

Conventions:
- Every table carries `tenant_id` and is protected by Postgres Row-Level Security.
- Money is `bigint` minor units plus a `currency` char(3).
- Ledger tables are append-only.
- Every row carries `created_at` and `created_by`. Business tables also carry `version` for optimistic locking.

## 6.1 Bounded contexts

```mermaid
flowchart LR
  ORG[Organisation<br/>tenant, entity, branch, licence]
  IAM[Identity & Access<br/>user, role, SoD rule]
  LED[Ledger<br/>account, journal, period]
  TAX[Tax UAE<br/>tax code, VAT return, CT paper]
  EINV[E-invoicing<br/>PINT-AE doc, transmission]
  SAL[Sales / AR<br/>customer, invoice, receipt, PDC]
  PUR[Purchasing / AP<br/>vendor, PO, bill, payment]
  INV[Inventory<br/>item, warehouse, stock move]
  BNK[Bank & cash<br/>bank acct, statement, match]
  PAY[Payroll<br/>employee, pay run, WPS]
  CRM[CRM<br/>lead, opportunity, activity, consent]
  AUD[Audit log<br/>hash chain]

  SAL -- posts --> LED
  PUR -- posts --> LED
  INV -- posts --> LED
  BNK -- posts --> LED
  PAY -- posts --> LED
  SAL -- tax lines --> TAX
  PUR -- tax lines --> TAX
  TAX -- reads --> LED
  SAL -- invoice --> EINV
  EINV -- inbound bill --> PUR
  CRM -- account = customer --> SAL
  ORG --> LED
  IAM -. guards .-> LED
  LED -. events .-> AUD
```

Posting rule: **only the Ledger context writes `journal_entries`**. Other contexts publish a *posting request*, a domain command that carries a source-document reference. The ledger validates it (balanced, open period, active accounts) and posts it atomically in the same database transaction as the source document. The outbox then emits `JournalPosted`.

## 6.2 Core ERD — organisation, ledger, tax

```mermaid
erDiagram
  TENANT ||--o{ LEGAL_ENTITY : owns
  TENANT ||--o{ USER_MEMBERSHIP : has
  LEGAL_ENTITY ||--o{ BRANCH : has
  LEGAL_ENTITY ||--o{ TRADE_LICENCE : holds
  LEGAL_ENTITY ||--o{ FISCAL_PERIOD : defines
  LEGAL_ENTITY ||--o{ ACCOUNT : "chart of accounts"
  LEGAL_ENTITY ||--o{ JOURNAL_ENTRY : records
  JOURNAL_ENTRY ||--|{ JOURNAL_LINE : "2..n lines"
  ACCOUNT ||--o{ JOURNAL_LINE : "posted to"
  FISCAL_PERIOD ||--o{ JOURNAL_ENTRY : "falls in"
  JOURNAL_ENTRY |o--o| JOURNAL_ENTRY : "reverses"
  JOURNAL_LINE }o--o| TAX_CODE : "tax tagged"
  JOURNAL_LINE }o--o{ DIMENSION_VALUE : "tagged with"
  TAX_CODE ||--o{ TAX_RATE_VERSION : "effective-dated"
  LEGAL_ENTITY ||--o{ VAT_RETURN : files
  VAT_RETURN ||--|{ VAT_RETURN_BOX : contains
  VAT_RETURN_BOX ||--o{ JOURNAL_LINE : "drills to"
  LEGAL_ENTITY ||--o{ CT_WORKING_PAPER : prepares
  CT_WORKING_PAPER ||--|{ CT_ADJUSTMENT : contains
  TENANT ||--o{ AUDIT_EVENT : "hash-chained"
  TENANT ||--o{ OUTBOX_EVENT : emits

  TENANT {
    uuid id PK
    text name
    text data_residency "e.g. uae-north"
    text plan
  }
  LEGAL_ENTITY {
    uuid id PK
    uuid tenant_id FK
    text legal_name_en
    text legal_name_ar
    text jurisdiction_type "MAINLAND|FREE_ZONE|DESIGNATED_ZONE|DIFC|ADGM"
    text emirate "AUH|DXB|SHJ|AJM|UAQ|RAK|FUJ"
    text licensing_authority
    char15 vat_trn
    text ct_trn
    char3 functional_currency "AED"
    smallint fiscal_year_start_month
    bool is_qfzp_candidate
  }
  FISCAL_PERIOD {
    uuid id PK
    uuid entity_id FK
    date start_date
    date end_date
    text status "OPEN|SOFT_CLOSED|LOCKED"
    jsonb module_locks
  }
  ACCOUNT {
    uuid id PK
    uuid entity_id FK
    text code
    text name_en
    text name_ar
    text type "ASSET|LIABILITY|EQUITY|INCOME|EXPENSE"
    text subtype "e.g. AR_CONTROL, VAT_OUTPUT"
    uuid parent_id
    bool is_control "no manual posting"
    bool is_active
    text ifrs_line
    text ct_treatment "DEDUCTIBLE|NON_DEDUCTIBLE|PARTIAL_50|EXEMPT_INCOME"
  }
  JOURNAL_ENTRY {
    uuid id PK
    uuid entity_id FK
    bigint entry_no "gapless per entity-year"
    date posting_date
    date document_date
    text source_type "AR_INVOICE|AP_BILL|MANUAL|PAYROLL..."
    uuid source_id
    uuid reverses_id FK
    uuid reversed_by_id
    text status "POSTED"
    text memo
    bytea hash
    timestamptz posted_at
    uuid posted_by
  }
  JOURNAL_LINE {
    uuid id PK
    uuid journal_entry_id FK
    smallint line_no
    uuid account_id FK
    bigint debit_minor
    bigint credit_minor
    char3 txn_currency
    bigint txn_debit_minor
    bigint txn_credit_minor
    text fx_rate "exact rate string, e.g. 3.6725"
    uuid tax_code_id FK
    bigint tax_base_minor
    text vat_emirate
    uuid counterparty_id
    jsonb dimensions
  }
  TAX_CODE {
    uuid id PK
    text code "SR|ZR|EX|OOS|RC_IMP|RC_DOM|RC_SVC|DZ|PMS"
    text treatment
    text vat201_output_box
    text vat201_input_box
    bool input_recoverable
  }
  TAX_RATE_VERSION {
    uuid id PK
    uuid tax_code_id FK
    numeric rate
    date effective_from
    date effective_to
    text legal_source
    bool verify_flag
  }
  VAT_RETURN {
    uuid id PK
    uuid entity_id FK
    date period_start
    date period_end
    text status "DRAFT|REVIEWED|FILED|AMENDED"
    text fta_reference
    timestamptz filed_at
  }
  VAT_RETURN_BOX {
    uuid id PK
    uuid vat_return_id FK
    text box "1a..14"
    bigint amount_minor
    bigint vat_minor
    bigint adjustment_minor
  }
  AUDIT_EVENT {
    bigint seq PK
    uuid tenant_id
    text action
    text entity_type
    uuid entity_id
    jsonb before
    jsonb after
    uuid actor_id
    inet ip
    bytea prev_hash
    bytea hash
    timestamptz at
  }
```

## 6.3 Sales, purchasing, bank, e-invoicing

```mermaid
erDiagram
  COUNTERPARTY ||--o{ SALES_INVOICE : billed
  COUNTERPARTY ||--o{ PURCHASE_BILL : bills
  COUNTERPARTY ||--o{ PDC : "issues/receives"
  COUNTERPARTY }o--o{ RELATED_PARTY_LINK : "related to"
  SALES_ORDER ||--o{ SALES_INVOICE : "invoiced as"
  SALES_INVOICE ||--|{ SALES_INVOICE_LINE : has
  SALES_INVOICE ||--o{ CREDIT_NOTE : "credited by"
  SALES_INVOICE ||--o| EINVOICE_DOCUMENT : "rendered as"
  EINVOICE_DOCUMENT ||--o{ EINVOICE_TRANSMISSION : "sent via ASP"
  PURCHASE_ORDER ||--o{ GOODS_RECEIPT : received
  PURCHASE_ORDER ||--o{ PURCHASE_BILL : matched
  PURCHASE_BILL ||--|{ PURCHASE_BILL_LINE : has
  RECEIPT ||--o{ ALLOCATION : allocates
  ALLOCATION }o--|| SALES_INVOICE : settles
  PDC }o--o| RECEIPT : "clears into"
  BANK_ACCOUNT ||--o{ BANK_STATEMENT_LINE : imports
  BANK_STATEMENT_LINE ||--o{ RECONCILIATION_MATCH : matched
  RECONCILIATION_MATCH }o--|| JOURNAL_LINE : "to ledger"
  ITEM ||--o{ SALES_INVOICE_LINE : sold
  ITEM ||--o{ STOCK_MOVE : moves
  WAREHOUSE ||--o{ STOCK_MOVE : at
  STOCK_MOVE ||--o{ COST_LAYER : "FIFO layers"

  COUNTERPARTY {
    uuid id PK
    text kind "CUSTOMER|VENDOR|BOTH|EMPLOYEE"
    text name_en
    text name_ar
    char15 trn
    text jurisdiction "MAINLAND|FZ|DZ|GCC_IMPL|GCC_NON|OVERSEAS"
    text emirate
    text trade_licence_no
    bigint credit_limit_minor
    bool is_related_party
    bool is_connected_person
    bytea iban_enc "field-level encrypted"
  }
  SALES_INVOICE {
    uuid id PK
    text doc_type "TAX_INVOICE|SIMPLIFIED|COMMERCIAL"
    text number "sequential per series"
    date issue_date
    date supply_date
    char3 currency
    bigint subtotal_minor
    bigint vat_minor
    bigint total_minor
    text status "DRAFT|APPROVED|POSTED|VOID_BY_CN"
    uuid journal_entry_id
    text place_of_supply_emirate
  }
  SALES_INVOICE_LINE {
    uuid id PK
    uuid item_id
    text description_en
    text description_ar
    numeric qty
    bigint unit_price_minor
    bigint discount_minor
    uuid tax_code_id
    bigint net_minor
    bigint vat_minor
  }
  PDC {
    uuid id PK
    text direction "RECEIVED|ISSUED"
    text cheque_no
    text drawer_bank
    date cheque_date
    bigint amount_minor
    text status "HELD|DEPOSITED|CLEARED|BOUNCED|RETURNED|REPLACED"
    uuid deposit_bank_account_id
    text bounce_reason
  }
  EINVOICE_DOCUMENT {
    uuid id PK
    text profile "PINT-AE"
    text ubl_version "2.1"
    text xml_object_key
    bytea xml_sha256
    text validation_status
  }
  EINVOICE_TRANSMISSION {
    uuid id PK
    text asp_code
    text asp_message_id
    text idempotency_key
    text status "QUEUED|SENT|ACCEPTED|REJECTED|REPORTED_TO_FTA"
    jsonb last_response
    int attempts
  }
```

## 6.4 Payroll

```mermaid
erDiagram
  EMPLOYEE ||--|{ EMPLOYMENT_CONTRACT : has
  EMPLOYEE ||--o{ EMPLOYEE_DOCUMENT : "EID/visa/passport"
  EMPLOYEE ||--o{ LEAVE_LEDGER : accrues
  EMPLOYEE ||--o{ GRATUITY_ACCRUAL : accrues
  PAY_RUN ||--|{ PAYSLIP : produces
  PAYSLIP ||--|{ PAYSLIP_LINE : "earnings/deductions"
  PAY_RUN ||--o| WPS_FILE : generates
  PAY_RUN ||--o| JOURNAL_ENTRY : posts

  EMPLOYEE {
    uuid id PK
    text emirates_id_enc
    text mohre_person_code
    text nationality
    bool is_uae_national
    bool is_gcc_national
    text wps_routing_code
    bytea iban_enc
    date joining_date
    text iloe_status
  }
  EMPLOYMENT_CONTRACT {
    uuid id PK
    text contract_type "FULL_TIME|PART_TIME|TEMPORARY|FLEXIBLE"
    date start_date
    date end_date
    bigint basic_minor
    jsonb allowances
  }
  PAY_RUN {
    uuid id PK
    date period_start
    date period_end
    text status "DRAFT|CALCULATED|APPROVED|PAID|POSTED"
    uuid prepared_by
    uuid approved_by
  }
  WPS_FILE {
    uuid id PK
    text employer_mol_id
    text file_name
    text object_key
    bytea sha256
    text bank_ack_status
  }
```

## 6.5 CRM core (Phase 2)

```mermaid
erDiagram
  LEAD ||--o| COUNTERPARTY : "converts to"
  COUNTERPARTY ||--o{ CONTACT : has
  COUNTERPARTY ||--o{ OPPORTUNITY : has
  OPPORTUNITY ||--o{ QUOTE : proposes
  QUOTE ||--o| SALES_ORDER : "accepted as"
  CONTACT ||--o{ CONSENT_RECORD : grants
  CONTACT ||--o{ ACTIVITY : "engaged via"
  COUNTERPARTY ||--o{ TICKET : raises
  COUNTERPARTY ||--o{ KYC_PROFILE : "screened as"
  KYC_PROFILE ||--o{ UBO_PERSON : lists

  CONSENT_RECORD {
    uuid id PK
    text purpose "MARKETING|SERVICE|PROFILING"
    text channel "EMAIL|WHATSAPP|SMS|PHONE"
    text status "GRANTED|WITHDRAWN"
    text source
    timestamptz at
    text evidence_ref
  }
  OPPORTUNITY {
    uuid id PK
    text stage
    bigint amount_minor
    numeric probability
    date expected_close
  }
```

## 6.6 Invariants (enforced in code **and** in the database)

| # | Invariant | Where it is enforced |
|---|---|---|
| I-1 | For each journal entry, Σ debit_minor = Σ credit_minor (functional currency) and > 0 | `@falaj/ledger` `validateEntry`; DB deferred constraint trigger |
| I-2 | When every line of an entry carries the same transaction currency, Σ txn debits = Σ txn credits in it. Mixed-currency entries (e.g. a USD receipt into an AED bank with an FX gain) balance in AED only. | `@falaj/ledger` |
| I-3 | Each line is debit XOR credit, both non-negative | Ledger + DB `CHECK` |
| I-4 | Posted entries/lines never UPDATE or DELETE | DB trigger raising an exception; app role has no UPDATE/DELETE grants on ledger tables |
| I-5 | Posting date must be in an OPEN period (or SOFT_CLOSED with a module permission) | Ledger `PeriodPolicy`; DB check function |
| I-6 | Reversal is a mirrored entry that links both ways; an entry can be reversed at most once | Ledger `reverse()`; unique index on `reverses_id` |
| I-7 | `entry_no` is gapless per entity and fiscal year | Sequence table with row lock in the posting transaction |
| I-8 | Audit-event hash = SHA-256(prev_hash ‖ canonical_json(event)) | `@falaj/ledger` `HashChain`; verified by an auditor export tool |
| I-9 | Control accounts accept postings only from their owning sub-ledger | Ledger `AccountPolicy` |
| I-10 | Every tax-coded line carries tax_code_id, tax_base and, for output VAT, emirate | Ledger + VAT engine validation |
