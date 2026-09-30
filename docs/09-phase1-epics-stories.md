# 09 — Phase 1 epics & user stories (Gherkin)

> **Updated 1 Oct 2026:** positioning, phasing, verticals and channel are superseded by the **Falaj Company OS Strategy v2**. See [`10-strategy-alignment.md`](10-strategy-alignment.md). The compliance and ledger content below still stands.

> Worked numbers use AED. Where a scenario depends on a legal rule marked VERIFY, the numbers come from the rule **as configured**. The scenario stays valid when the configured value changes, as long as the expected value is recomputed.

## Epic index

| Epic | Name | Features | Milestone |
|---|---|---|---|
| E-01 | Platform foundation & tenancy | F-PLT-01…09, 11…13 | M1.1 |
| E-02 | Immutable general ledger | F-GL-01…06, 09 | M1.1 |
| E-03 | VAT engine & VAT201 | F-VAT-01…07 | M1.1 |
| E-04 | Accounts receivable & PDC | F-AR-01…08 | M1.2 |
| E-05 | Accounts payable & payment runs | F-AP-02…10 | M1.2 |
| E-06 | Bank & reconciliation | F-BNK-01…06 | M1.2 |
| E-07 | E-invoicing (PINT-AE / ASP) | F-EINV-01…06 | M1.3 |
| E-08 | Inventory & landed cost | F-INV-01…08 | M1.4 |
| E-09 | Payroll, WPS & gratuity | F-PAY-01…07 | M1.4 |
| E-10 | Corporate Tax working papers | F-CT-01…04 | M1.4 |
| E-11 | Financial reporting | F-RPT-01…07 | M1.1–M1.4 |
| E-12 | Localisation (AR/EN, RTL, UAE formats) | F-PLT-10 | M1.1 |

---

## E-01 Platform foundation & tenancy

**US-01.1** As a tenant admin, I want to register legal entities with their jurisdiction type and emirate, so that tax logic is applied correctly.

```gherkin
Feature: Legal entity registration

  Scenario: Register a free-zone entity
    Given I am a tenant admin of tenant "Acme Group"
    When I create a legal entity with
      | legal_name_en       | Acme Trading FZ-LLC |
      | legal_name_ar       | أكمي للتجارة م.م.ح   |
      | jurisdiction_type   | FREE_ZONE           |
      | emirate             | DXB                 |
      | licensing_authority | DMCC                |
      | vat_trn             | 100123456700003     |
    Then the entity is saved with functional currency "AED"
    And the entity is flagged as a QFZP candidate for Corporate Tax review

  Scenario: Reject an invalid TRN
    When I create a legal entity with vat_trn "12345"
    Then I see the error "TRN must be exactly 15 digits"
    And no entity is created
```

**US-01.2** As a tenant admin, I want users of one tenant to be unable to see another tenant's data, even if the application has a bug.

```gherkin
Feature: Tenant isolation

  Scenario: Row-level security blocks cross-tenant reads
    Given tenants "A" and "B" each have journal entries
    And a database session with app.tenant_id set to tenant "A"
    When the session runs "select * from journal_entries" with no WHERE clause
    Then only tenant "A" rows are returned

  Scenario: Missing tenant context returns nothing
    Given a database session with no app.tenant_id set
    When the session selects from any tenant-scoped table
    Then zero rows are returned
```

**US-01.3** As a financial controller, I want to lock periods, so that nobody can post into a closed month.

```gherkin
Feature: Period locking

  Scenario: Posting into a locked period is rejected
    Given period "2027-01" for entity "Acme Trading FZ-LLC" is LOCKED
    When an accountant posts a journal dated 2027-01-31
    Then the posting is rejected with "PERIOD_LOCKED"

  Scenario: Reopening requires a permission and a reason
    Given period "2027-01" is LOCKED
    When a user without "period.reopen" tries to reopen it
    Then the action is denied
    When a controller reopens it with reason "Auditor adjustment AJE-3"
    Then the period status is OPEN
    And an audit event "period.reopened" records the reason and actor
```

**US-01.4** As an auditor, I want a tamper-evident audit trail, so that I can rely on system records.

```gherkin
Feature: Hash-chained audit log

  Scenario: Chain verifies when untouched
    Given 1,000 audit events were written for tenant "A"
    When I run the chain verification export
    Then the result is "VALID" and the head hash is displayed

  Scenario: Tampering is detected
    Given audit event #500 was modified directly in storage
    When I run the chain verification export
    Then the result is "BROKEN at sequence 500"
```

**US-01.5** As an owner, I want trade-licence expiry alerts, so that I renew on time.

