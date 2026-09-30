# 03 — Feature inventory by phase

> **Updated 1 Oct 2026:** positioning, phasing, verticals and channel are superseded by the **Falaj Company OS Strategy v2**. See [`10-strategy-alignment.md`](10-strategy-alignment.md). The compliance and ledger content below still stands.

> Not legal or tax advice. `VERIFY` = confirm with the named authority. All rates/thresholds/dates are configuration.

Column key: **User** = primary user (OWN owner, FM finance manager/accountant, BK bookkeeper, TA tax agent, AUD auditor, OPS ops user, HR, SLS sales, CUS customer, ADM tenant admin). **Trace** = pain point / control / legal obligation (see `02`, `04`).

---

## Launch Kit — strategy v2 Phase 1 (build first)

Under strategy v2 the "Phase 1 — ERP core" section below is re-phased. Invoicing, VAT, e-invoicing, contacts and the compliance calendar stay in the Launch Kit. The rest of the GL depth, AP, inventory, fixed assets, payroll/WPS and CT move to **Phase 2 · Run**. CRM moves to **Phase 3 · Grow**.

| ID | Feature & description | Journey step | Build / partner | Status | MoSCoW |
|---|---|---|---|---|---|
| F-LK-01 | Licence import via `LicenceSource` (UAE PASS / authority / partner API); validation of authority, expiry, shares, Emirates ID and Arabic name | 1 Sign in | Build + authority partnerships | Built (fixture source) | M |
| F-LK-02 | One company record: company, people, activities, address, vertical, partner attribution, UBO candidates | 1 | Build | Built | M |
| F-LK-03 | Domain suggestions (.ae first) and registration | 2 Domain | Partner (registrar API) | Built (port + fake) | M |
| F-LK-04 | Email tenant, mailbox plan (people + `info@`, `accounts@`), MX/SPF/DMARC/verification DNS | 3 Email | White-label (M365/Google reseller) | Built (port + fake) | M |
| F-LK-05 | Bilingual website generator from licence and brand; licence disclosure; WhatsApp; PDPL notice template | 4 Website | Build | Built | M |
| F-LK-06 | Bank link via a licensed open-finance provider; non-blocking consent | 5 Bank | Licensed partner | Built (port + fake) | M |
| F-LK-07 | Books ready: vertical chart of accounts, fiscal periods (6–18 month first year), ASP onboarding request | 6 Books | Build + ASP partner | Built | M |
| F-LK-08 | Compliance calendar: licence renewal, CT registration and return, VAT registration/returns, e-invoicing ASP/go-live, UBO, WPS | 6 | Build | Built | M |
| F-LK-09 | Resumable, idempotent launch saga with audit trail; licence-to-live metric | 1–7 | Build | Built | M |
| F-LK-10 | Invoicing, VAT, tax-invoice validation, e-invoicing readiness | 7 Go live | Build | Engines built; invoice UI to build | M |
| F-LK-11 | Plans (Launch/Grow/Scale) with module entitlements; prices unset | — | Build | Built (no prices) | M |
| F-LK-12 | Partner attribution and recurring revenue share (rate set by agreement) | — | Build | Schema built | M |
| F-LK-13 | Setup-agent partner portal (activation links, their companies, share statements) | — | Build | To build | M |
| F-LK-14 | Accounting-firm multi-client console | — | Build | To build | S |
| F-LK-15 | Contacts (customers and suppliers) on the shared record | 7 | Build | To build | M |

---

## Phase 1 — ERP core (MVP) · *re-phased: mostly Phase 2 · Run under strategy v2*

### 1.1 Platform foundation (PLT)

