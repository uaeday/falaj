# 05 — Fintech licensing map

> **Updated 1 Oct 2026:** positioning, phasing, verticals and channel are superseded by the **Falaj Company OS Strategy v2**. See [`10-strategy-alignment.md`](10-strategy-alignment.md). The compliance and ledger content below still stands.

> **Not legal advice.** Whether Falaj is in scope is a legal determination. **Gate:** before any Phase 4 feature ships, obtain a written opinion from UAE regulatory counsel and, if counsel advises it, hold pre-application discussions with CBUAE (or DFSA/FSRA).

## 5.1 Guardrail

Falaj **does not** hold customer funds, issue stored value, extend credit, carry out FX, or provide payment services on its own balance sheet or in its own name. All money movement runs through licensed partners, and Falaj acts as the **software, data and workflow layer**.

This is enforced in the architecture in three ways:

- **No platform settlement accounts.** Falaj's chart of accounts has no "client money" account, and the product has no code path that credits a Falaj-owned account with tenant funds.
- **Payment instructions are signed and executed by the partner.** Falaj sends instructions only with the tenant's authorisation, over the partner's API. The partner carries out SCA/consent.
- **Tenant money never touches Falaj's bank account.** Funds settle directly from the payer to the tenant's bank or a partner-held account. Falaj's revenue is a SaaS fee or a partner revenue share, invoiced separately.

## 5.2 Feature → licence it would trigger → partner model

Licence names follow CBUAE frameworks (VERIFY current circular numbers with CBUAE). The DIFC/ADGM columns apply only if Falaj operated the activity from those jurisdictions.