```gherkin
Feature: Licence expiry alerts
  Scenario Outline: Alert thresholds
    Given a trade licence expiring on 2027-06-30
    When the date is <today>
    Then an alert of level <level> exists
    Examples:
      | today      | level |
      | 2027-04-01 | 90d   |
      | 2027-05-31 | 30d   |
      | 2027-06-23 | 7d    |
```

---

## E-02 Immutable general ledger

**US-02.1** As an accountant, I want the system to accept only balanced journals.

```gherkin
Feature: Balanced postings

  Scenario: Balanced entry posts
    Given account "1100 Bank" and "4000 Sales" exist and are active
    When I post a journal on 2027-02-10
      | account    | debit    | credit   |
      | 1100 Bank  | 1,050.00 |          |
      | 4000 Sales |          | 1,000.00 |
      | 2200 VAT   |          |    50.00 |
    Then the entry is POSTED with the next gapless entry number

  Scenario: Unbalanced entry is rejected
    When I post a journal with debits 1,050.00 and credits 1,049.99
    Then the posting is rejected with "UNBALANCED" showing a difference of 0.01

  Scenario: A line with both debit and credit is rejected
    When I post a line with debit 10.00 and credit 10.00
    Then the posting is rejected with "LINE_BOTH_SIDES"

  Scenario: Manual posting to a control account is rejected
    Given "1200 Accounts Receivable" is a control account owned by AR
    When I post a manual journal to "1200 Accounts Receivable"
    Then the posting is rejected with "CONTROL_ACCOUNT"
```

**US-02.2** As an auditor, I want posted entries to be immutable, with corrections made by reversal only.

```gherkin
Feature: Reversal-only corrections

  Scenario: Posted entries cannot be edited
    Given journal JE-2027-000123 is POSTED
    When any user attempts to change its amount or date
    Then the change is refused with "IMMUTABLE"
    And a direct SQL UPDATE by the application role raises an error

  Scenario: Reversal mirrors the original
    Given journal JE-2027-000123 debits Bank 500.00 and credits Sales 500.00
    When I reverse it on 2027-02-15 with reason "Duplicate"
    Then a new entry debits Sales 500.00 and credits Bank 500.00
    And the new entry references JE-2027-000123 as reversed
    And JE-2027-000123 shows "reversed by" the new entry
    When I try to reverse JE-2027-000123 again
    Then the action is refused with "ALREADY_REVERSED"
```

**US-02.3** As an accountant, I want foreign-currency journals converted to AED at the entry rate, so that the functional ledger balances.

```gherkin
Feature: Multi-currency posting
  Scenario: USD invoice at the peg
    Given the USD→AED rate for 2027-03-01 is 3.6725
    When I post a USD 1,000.00 receivable against USD 1,000.00 revenue
    Then both lines carry AED 3,672.50 in functional currency
    And the entry balances in USD and in AED
```

**US-02.4** As a finance manager, I want every report figure to drill down to journals and source documents.

```gherkin
Feature: Drill-down
  Scenario: From trial balance to source invoice
    Given the trial balance shows "4000 Sales" credit 250,000.00 for Q1 2027
    When I open the balance
    Then I see the journal lines that sum to 250,000.00
    And each line links to its source document
```

---

## E-03 VAT engine & VAT201

**US-03.1** As an accountant, I want VAT calculated per line with consistent fils rounding.

```gherkin
Feature: VAT line calculation (rate from config: standard 5%)

  Scenario Outline: Standard-rated lines
    Given a tax-exclusive line with quantity <qty> and unit price <price>
    And tax code "SR"
    Then the net is <net> and VAT is <vat>
    Examples:
      | qty | price  | net      | vat   |
      | 1   | 1000.00| 1,000.00 | 50.00 |
      | 3   | 33.33  | 99.99    | 5.00  |
      | 1   | 0.10   | 0.10     | 0.01  |
      | 7   | 14.29  | 100.03   | 5.00  |

  Scenario: Tax-inclusive price is split correctly
    Given a tax-inclusive line total of 105.00 with tax code "SR"
    Then the net is 100.00 and VAT is 5.00

  Scenario Outline: Non-standard treatments
    Given a line of 1,000.00 with tax code "<code>"
    Then VAT is <vat> and the line is reported in VAT201 box <box>
    Examples:
      | code | vat  | box |
      | ZR   | 0.00 | 4   |
      | EX   | 0.00 | 5   |
      | OOS  | 0.00 | —   |
```

**US-03.2** As an accountant, I want reverse charge on imported services, so that output and input VAT are both declared.