| ID | Feature & description | User | UAE-specific requirement | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-PLT-01 | **Tenancy & org model**: tenant → legal entities → branches → warehouses/cost centres. Entity attributes: jurisdiction type (mainland / free zone / designated zone / DIFC / ADGM), emirate, licensing authority, TRN, CT TRN, functional currency (AED default), fiscal year. | ADM | Mainland vs FZ flag drives VAT (designated zone) and CT (QFZP) logic; emirate required for VAT201 box 1a–1g | — | P-18, L-01, L-04 | M |
| F-PLT-02 | **Trade-licence register**: issuing authority (DED/ADDED/free-zone authority), licence no., activities, expiry, alerts at 90/60/30/7 days; document vault. | ADM, OWN | Lookup of 7 emirates and the free-zone authority list | F-PLT-01 | P-10, C-24 | M |
| F-PLT-03 | **Identity & access**: OIDC (email+password with MFA, Microsoft/Google SSO); **UAE PASS** OIDC (S); RBAC roles + ABAC (entity, branch, amount); session/device management. | ADM | UAE PASS integration requires onboarding with TDRA/UAE PASS (VERIFY process) | — | C-20 | M (UAE PASS: S) |
| F-PLT-04 | **Access review campaigns**: quarterly attestation of user roles, auto-disable dormant users. | ADM, OWN | — | F-PLT-03 | C-20 | S |
| F-PLT-05 | **Fiscal calendar & period locks**: periods per entity, soft-close per module (AR/AP/INV/PAY), hard lock, controlled reopen with reason. | FM | CT tax periods may differ from calendar year | F-PLT-01 | C-04 | M |
| F-PLT-06 | **CoA templates per industry** (trading, contracting, prof. services) with IFRS classification mapping, VAT/CT default tags. | FM, BK | CT non-deductible default tags; IFRS for SMEs mapping | F-GL-01 | P-05 | M |
| F-PLT-07 | **Hash-chained audit log**: every create/update/approve/post event, actor, IP, before/after, chained SHA-256 per tenant; verifiable export. | AUD, ADM | Supports FTA audit and ISA 500 evidence | — | C-03, L-06 | M |
| F-PLT-08 | **Retention & legal hold**: retention class per record type (VERIFY FDL 28/2022 + CT law periods), no hard delete of financial records, archiving. | ADM | Retention periods are configuration | F-PLT-07 | C-22, L-07 | M |
| F-PLT-09 | **Privacy toolkit**: processing register, data-subject request workflow (access/correct/erase where lawful), field-level encryption for Emirates ID, passport, IBAN. | ADM | PDPL (FDL 45/2021); DIFC/ADGM regimes for tenants there | — | C-23, L-09 | M |
| F-PLT-10 | **Localisation**: Arabic/English UI with RTL; bilingual documents; Arabic amount-in-words; Hijri display; weekend config (Sat–Sun default); public-holiday calendar; UAE address model (emirate, area, Makani, PO Box); +971 phone, Emirates ID, TRN validators. | All | See `04` §Localisation | — | L-02 | M |
| F-PLT-11 | **Multi-currency & FX rates**: daily rates feed (CBUAE published rates, VERIFY feed availability), USD peg 3.6725 as seeded default, manual override with audit. | FM | AED functional currency; CBUAE rate for VAT conversion of foreign-currency invoices (VERIFY FTA rate rule) | — | L-01 | M |
| F-PLT-12 | **Import/migration toolkit**: opening balances, open AR/AP, stock, assets, employees from CSV/Excel templates with validation; practice-mode bulk onboarding. | BK, FM | — | All P1 masters | — | M |
| F-PLT-13 | **Document storage & attachments** on any record; OCR-ready. | All | UAE-region storage | — | ISA 500 | M |
| F-PLT-14 | **Notifications & tasks**: in-app, email; WhatsApp (Phase 2). | All | — | — | — | S |
| F-PLT-15 | **Practice mode**: accountant firm manages many client tenants with a single login and a portfolio dashboard (VAT due dates, close status). | BK, TA | Tax agent workflow | F-PLT-03 | Go-to-market | S |
| F-PLT-16 | **Public API & webhooks** (read + create for masters/transactions), rate-limited, OAuth client credentials. | Integrators | — | — | — | S |

### 1.2 General ledger (GL)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-GL-01 | **Chart of accounts**: hierarchical, account types (asset/liability/equity/income/expense), control accounts (AR/AP/VAT/inventory) locked from manual posting, IFRS mapping, CT tags. | FM | CT tags | F-PLT-06 | P-05 | M |
| F-GL-02 | **Immutable double-entry journal**: balanced in transaction currency and functional currency, posted journals immutable, correction by reversal only, source-document link on every line. | FM | FTA audit trail | F-GL-01 | C-03 | M |
| F-GL-03 | **Multi-currency postings**: txn currency + AED functional; realised/unrealised FX; period-end revaluation. | FM | — | F-PLT-11 | — | M |
| F-GL-04 | **Dimensions**: cost centre, department, project, branch, emirate, custom (up to 6); required-dimension rules per account. | FM | Emirate dimension feeds VAT201 | F-GL-01 | — | M |
| F-GL-05 | **Accruals, prepayments, recurring & auto-reversing journals**. | FM | — | F-GL-02 | P-16 | M |
| F-GL-06 | **Manual journal approval** above threshold / to sensitive accounts. | FM, OWN | — | F-CTL-02 | C-21 | M |
| F-GL-07 | **Intercompany**: due-to/due-from pairing across entities, mirrored postings. | FM | Related-party tagging for CT/TP | F-PLT-01 | R-17 | S |
| F-GL-08 | **Close checklist**: templated tasks, owners, evidence, sign-off. | FM | — | F-PLT-05 | P-16 | S |
| F-GL-09 | **Drill-down**: every report figure → accounts → journals → source doc. | All | — | — | Rule §8 | M |

