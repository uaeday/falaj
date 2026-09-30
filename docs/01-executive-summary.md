# 01 — Executive summary

> **Updated 1 Oct 2026:** positioning, phasing, verticals and channel are superseded by the **Falaj Company OS Strategy v2**. See [`10-strategy-alignment.md`](10-strategy-alignment.md). The compliance and ledger content below still stands.

> Not legal or tax advice. See `00-assumptions.md`.

## The situation

In 2023–2027 a typical UAE SME (AED 1m–250m revenue, 5–250 staff) goes through three regulatory step-changes, one after another:

1. **Corporate Tax** (FDL 47/2022) now needs an audit-grade ledger, with non-deductible tagging, related-party data and (for free-zone entities) qualifying-income segregation.
2. **Mandatory e-invoicing** (MD 243 & 244/2025) replaces the PDF invoice with a structured PINT-AE document routed through an Accredited Service Provider. Mid-market go-live is **1 Jan 2027 (≥ AED 50m)** and **1 Jul 2027 (< AED 50m)**. These dates are VERIFY (MoF/FTA) and are held as configuration.
3. **AML/CFT, UBO and data-protection enforcement** is maturing, so KYC, UBO and consent data become evidence that regulators and banks ask for.

Most SMEs are still running on spreadsheets, an entry-level cloud ledger, or a legacy desktop package with a part-time bookkeeper. Our diagnostic (`02-diagnostic.md`) puts the median SME at **maturity 1.5–2.0 out of 5** across Record-to-Report, Procure-to-Pay and Order-to-Cash. It finds the same control failures again and again:

- No segregation of duties.
- Unreconciled bank and **post-dated-cheque (PDC)** positions.
- VAT prepared by hand in Excel.
- Weak inventory and fixed-asset registers.
- Undocumented related-party transactions.
- Missing UBO records.

## The thesis

*Every dirham, in its channel.* · *كل درهم في مجراه* (brand line from the Falaj Brand Book)


**Win the compliance-driven re-platforming moment with a UAE-native ERP core. Then expand along the ledger into CRM, enterprise finance and embedded financial services.**

- **Wedge (Phase 1, ERP core → falaj Ledger):** "E-invoicing-ready, CT-ready books in 30 days." It is a bilingual, RTL, UAE-native ledger with a VAT engine, CT working papers, PINT-AE e-invoicing through an ASP, PDC management, and WPS payroll. It is sold alongside the tenant's accountant or tax agent, who is our main acquisition channel.
- **Expand (Phase 2, CRM → falaj Clients):** Lead-to-Cash on the same ledger, so quotes become invoices with no re-keying. Customer 360 shows live AR, PDCs and credit limits, with WhatsApp-first engagement.
- **Upsell (Phase 3, Enterprise finance → falaj Enterprise):** FP&A, 13-week treasury, LC/LG register, consolidation, contracting/IFRS 15, SoD enforcement and an auditor workspace. This serves customers as they grow toward AED 250m and group structures.
- **Monetise the data (Phase 4, Fintech → falaj Pay):** payments, open-finance connectivity, receivables finance, cards and virtual IBANs, **all delivered through licensed partners**. The platform is the data and workflow layer. It never holds funds or lends on its own balance sheet.

## Why we win

| Differentiator | Why it matters |
|---|---|
| Compliance is modelled as data. Rates and dates are configuration with effective dating. | UAE rules change quickly: e-invoicing dates have already been amended once, and the SBR window has been extended (VERIFY). We ship a config change, not a release. |
| Every number drills down to source journals, over an immutable, hash-chained ledger. | Auditors and the FTA get evidence, not assertions. This shortens the audit and reduces penalty exposure. |
| UAE-native operational objects: PDCs, LC/LG, WPS SIF, gratuity, designated zones, QFZP income, Makani/PO Box, Arabic amount-in-words. | Global ERPs reach these through local partners and customisation. We ship them as standard. |
| Accountant-first distribution with multi-client practice views. | Tax agents and accounting firms control the SME buying decision in the UAE. |

## What we will build first

**Launch Kit (strategy v2 Phase 1, Q1–Q2 2027):** licence import → domain → email → website → bank link → books ready → go live. The kit also covers invoicing, VAT and e-invoicing via an ASP, contacts and a compliance calendar. It is sold at licence issue through setup agents, free zones, banks and accounting firms.

**Exit criteria (strategy):** 1,000 companies set up, and 100 paying for e-invoicing, before 1 Jul 2027. Licence to operating takes under one working day. The full ERP, HR and payroll wait for Phase 2 "Run" (H2 2027), which starts only after the Launch Kit meets its exit criteria.

## Key risks

| Risk | Mitigation |
|---|---|
| Regulatory drift (dates, thresholds, schemas) | Effective-dated config, a monitored regulatory calendar, and a quarterly tax-agent review. |
| ASP dependency and schema change | Adapter interface, at least two ASP partners, and validation of our PINT-AE output against the official validation artefacts. |
| Fintech licensing creep | Partner-only money movement. A legal opinion before Phase 4 on whether the CBUAE law regime (VERIFY: FDL 6/2025) brings "technology enablers" into scope. |
| Data residency | UAE-region hosting only. Residency is recorded per tenant, and cross-border transfer rules are handled in the DPA. |
| Payroll/tax calculation errors | Worked-example unit tests signed off by the tax agent. Human approval before posting. |