```gherkin
Feature: Reverse charge on imported services
  Scenario: Overseas consultancy
    Given a vendor bill from an overseas supplier for 20,000.00 with tax code "RC_SVC"
    And the entity is fully taxable
    When I post the bill
    Then output VAT 1,000.00 is reported in box 3
    And recoverable input VAT 1,000.00 is reported in box 10
    And the net VAT effect is 0.00
```

**US-03.3** As a tax agent, I want a VAT201 built from the ledger with a drill-down per box.

```gherkin
Feature: VAT201 preparation

  Background:
    Given entity "Acme Trading FZ-LLC" with quarterly period 2027-01-01 to 2027-03-31

  Scenario: Output VAT split by emirate
    Given posted standard-rated sales of
      | emirate | net       | vat      |
      | DXB     | 400,000.00| 20,000.00|
      | AUH     | 100,000.00|  5,000.00|
    When I generate the VAT201
    Then box 1b (Dubai) shows amount 400,000.00 and VAT 20,000.00
    And box 1a (Abu Dhabi) shows amount 100,000.00 and VAT 5,000.00
    And box 8 shows VAT 25,000.00

  Scenario: Net payable
    Given total output VAT (box 8) of 25,000.00
    And recoverable input VAT (box 11) of 9,500.00
    When I generate the VAT201
    Then box 14 (payable tax) shows 15,500.00

  Scenario: Blocked input VAT is excluded
    Given a bill for staff entertainment with VAT 250.00 and tax code "SR" and expense category "ENTERTAINMENT"
    When I generate the VAT201
    Then the 250.00 is not included in box 9
    And the bill appears on the "blocked input VAT" report

  Scenario: Box drill-down
    When I open box 1b
    Then I see every journal line that contributes, with the source document
```

**US-03.4** As an accountant, I want tax-invoice mandatory fields validated before posting.

```gherkin
Feature: Tax invoice validator
  Scenario: Registered customer without TRN
    Given a B2B tax invoice to a VAT-registered customer with no TRN recorded
    When I try to post it
    Then posting is blocked with "RECIPIENT_TRN_REQUIRED"

  Scenario: Complete invoice passes
    Given a tax invoice with all mandatory particulars
    Then the validator result is "PASS" and it is stored with the invoice
```

---

## E-04 Accounts receivable & PDC

```gherkin
Feature: PDC received lifecycle

  Scenario: Receive and hold a PDC
    Given customer "Gulf Builders LLC" owes invoice INV-1001 of 52,500.00
    When I record PDC #004512 dated 2027-04-30 for 52,500.00 drawn on "Emirates NBD"
    Then the PDC status is HELD
    And the invoice shows 52,500.00 "covered by PDC" but still unpaid
    And the cash forecast shows 52,500.00 expected on 2027-04-30

  Scenario: Deposit on maturity
    Given PDC #004512 is HELD with cheque date 2027-04-30
    When I try to deposit it on 2027-04-20
    Then I am warned "Cheque not yet due"
    When I deposit it on 2027-04-30 into "ADCB Current"
    Then the PDC status is DEPOSITED and a cheques-in-transit entry is posted

  Scenario: Bounced cheque
    Given PDC #004512 is DEPOSITED
    When I mark it BOUNCED with reason "Insufficient funds" and bank charge 50.00
    Then the receipt is reversed and INV-1001 is open again
    And a bank charge of 50.00 is posted
    And customer "Gulf Builders LLC" is placed on credit hold
    And an alert is sent to the credit controller
```

```gherkin
Feature: Credit control
  Scenario: Order over credit limit needs approval
    Given customer credit limit 100,000.00 and open balance 90,000.00
    When a salesperson creates an invoice for 15,000.00
    Then the invoice goes to status PENDING_CREDIT_APPROVAL
```

---

## E-05 Accounts payable & payment runs

```gherkin
Feature: Vendor bank-detail change control
  Scenario: IBAN change requires a second approver
    Given vendor "Alpha Supplies" with IBAN AE070331234567890123456
    When user "u1" changes the IBAN to AE520260001015049611101
    Then the vendor is PENDING_APPROVAL and cannot be paid
    When user "u1" tries to approve the change
    Then approval is refused with "SOD_VIOLATION"
    When user "u2" approves with call-back note "Confirmed with CFO by phone"
    Then the new IBAN is active

Feature: Payment run segregation of duties
  Scenario: Preparer cannot approve
    Given user "u1" prepared payment run PR-2027-014
    When "u1" approves it
    Then approval is refused with "SOD_VIOLATION"

Feature: 3-way match
  Scenario: Price variance above tolerance
    Given PO 100 units at 10.00 and GRN 100 units
    And tolerance 2%
    When a bill arrives for 100 units at 10.50
    Then the bill is blocked with "PRICE_VARIANCE 5.00%"

Feature: No withholding tax
  Scenario: Paying a UAE resident vendor
    When I pay a UAE resident vendor 10,000.00
    Then no withholding tax is calculated
```