### 1.3 Accounts receivable (AR)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-AR-01 | **Customer master**: legal name EN/AR, TRN (15-digit), trade licence, jurisdiction (mainland/FZ/DZ/GCC/overseas), emirate, credit terms/limit, related-party flag. | FM, SLS | TRN validation; place-of-supply inputs | F-PLT-10 | P-11, R-17 | M |
| F-AR-02 | **Quotations & sales orders** with conversion to invoice (no re-keying). | SLS | — | F-AR-01 | P-12 | S |
| F-AR-03 | **Tax invoices / simplified tax invoices / commercial invoices** with mandatory-field validator; bilingual PDF; amount in words (AR); QR code (if mandated — VERIFY). | FM, SLS | VAT Exec. Reg. tax-invoice content (VERIFY article per 2025 amendments) | F-VAT-01 | P-04, L-02 | M |
| F-AR-04 | **Credit control**: limit + overdue check at SO/invoice, override approval. | SLS, FM | — | F-CTL-02 | C-17 | S |
| F-AR-05 | **Credit & debit notes (tax credit notes)** linked to original invoice; VAT adjustment. | FM | Tax credit note rules | F-AR-03 | L-02 | M |
| F-AR-06 | **Receipts & allocation**: cash, card, transfer, cheque; partial/over-payment; unapplied cash. | FM | — | F-BNK-02 | — | M |
| F-AR-07 | **PDC received register**: receive → hold → deposit batch on/after maturity → cleared/bounced; bounce reverses receipt, raises charges, flags customer, attaches bank memo. | FM, Cashier | PDC is endemic; bounced cheque now largely civil (VERIFY Penal Code/Commercial Transactions Law amendments) | F-BNK-02 | P-02, C-06 | M |
| F-AR-08 | **Statements, ageing, dunning**: bilingual statements; ageing buckets; dunning levels via email/WhatsApp (Ph2). | FM | — | F-AR-06 | P-11 | M |
| F-AR-09 | **Advances / deposits received** with VAT on advance (tax point rules). | FM | VAT on advance payments (VERIFY 2025 amendments) | F-VAT-03 | L-01 | S |

### 1.4 Accounts payable (AP)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-AP-01 | **Purchase requisitions** with budget check (budget: Ph3). | OPS | — | — | P-01 | S |
| F-AP-02 | **Vendor master** with dual approval, IBAN validation, TRN validation, bank-detail change control. | FM | IBAN AE format (AE + 21 digits) | F-CTL-02 | C-01 | M |
| F-AP-03 | **Purchase orders** with approval matrix. | OPS, FM | — | F-CTL-02 | C-02 | M |
| F-AP-04 | **GRN / goods receipt** updating inventory. | OPS | — | F-INV-02 | — | M |
| F-AP-05 | **Vendor bills** with 2/3-way match tolerance, bill capture (OCR in Ph4 C). | FM | Supplier tax-invoice validation for input-VAT claim | F-VAT-05 | C-08 | M |
| F-AP-06 | **Import bills**: customs declaration reference, reverse-charge VAT on imports, customs duty to landed cost. | FM | RCM on imports; customs duty (GCC common tariff, 5% general — VERIFY Customs) | F-VAT-04, F-INV-06 | P-03 | M |
| F-AP-07 | **Debit notes / vendor credits**. | FM | — | F-AP-05 | — | M |
| F-AP-08 | **Payment runs**: propose by due date, approve (≠ preparer), export bank file (bank-specific formats), post. | FM, OWN | UAE bank formats (adapter) | F-CTL-01 | C-02 | M |
| F-AP-09 | **PDC issued register**: cheque book mgmt, maturity forecast, clearing. | FM | — | F-BNK-02 | P-02 | M |
| F-AP-10 | **No withholding tax**: explicit guard so no WHT logic is applied to UAE resident payments. UAE CT WHT rate on specified non-resident income is 0% (VERIFY MoF) — modelled as config with rate 0. | — | Prevent false tax logic | — | Brief | M |