| Feature | What it does | Licence it would trigger if Falaj did it itself | DIFC / ADGM equivalent | Partner model we use | Our role / data flow | Residual Falaj risk |
|---|---|---|---|---|---|---|
| F-PAYM-01 Payment links / card acceptance | Customer pays an invoice by card | **Retail Payment Services** licence (merchant acquiring / payment aggregation), under the RPSCS Regulation (VERIFY) | DFSA "Providing Money Services"; FSRA "Providing Money Services" | Licensed PSP or acquirer onboards **each tenant as its own merchant** (sub-merchant under the PSP's KYB) | Generate link with the invoice reference → PSP checkout → webhook → match to AR | Must not become a payment facilitator/aggregator itself. The contract must make the PSP merchant-of-record facilitator. |
| F-PAYM-02 Aani instant payments / request-to-pay | IPP credit transfer or RTP request | RPS licence (payment initiation) and/or IPP participant status (banks and licensed PSPs only; VERIFY Al Etihad Payments rules) | — | Participating bank or licensed PSP | Build the RTP/QR payload from the invoice; the bank executes; receive status | Low if the partner initiates |
| F-PAYM-03 Direct debit | Recurring collection | UAEDDS participation via a sponsoring bank | — | Sponsoring bank (originator) | Mandate data capture, collection schedule, reconciliation | Low |
| F-PAYM-04 Vendor payouts | Pay suppliers from an approved AP run | RPS (payment initiation) if Falaj initiates; money transmission if funds pass through Falaj | DFSA/FSRA money services | (a) Host-to-host / API with the tenant's own bank, where the tenant signs; or (b) licensed open-finance PIS provider | Create the payment file or instruction after SoD approval; the bank executes | Low with option (a) |
| F-OF-01 Account aggregation (AIS) | Read the tenant's bank balances and transactions | **Open Finance** licence / registration (CBUAE Open Finance Regulation — VERIFY category names) | FSRA/DFSA AIS-equivalent | Licensed open-finance provider (TPP) operating under the CBUAE framework | Consent UX hosted or embedded by the TPP; we receive data under the tenant's consent | Consent records; data-processing agreement |
| F-OF-02 Payment initiation (PIS) | Initiate payments from the tenant's account | Open Finance / RPS payment-initiation licence | FSRA/DFSA PIS | Licensed TPP | As above | As above |
| F-FIN-01 Credit-scoring data package | Share ledger-derived metrics with lenders | Possibly **credit information** activities (Al Etihad Credit Bureau regime — VERIFY) if Falaj scores; lending is not triggered if Falaj only shares data | — | Lender or bureau computes the score; Falaj shares the **tenant-consented raw data package** | Consent → data room export | Must not "rate" credit for third parties without legal review |
| F-FIN-02 Invoice financing / factoring | Advance cash against receivables | **Finance company** licence (CBUAE Finance Companies Regulation — VERIFY) or bank licence; lending on balance sheet is prohibited for Falaj | DFSA "Providing Credit"; FSRA equivalent | Bank or finance company is lender of record; Falaj is a referral/marketplace | Invoice data and verification → lender decides and funds directly to the tenant | Referral may be "arranging credit". **VERIFY** whether this needs registration (see 5.3). |
| F-FIN-03 Dynamic discounting / SCF | Early payment to suppliers | If buyer-funded: none (commercial). If bank-funded: bank's licence. | — | Buyer-funded (tenant's own cash) or bank SCF programme | Workflow and offer management only | Funds must never flow via Falaj |
| F-SPD-01 Corporate cards | Physical/virtual cards for staff | Card issuing → RPS / SVF / bank licence, plus card-scheme membership | DFSA/FSRA | Licensed issuer / BIN sponsor; programme manager, if used, is licensed | Card feed → AP / expense; spend controls configured via issuer API | Programme-manager role itself may need licensing (VERIFY) |
| F-CSH-01 Virtual IBANs | Unique IBAN per payer for auto-matching | Issuing accounts or payment accounts → bank licence / RPS | — | Partner bank issues vIBANs **in the tenant's name** (sub-accounts of the tenant's account) | Match inbound credits → AR allocations | Must not be vIBANs under a Falaj master account |
| Wallet / stored balance (explicitly **Won't**) | Prepaid balances inside Falaj | **Stored Value Facilities** licence (SVF Regulation — VERIFY) | DFSA/FSRA e-money | Not offered | — | Design rule: no balances that represent money |
| FX conversion | Convert currencies for payouts | Exchange-house or bank licence | — | Tenant's bank / PSP | Display partner's rate; record the executed rate | None if display-only |
| F-KYC-01/02 KYB, sanctions & PEP screening | Screening tenants and their customers | No licence (a tooling vendor). Falaj's own AML obligations depend on whether it becomes an FI or a "technology enabler" (see 5.3). | — | Screening/KYC data vendor | Screening results stored against records | Data protection; list update SLAs (UAE Local Terrorist List via Executive Office — VERIFY) |

## 5.3 Does the newer CBUAE law regime bring technology platforms into scope?

**What changed (VERIFY with CBUAE and counsel).** The CBUAE law was re-issued. I believe this is **Federal Decree-Law No. 6 of 2025** regarding the Central Bank, the regulation of financial institutions and activities, and insurance, replacing FDL 14/2018. My understanding is that it:

- widens the perimeter to activities involving **technology platforms and "enablers"** that facilitate, offer or intermediate licensed financial activities, including decentralised and virtual-asset-adjacent models;
- lets CBUAE require licensing of, or impose conditions on, entities whose technology is integral to delivering a licensed activity, even when the regulated product itself is provided by a licensed FI;
- sets a transition period for existing businesses to comply (VERIFY: one year from effective date, possibly extendable).

The exact wording, definitions and transition dates **must be confirmed**. I have deliberately not stated article numbers.

**What it means for Falaj (design positions to take now):**

1. **Assume the perimeter may reach us for Phase 4.** Treat "embedded finance" features as potentially regulated *facilitation*, not neutral software. Phases 1–3 (ERP/CRM with no money movement, only bank-file generation for the tenant's own bank) are very likely outside scope. **VERIFY.**
2. **Separate the fintech surface into its own legal entity and codebase boundary** (`apps/fintech-gateway`, its own DB schema and audit log). That entity can then seek a licence, a regulatory sandbox (CBUAE sandbox / ADGM RegLab / DIFC ITL), or a no-objection letter without re-licensing the ERP business.
3. **Contract structure:** partners are the regulated service provider and the customer-facing provider of record. Falaj is a technology service provider under the partner's **outsourcing/third-party risk** framework, which CBUAE-licensed FIs must apply to vendors anyway. Build for bank vendor due diligence now: SOC 2, ISO 27001, UAE data residency, exit plans, audit rights.
4. **No revenue tied to credit decisions or payment volume** until counsel confirms the model. Prefer SaaS fees plus fixed referral fees. Volume-based fees are a factor regulators may treat as "carrying on" the activity.
5. **Conduct and consumer protection:** if Phase 4 features reach individuals (sole establishments, B2C tenants), CBUAE Consumer Protection Regulation expectations may apply through partners. Build disclosures and complaints logging.
6. **Decision point (Phase 4 kickoff):** choose one route:
   - (a) pure partner model, where Falaj is an unlicensed technology provider under partner oversight;
   - (b) apply for a CBUAE **RPS Category** licence (or an Open Finance licence) for Falaj Payments LLC;
   - (c) incubate in the ADGM RegLab / DIFC Innovation Testing Licence.

   **Recommended: (a) at launch, and prepare (b) in parallel if payment volume justifies it.**

## 5.4 Partner selection criteria (checklist)

- Holds the correct CBUAE (or DFSA/FSRA) licence **for the activity and the customer segment**. Verify on the CBUAE public register.
- Supports **tenant-as-merchant or tenant-as-account-holder** structures, so there is no pooling under Falaj.
- API-first, with webhooks, sandbox, idempotency and reconciliation files.
- UAE data residency; PDPL-compliant DPA; ISO 27001/SOC 2.
- Clear liability, SLA and exit terms. Falaj keeps the right to switch providers, with the adapter pattern as the technical enabler.