---

## E-06 Bank & reconciliation

```gherkin
Feature: Statement import and auto-match
  Scenario: Import CAMT.053 and match by reference
    Given open receipt RCPT-88 for 12,600.00 referencing "INV-1044"
    When I import a CAMT.053 statement with a credit of 12,600.00 and remittance "INV-1044"
    Then the line is auto-matched to RCPT-88 with rule "reference+amount"

  Scenario: Invalid IBAN is rejected
    When I create a bank account with IBAN "AE070331234567890123457"
    Then I see "IBAN checksum invalid"
```

---

## E-07 E-invoicing (PINT-AE / ASP)

```gherkin
Feature: E-invoice generation and transmission

  Scenario: Posted invoice generates valid PINT-AE XML
    Given a posted B2B tax invoice INV-2001 to a registered UAE customer
    When the e-invoice workflow runs
    Then a UBL 2.1 PINT-AE XML is generated
    And it passes the configured validation artefacts
    And its SHA-256 is stored and the file is written to object-locked storage

  Scenario: ASP outage is retried idempotently
    Given the ASP returns HTTP 503 for the first 2 attempts
    When the workflow submits INV-2001
    Then it retries with backoff using the same idempotency key
    And exactly one transmission is ACCEPTED

  Scenario: Rejection goes to the queue
    When the ASP rejects INV-2001 with code "BR-AE-xx"
    Then INV-2001 appears in the rejection queue with the ASP message
    And the correction flow requires a credit note plus a new invoice (no edit)

  Scenario: Mandate date is computed from configuration
    Given the tenant's prior-year revenue is AED 38,000,000
    And the configured timeline for "< 50m" is ASP appointment 2027-03-31 and go-live 2027-07-01
    Then the readiness calendar shows those two dates
```

---

## E-08 Inventory & landed cost

```gherkin
Feature: FIFO valuation
  Scenario: Issue consumes the oldest layer first
    Given receipts of 10 units at 100.00 then 10 units at 120.00
    When 15 units are issued
    Then COGS is 1,600.00
    And remaining stock is 5 units valued at 600.00

Feature: Landed cost
  Scenario: Allocate freight and duty by value
    Given a receipt of item A 6,000.00 and item B 4,000.00
    When I allocate freight 500.00 and customs duty 500.00 by value
    Then item A cost increases by 600.00 and item B by 400.00
    And import VAT is not added to inventory cost
```

---

## E-09 Payroll, WPS & gratuity

```gherkin
Feature: End-of-service gratuity (formula from config; VERIFY Art. 51 FDL 33/2021)

  Scenario Outline: Gratuity by service length
    Given an employee with basic monthly wage <basic> and continuous service <years> years
    When gratuity is calculated
    Then gratuity is <gratuity>
    Examples:
      | basic     | years | gratuity   |
      | 10,000.00 | 0.9   | 0.00       |
      | 10,000.00 | 3     | 21,000.00  |
      | 10,000.00 | 7     | 55,000.00  |
      | 10,000.00 | 30    | 240,000.00 |
    # 7 years: (5×21 + 2×30) days × 10,000/30 = 165 × 333.33… = 55,000.00
    # 30 years: uncapped 855 days = 285,000.00, capped at 24 months' wage = 240,000.00

Feature: WPS SIF generation
  Scenario: Approved pay run produces a SIF
    Given pay run PR-2027-03 is APPROVED by a user other than the preparer
    When I generate the WPS file
    Then one EDR record is produced per employee paid
    And one SCR record totals the salaries
    And the file name follows the configured agent naming convention
    And the file hash is stored

Feature: GPSSA
  Scenario: Contributions only for eligible nationals
    Given a UAE-national employee and an expatriate employee
    When the pay run is calculated
    Then GPSSA employee and employer contributions (rates from config) apply only to the UAE national
```

---

## E-10 Corporate Tax working papers