### 1.5 Bank & cash (BNK)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-BNK-01 | **Bank accounts** with IBAN mod-97 validation, bank directory (UAE banks, SWIFT/BIC). | FM | AE IBAN | — | C-01 | M |
| F-BNK-02 | **Cash/bank transactions**: receipts, payments, transfers, cash-in-transit, bank charges (VAT on bank fees). | FM | VAT on bank fees is standard-rated for many services | F-GL-02 | — | M |
| F-BNK-03 | **Statement import**: CSV templates per bank, MT940, CAMT.053; later open-finance feeds (Ph4). | FM | — | — | C-05 | M |
| F-BNK-04 | **Auto-reconciliation rules** (reference, amount, date window, counterparty IBAN), suggested matches, one-to-many. | FM | — | F-BNK-03 | C-05 | M |
| F-BNK-05 | **Petty cash** with custodian, float, top-ups, receipt capture. | OPS | — | F-BNK-02 | — | S |
| F-BNK-06 | **Reconciliation sign-off** with unreconciled-item ageing report. | FM | — | F-BNK-04 | C-05 | M |

### 1.6 Inventory (INV)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-INV-01 | **Item master**: goods/services, UoM conversions, HS code, VAT treatment default, designated-goods flag (for domestic RCM e.g. gold/diamonds, electronics — VERIFY FTA lists), excise flag. | OPS | Domestic reverse charge categories | — | P-06 | M |
| F-INV-02 | **Multi-warehouse** incl. designated-zone warehouses; transfers; in-transit. | OPS | Designated-zone movement treatment for VAT | F-PLT-01 | L-01 | M |
| F-INV-03 | **Valuation**: FIFO and weighted average per item/entity (IAS 2). | FM | — | F-GL-02 | C-13 | M |
| F-INV-04 | **Batch/serial & expiry** tracking, FEFO picking. | OPS | Food/pharma verticals | F-INV-02 | — | S |
| F-INV-05 | **Stock counts** (cycle & full), variance approval, adjustment postings. | OPS, FM | ISA 501 attendance support | F-INV-02 | C-13 | M |
| F-INV-06 | **Landed cost**: allocate freight, customs duty, insurance, clearing by value/qty/weight. | FM | Customs duty; import VAT excluded from cost where recoverable | F-AP-06 | P-06 | M |
| F-INV-07 | **Re-order points** and suggestions. | OPS | — | F-INV-02 | — | S |
| F-INV-08 | **Delivery notes** and goods-dispatch. | OPS | — | F-AR-02 | — | M |
| F-INV-09 | **Free-zone / designated-zone movement log** (in/out of zone, customs doc ref). | OPS, TA | VAT designated-zone rules (VERIFY Cabinet Decision on DZ list) | F-INV-02 | L-01 | S |

### 1.7 Fixed assets (FA)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-FA-01 | **Asset register**: class, location, custodian, tag/barcode, cost, useful life, residual. | FM | — | F-GL-01 | C-14 | S |
| F-FA-02 | **Depreciation** (straight-line, declining balance, units) monthly run to GL. | FM | CT: accounting depreciation generally followed (VERIFY) | F-FA-01 | P-07 | S |
| F-FA-03 | **Revaluation** (IAS 16) and impairment. | FM | — | F-FA-02 | — | C |
| F-FA-04 | **Disposal** with gain/loss and VAT on sale. | FM | Capital asset VAT | F-VAT-01 | — | S |
| F-FA-05 | **Capital asset scheme** data for VAT (VERIFY applicability thresholds). | TA | — | F-FA-01 | L-01 | C |

### 1.8 VAT engine (VAT) — FDL 8/2017 + Executive Regulation (as amended, VERIFY 2025 amendments)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-VAT-01 | **Tax codes & treatments**: standard-rated (5%), zero-rated, exempt, out-of-scope, reverse charge (imports, domestic designated goods, imported services), designated-zone, profit-margin scheme. Rates effective-dated in config. | TA, FM | Core | — | L-01 | M |
| F-VAT-02 | **Treatment determination**: item default + customer jurisdiction + place of supply + emirate → suggested code; override requires reason. | FM | Place-of-supply rules (VERIFY articles) | F-VAT-01 | C-07 | M |
| F-VAT-03 | **Tax point / date of supply** handling incl. advances and continuous supplies. | TA | (VERIFY) | F-VAT-01 | L-01 | S |
| F-VAT-04 | **Reverse charge** postings: output + input in the same return; import VAT with customs declaration reference. | FM | Box 3 and Box 6/10 of VAT201 | F-VAT-01 | P-03 | M |
| F-VAT-05 | **Input-VAT recoverability**: blocked categories (e.g. entertainment, certain motor vehicles), partial exemption apportionment. | TA | (VERIFY FTA) | F-VAT-01 | C-08 | M (blocked) / S (apportionment) |
| F-VAT-06 | **Rounding**: per-line calculation, AED fils (2 dp) half-up; invoice-level reconciliation difference ≤ 1 fils per line. | FM | FTA accepts line or invoice rounding if consistent (VERIFY) | — | — | M |
| F-VAT-07 | **VAT201 return** preparation from ledger: boxes 1a–1g by emirate, 2 tourist refund (C), 3 RCM, 4 zero-rated, 5 exempt, 6 imports, 7 adjustments to imports, 8 totals, 9 standard-rated expenses, 10 RCM input, 11 totals, 12–14 net. Drill-down per box. | TA | Box structure (VERIFY current EmaraTax form) | F-VAT-01…05 | P-03 | M |
| F-VAT-08 | **FTA Audit File (FAF)** export (VERIFY current FAF spec). | TA, AUD | — | F-VAT-07 | L-01 | S |
| F-VAT-09 | **Voluntary disclosure support**: difference analysis between filed return and current ledger for the period. | TA | Penalty exposure calculator (VERIFY Cabinet Decision on penalties) | F-VAT-07 | L-06 | S |
| F-VAT-10 | **Profit-margin scheme** for second-hand goods. | FM | Specific VAT treatment | F-VAT-01 | — | C |
| F-VAT-11 | **VAT groups** (multiple TRNs under one tax group). | TA | — | F-PLT-01 | — | C |

### 1.9 Corporate Tax engine (CT) — FDL 47/2022

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-CT-01 | **CT registration data & tax periods** per entity. | TA | — | F-PLT-01 | L-04 | M |
| F-CT-02 | **Taxable-income working paper**: accounting profit → adjustments (non-deductible entertainment 50%, fines/penalties, donations to non-qualifying bodies, etc. — list VERIFY MoF), exempt income (qualifying dividends, participation exemption — VERIFY), tax-loss relief (75% cap, VERIFY), each adjustment drills to journals. | TA | 0% up to AED 375,000; 9% above (config) | F-GL-01 tags | P-05, C-10 | M |
| F-CT-03 | **Small Business Relief monitor**: revenue per tax period vs AED 3m (config); eligible tax periods ending on or before the configured end date (brief states extended to 31 Dec 2029 by MD 131/2026 — **VERIFY MoF**); breach flag stops future eligibility. | TA, OWN | SBR | F-CT-01 | C-12 | M |
| F-CT-04 | **Related-party / connected-person register** and transaction report; TP disclosure data (thresholds VERIFY). | TA | Arm's length; disclosure form data | F-AR-01, F-AP-02 | P-05, C-18 | M |
| F-CT-05 | **QFZP module**: revenue classified qualifying / excluded / non-qualifying; de-minimis monitor (lower of 5% revenue or AED 5m — VERIFY); substance checklist. | TA | Free-zone entities | F-PLT-01, F-VAT-02 | P-18, C-11 | S |
| F-CT-06 | **Interest capping**: net interest expense vs 30% of tax-EBITDA, de minimis AED 12m (VERIFY). | TA | — | F-CT-02 | — | C |
| F-CT-07 | **Tax groups** consolidation of working papers. | TA | — | F-GL-07 | — | C |
| F-CT-08 | **Deferred tax** (IAS 12) schedule. | FM | — | F-CT-02 | — | C |

### 1.10 E-invoicing (EINV) — MD 243 & 244/2025 (VERIFY amendments)

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-EINV-01 | **PINT-AE UBL 2.1 XML generation** for invoices and credit notes (B2B/B2G), validated against the official schematron/validation artefacts. | FM | PINT-AE spec (VERIFY latest version from MoF/FTA) | F-AR-03 | P-17 | M |
| F-EINV-02 | **ASP adapter interface** with ≥2 ASP implementations; participant ID (TRN-based endpoint, VERIFY). | ADM | 5-corner Peppol model | F-EINV-01 | L-08 | M |
| F-EINV-03 | **Submission workflow**: outbox → ASP → acknowledgement → FTA reporting status; retries with idempotency; rejection queue. | FM | — | F-EINV-02 | C-09 | M |
| F-EINV-04 | **Inbound e-invoices** from suppliers via ASP → draft vendor bill. | FM | — | F-EINV-02, F-AP-05 | P-17 | M |
| F-EINV-05 | **Status dashboard & SLA alerts** (e.g. transmission deadlines — VERIFY). | FM | Penalties (Cabinet Decision 106/2025 — VERIFY) | F-EINV-03 | C-09 | M |
| F-EINV-06 | **Readiness calendar**: tenant's mandate date computed from revenue band (≥ AED 50m: 1 Jan 2027; < AED 50m: ASP appointment by 31 Mar 2027, go-live 1 Jul 2027; government 1 Oct 2027 — all VERIFY, all config). | OWN, TA | Timelines amended before | F-PLT-01 | L-08 | M |