```gherkin
Feature: CT computation (thresholds & rates from config)

  Scenario: 9% above the 375,000 band
    Given accounting profit 1,000,000.00
    And non-deductible adjustments of 20,000.00 (entertainment 50% add-back of 40,000.00 spend)
    When the CT working paper is computed
    Then taxable income is 1,020,000.00
    And CT payable is 58,050.00
    # (1,020,000 − 375,000) × 9% = 58,050

  Scenario: Small Business Relief
    Given the entity elected SBR and revenue for the period is 2,800,000.00
    And the configured SBR window covers this tax period
    Then taxable income is treated as nil and CT payable is 0.00

  Scenario: SBR breach is permanent
    Given revenue in tax period 2026 was 3,200,000.00
    When the 2027 working paper is prepared with revenue 2,500,000.00
    Then SBR is not available and the reason "Threshold exceeded in a prior period" is shown
```

---

## E-11 Financial reporting

```gherkin
Feature: Trial balance integrity
  Scenario: TB always balances
    Given any set of posted entries
    Then total debits equal total credits on the trial balance

Feature: Bilingual financial statements
  Scenario: Arabic balance sheet
    When I export the balance sheet in Arabic
    Then the layout is right-to-left and account names are shown in Arabic
```

## E-12 Localisation

```gherkin
Feature: Arabic amount in words
  Scenario: Invoice total in words
    Given an invoice total of AED 1,250.50
    Then the English words read "One thousand two hundred fifty dirhams and fifty fils only"
    And the Arabic words are generated by the Arabic tafqit routine and reviewed by a native speaker (golden-file test)

Feature: Validators
  Scenario Outline: UAE identifiers
    Then "<value>" is <result> as a <type>
    Examples:
      | type        | value                   | result  |
      | TRN         | 100123456700003         | valid   |
      | TRN         | 10012345670000          | invalid |
      | IBAN        | AE070331234567890123456 | valid   |
      | Emirates ID | 784-1990-1234567-6      | valid   |
      | Emirates ID | 784-1990-1234567-7      | invalid |
```

---

## Launch Kit epics (strategy v2 Phase 1)

These are implemented. The Gherkin mirrors tests in `packages/{company,workspace,website,compliance,provisioning,db}/test`.

| Epic | Name | Features |
|---|---|---|
| E-LK-01 | Licence import & company record | F-LK-01, F-LK-02 |
| E-LK-02 | Domain & email | F-LK-03, F-LK-04 |
| E-LK-03 | Website builder | F-LK-05 |
| E-LK-04 | Bank link | F-LK-06 |
| E-LK-05 | Books ready & compliance calendar | F-LK-07, F-LK-08 |
| E-LK-06 | Licence-to-live orchestration | F-LK-09 |

```gherkin
Feature: Licence to live in one guided flow (E-LK-06)

  Background:
    Given a sandbox registrar, email reseller, site host, open-finance provider and ASP
    And the trade licence DET 1234567 for "Sidra Consultancy" issued 2026-09-29, partners 60% / 40%
    And the customer was activated by setup agent "agent-7"

  Scenario: A new consultancy goes live the same day
    When the founder starts a launch with headcount 4
    Then the company record is created with vertical "Professional services" and partner "agent-7"
    And both partners are flagged as UBO candidates
    And "sidra.ae" is registered
    And mailboxes layla@, omar@, info@ and accounts@sidra.ae exist with MX, SPF and DMARC records
    And a bilingual website is published at https://sidra.ae/
    And the chart of accounts includes "1260 Unbilled revenue"
    And the first financial year ends on 2027-12-31
    And the compliance calendar shows CT registration due 2026-12-29 and e-invoicing go-live 2027-07-01
    And the launch is LIVE with only "Link your bank" open
    And licence-to-live is within one working day

  Scenario: The registrar is down
    Given the registrar fails the first registration attempt
    When the launch runs
    Then it stops at "Pick a domain" as retryable
    When the launch is retried
    Then it resumes at "Pick a domain" without re-importing the licence
    And exactly one domain is registered

  Scenario: The obvious domains are taken
    Given sidra.ae and sidra.com are taken
    When the launch runs
    Then "sidraconsultancy.ae" is registered

  Scenario: The bank consent arrives later
    Given a LIVE launch waiting on bank consent
    When the founder authorises access in their bank and the launch resumes
    Then "Link your bank" is done and no other step runs again

  Scenario: An unknown licence
    When a launch starts for licence DET 999
    Then it stops at "Sign in" with "No licence 999 at DET" and is not retryable

Feature: Generated websites are safe (E-LK-03)
  Scenario: Hostile licence data
    Given a trade name "<script>alert(1)</script>" and a brand colour containing "</style><script>"
    When the website is generated
    Then no page contains a script tag
    And the default accent colour is used

Feature: One licence, one company (E-LK-01)
  Scenario: A second partner onboards an already-onboarded licence
    Given licence DET 1234567 is live on Falaj
    When another tenant materialises the same licence
    Then the database refuses it on the licence uniqueness rule
```