### 1.11 Payroll & HR basics (PAY) — FDL 33/2021

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-PAY-01 | **Employee master**: Emirates ID (784-YYYY-NNNNNNN-C validation), passport, visa, labour card/MOHRE person code, nationality, contract type (full-time, part-time, temporary, flexible — VERIFY), basic vs allowances, bank IBAN / exchange-house routing, WPS agent. | HR | Emirates ID/visa | F-PLT-09 | C-15 | M |
| F-PAY-02 | **Document-expiry alerts** (visa, EID, passport, labour card, medical insurance). | HR | — | F-PAY-01 | P-10 | M |
| F-PAY-03 | **Leave accrual** per labour law (annual leave: 2 days/month after 6 months up to 1 yr, 30 days/yr thereafter — VERIFY Art. 29), sick, maternity, parental; weekend/holiday aware. | HR | Labour law | F-PLT-10 | — | M |
| F-PAY-04 | **End-of-service gratuity**: 21 days' basic wage per year for first 5 years, 30 days per year thereafter, capped at 2 years' wage, pro-rata part years, ≥1 year service (VERIFY Art. 51); monthly accrual to GL; DEWS / alternative savings scheme support (VERIFY). | HR, FM | Gratuity | F-PAY-01 | C-16 | M |
| F-PAY-05 | **Pay run**: earnings, deductions (with legal limits on deductions — VERIFY), overtime (25%/50% premiums — VERIFY Art. 19), unpaid leave, loans/advances; approval ≠ preparer; GL posting. | HR, FM | — | F-PAY-01 | C-15 | M |
| F-PAY-06 | **WPS SIF file** (EDR + SCR records) per employer/agent (VERIFY current CBUAE WPS spec and agent variations). | HR, FM | WPS | F-PAY-05 | L-10 | M |
| F-PAY-07 | **GPSSA contributions** for UAE nationals; GCC nationals per home-country scheme (rates are config — VERIFY GPSSA / FDL 57/2023). | HR | Pensions | F-PAY-05 | L-10 | M |
| F-PAY-08 | **ILOE** (unemployment insurance) subscription tracking per employee. | HR | ILOE | F-PAY-01 | L-10 | S |
| F-PAY-09 | **Emiratisation (Nafis) tracker**: headcount ratio vs target, per company size band (VERIFY MOHRE targets). | HR, OWN | Emiratisation quotas | F-PAY-01 | L-10 | S |
| F-PAY-10 | **Payslips** bilingual, employee self-service (C). | HR | — | F-PAY-05 | — | S |

### 1.12 Controls (CTL) — Phase 1 basic subset

| ID | Feature & description | User | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|
| F-CTL-01 | **SoD rules (basic)**: preparer ≠ approver for payments, vendor master, manual journals, pay runs. | ADM | F-PLT-03 | C-01, C-02 | M |
| F-CTL-02 | **Approval matrix (basic)**: by document type, amount band, entity. | OWN | F-PLT-03 | C-02 | M |

### 1.13 Reporting (RPT)

| ID | Feature & description | User | UAE-specific | MoSCoW |
|---|---|---|---|---|
| F-RPT-01 | Trial balance (by period, dimension, comparative) with drill-down | FM | — | M |
| F-RPT-02 | P&L, balance sheet, cash flow (indirect) | FM, OWN | IFRS presentation | M |
| F-RPT-03 | IFRS-format financial statements pack (bilingual) with notes data (C for notes authoring) | FM, AUD | IFRS for SMEs option | S |
| F-RPT-04 | Management pack & KPI dashboard (cash, DSO, DPO, gross margin, VAT position) | OWN | — | S |
| F-RPT-05 | VAT reports (VAT201, transaction listing by box), CT reports (working paper) | TA | — | M |
| F-RPT-06 | Related-party transaction report (IAS 24) | FM, TA | — | S |
| F-RPT-07 | Report export (XLSX, PDF, CSV) | All | — | M |

---

## Phase 2 — CRM · *Phase 3 · Grow under strategy v2*

| ID | Feature & description | User | UAE-specific | Depends on | Trace | MoSCoW |
|---|---|---|---|---|---|---|
| F-CRM-01 | Leads (capture from web form, WhatsApp, import), dedupe, qualification, conversion | SLS | — | — | P-12 | M |
| F-CRM-02 | Accounts & contacts (shared with ERP customer master — single record) | SLS | Bilingual names | F-AR-01 | — | M |
| F-CRM-03 | Opportunities, pipeline stages, weighted forecast | SLS | — | F-CRM-02 | — | M |
| F-CRM-04 | Customer 360: live AR balance, credit limit, PDCs, invoices, disputes, tickets | SLS, FM | PDC visibility | F-AR-* | P-11 | M |
| F-CRM-05 | CPQ: price lists, discount rules with approval, quote → SO → invoice | SLS | VAT-inclusive/exclusive display | F-AR-02, F-CTL-02 | P-12 | M |
| F-CRM-06 | Customer KYC fields (trade licence, TRN, UBO) feeding screening (Ph4) | SLS, FM | AML/CFT DNFBP tenants | F-AR-01 | P-13, L-11 | S |
| F-CRM-07 | Activities, tasks, meetings, calendar sync | SLS | — | — | — | M |
| F-CRM-08 | Email and **WhatsApp Business API** (via BSP) — templates, opt-in, conversation log, click-to-call | SLS | WhatsApp is dominant channel; consent rules | F-CRM-09 | — | M |
| F-CRM-09 | Consent ledger (purpose, channel, timestamp, source, withdrawal) | SLS, ADM | PDPL; DIFC/ADGM where applicable | F-PLT-09 | P-19, L-09 | M |
| F-CRM-10 | Service desk: tickets, SLAs, escalations, linkage to invoices/credit notes | CUS, OPS | — | F-CRM-02 | — | S |
| F-CRM-11 | Customer portal: view/download invoices & statements, raise disputes, pay (via Ph4 payments) | CUS | Consumer-protection disclosures for B2C tenants | F-AR-* | — | S |
| F-CRM-12 | Marketing: segments, campaigns (email/WhatsApp), attribution | SLS | Opt-in required | F-CRM-09 | — | C |
| F-CRM-13 | Sales commission calculation → payroll earnings / GL accrual | SLS, HR | — | F-PAY-05 | — | S |

---

## Phase 3 — Enterprise operations & finance

| ID | Feature & description | User | UAE-specific | Depends on | MoSCoW |
|---|---|---|---|---|---|
| F-FPA-01 | Budgeting by account × dimension × period; versions; approvals | FM, OWN | — | F-GL-04 | M |
| F-FPA-02 | Rolling forecasts; driver-based planning (headcount, volume × price) | FM | — | F-FPA-01 | S |
| F-FPA-03 | Scenario modelling (base/best/worst) incl. tax effects | FM | CT at configured rate | F-FPA-01 | S |
| F-FPA-04 | Variance analysis with commentary workflow | FM | — | F-FPA-01 | M |
| F-FPA-05 | Budget check on PR/PO | OPS | — | F-AP-01 | S |
| F-TRS-01 | 13-week cash forecast (AR/AP due, PDCs, payroll, VAT/CT due, facility repayments) | FM, OWN | PDC maturities, VAT due dates | F-BNK-* | M |
| F-TRS-02 | Bank-position dashboard (multi-bank, multi-currency) | OWN | — | F-BNK-03 | M |
| F-TRS-03 | FX exposure report | FM | USD peg awareness | F-PLT-11 | S |
| F-TRS-04 | Loans & facilities (term, OD, trust receipts), schedules, covenant tests | FM | Trust receipts common in trading | F-GL-02 | M |
| F-TRS-05 | **LC/LG register**: LC issuance/amendment/utilisation/margin; bank guarantees (bid, performance, advance payment) with expiry & claim tracking; commission accruals | FM | Core for trading & contracting | F-TRS-04 | M |
| F-CON-01 | Consolidation: group structure, ownership %, FX translation (IAS 21), intercompany eliminations, NCI | FM | Mainland + FZ groups | F-GL-07 | M |
| F-PRJ-01 | Projects/jobs with WBS, budgets, cost capture from AP/payroll/inventory | FM, OPS | — | F-GL-04 | M |
| F-PRJ-02 | Progress billing (% complete, milestones, BOQ), payment certificates | FM | Contracting norms | F-PRJ-01 | M |
| F-PRJ-03 | Retention receivable/payable with release tracking | FM | — | F-PRJ-02 | M |
| F-PRJ-04 | Variations/change orders with approval | OPS | — | F-PRJ-01 | M |
| F-PRJ-05 | Subcontractor management: agreements, certificates, retention, back-charges | OPS, FM | — | F-PRJ-03 | M |
| F-PRJ-06 | IFRS 15 over-time revenue (input/output methods), contract assets/liabilities | FM, AUD | — | F-PRJ-02 | M |
| F-PRJ-07 | Timesheets & resource costing (professional services) | OPS | — | F-PAY-01 | S |
| F-CTL-03 | SoD matrix enforcement (full): conflict library, simulations, mitigation approvals | ADM, AUD | — | F-CTL-01 | M |
| F-CTL-04 | Advanced approval workflows (amount/role/entity/dimension, delegation, escalation) | OWN | — | F-CTL-02 | M |
| F-CTL-05 | Continuous controls monitoring & exception dashboard | FM, AUD | — | F-PLT-07 | S |
| F-AUD-01 | Auditor workspace (read-only role, time-boxed access) | AUD | — | F-PLT-03 | M |
| F-AUD-02 | PBC request list with status and evidence upload | AUD, FM | — | F-AUD-01 | M |
| F-AUD-03 | Evidence attachments per transaction; bulk export | AUD | — | F-PLT-13 | M |
| F-AUD-04 | Audit-trail export with hash-chain verification | AUD | — | F-PLT-07 | M |
| F-AUD-05 | Sampling support (MUS, random, stratified) | AUD | — | F-AUD-01 | S |
| F-GOV-01 | UBO register (Cabinet Decision 109/2023 — VERIFY; free-zone equivalents) with change log | OWN | UBO | F-PLT-01 | M |
| F-GOV-02 | Shareholder/partner register, share movements | OWN | CCL (FDL 32/2021) | F-GOV-01 | S |
| F-GOV-03 | Board/partner meeting minutes & resolutions | OWN | — | F-DOC-01 | C |
| F-GOV-04 | Compliance calendar (licence, VAT, CT, ESR if applicable, UBO, audit deadlines) | OWN | — | F-PLT-02 | M |
| F-DOC-01 | Document management with versioning | All | — | F-PLT-13 | S |
| F-DOC-02 | E-signature incl. **UAE PASS digital signature** (FDL 46/2021 — trust services) | OWN | UAE PASS signing onboarding (VERIFY TDRA) | F-DOC-01 | S |

---

## Phase 4 — Fintech layer (partner-delivered only)

See `05-fintech-licensing-map.md` for the licence each would trigger if done in-house.

| ID | Feature & description | User | Partner type | MoSCoW |
|---|---|---|---|---|
| F-PAYM-01 | Payment links on invoices (card, Apple/Google Pay) with auto-reconciliation to AR | FM, CUS | Licensed PSP / acquirer | M |
| F-PAYM-02 | **Aani** instant payments (request-to-pay / QR) via participating bank or PSP | FM, CUS | Bank / PSP (VERIFY Al Etihad Payments participation model) | S |
| F-PAYM-03 | Direct debit mandates (UAEDDS) for recurring collections | FM | Sponsoring bank | C |
| F-PAYM-04 | Vendor payouts initiated from approved payment runs | FM | Bank API / open-finance PISP | M |
| F-OF-01 | Bank-account aggregation (AIS) under CBUAE Open Finance framework | FM | Licensed open-finance provider (VERIFY Open Finance Regulation) | M |
| F-OF-02 | Payment initiation (PIS) | FM | Licensed provider | S |
| F-FIN-01 | Credit-scoring data package from ledger (consented) | OWN | Bank / finance company | S |
| F-FIN-02 | Invoice financing / factoring marketplace | OWN | Banks, finance companies | S |
| F-FIN-03 | Dynamic discounting / supply-chain finance for buyers | FM | Bank SCF programme | C |
| F-SPD-01 | Corporate cards issued by a licensed issuer; card feed to AP | OPS | Issuer / BIN sponsor | C |
| F-SPD-02 | Expense capture with OCR (Arabic + English receipts), policy rules | OPS | OCR vendor | S |
| F-CSH-01 | Virtual IBANs per customer for collection matching | FM | Partner bank | S |
| F-KYC-01 | KYB/KYC onboarding (Emirates ID, trade licence, UAE PASS) | ADM | KYC provider | M |
| F-KYC-02 | Sanctions & PEP screening (UAE Local Terrorist List, UN Consolidated List) with ongoing monitoring | ADM, FM | Screening provider | M |
| F-KYC-03 | Transaction monitoring rules; goAML-ready STR/SAR data export for DNFBP tenants | FM | — | S |

---

## Cross-cutting AI features (optional, never auto-post)

| ID | Feature | MoSCoW | Phase |
|---|---|---|---|
| F-AI-01 | Transaction/bank-line categorisation suggestions (human confirms) | S | 1–2 |
| F-AI-02 | Receipt & bill OCR (AR/EN) → draft bill | S | 2–4 |
| F-AI-03 | Journal anomaly detection (Benford, weekend, round sums, back-dating) → exceptions | C | 3 |
| F-AI-04 | Natural-language reporting ("VAT payable by emirate last quarter") with cited drill-down | C | 3 |
