# 00 — Assumptions, conventions and disclaimer

> **Not legal or tax advice.** Everything in `docs/` is a product-design working paper. Every regulatory statement must be reviewed by a UAE-registered tax agent and UAE-qualified legal counsel before launch, and re-checked at each release against the FTA, MoF, CBUAE, MOHRE, UAE Data Office, DFSA and FSRA publications.

## Placeholders — assumptions made (change these and the docs still hold)

The brief left its `{{…}}` placeholders unfilled. None of them materially changes the architecture or licensing position, so I assumed the following and carried on:

| Placeholder | Assumption | Why it doesn't change the architecture |
|---|---|---|
| `{{PRODUCT_NAME}}` | **Falaj · فلج**, as set by the [Falaj Brand Book](https://claude.ai/artifact/Rnv9YSmQgtbrCYd8GS8spf). Module names follow the brand architecture: **falaj Ledger** (Phase 1), **falaj Clients** (Phase 2), **falaj Enterprise** (Phase 3), **falaj Pay** (Phase 4). The npm scope is `@falaj/*`; the repo folder is still `NewCo/`. | Naming only. Brand tokens (Palm #0E3B33, Channel #1C8580, Spring #BFE4DC, Sarooj #A4553A for alerts only, Limestone, Basalt; Readex Pro + IBM Plex Sans/Arabic/Mono) are wired into `apps/web`. |
| Initial verticals | ~~Trading, contracting, professional services~~ → per strategy v2: **professional services, trading, e-commerce, contracting** (in priority order) | Vertical-specific charts of accounts exist for all four (`packages/provisioning/src/coa.ts`). |
| Hosting | **UAE-region hyperscaler**: Azure *UAE North* (Dubai) as primary and *UAE Central* (Abu Dhabi) as DR, or AWS *me-central-1*. | The infra layer is provider-neutral (Postgres, object storage, KMS, containers). |
| Launch emirates / free zones | **Dubai and Abu Dhabi mainland, plus DMCC and IFZA free zones**. DIFC/ADGM tenants are supported as *customers* only. | Choosing DIFC/ADGM as the *platform's own* licensing seat would change the Phase 4 regulator (DFSA/FSRA instead of CBUAE). This is flagged in `05-fintech-licensing-map.md`. |

## Conventions used in these documents

- **`VERIFY (Authority)`** marks a law number, article, rate, threshold or date that I cannot confirm with certainty, or that the brief supplied and I could not independently confirm. Check it against the named authority before relying on it. The brief asked for this rule.
- **All rates, thresholds and deadlines are configuration** in the code (`packages/tax-uae/src/config`), keyed by effective date. None of them is a constant.
- **MoSCoW**: M = Must, S = Should, C = Could, W = Won't (this phase).
- **Maturity**: 1 Ad hoc · 2 Repeatable · 3 Defined · 4 Managed · 5 Optimised.
- IDs are used across documents for traceability: `P-xx` pain point, `R-xx` risk, `C-xx` control, `L-xx` legal obligation, `F-xx` feature, `E-xx` epic.

## Document map

| # | Deliverable | File |
|---|---|---|
| 1 | Executive summary | `01-executive-summary.md` |
| 2 | Big Four diagnostic (COSO RCM, APQC, heat-map, TOM, RACI) | `02-diagnostic.md` |
| 3 | Feature inventory + traceability | `03-feature-inventory.md` |
| 4 | UAE compliance & localisation matrix | `04-compliance-matrix.md` |
| 5 | Fintech licensing map | `05-fintech-licensing-map.md` |
| 6 | Domain model / ERD | `06-domain-model.md` |
| 7 | System architecture + repo structure | `07-architecture.md` |
| 8 | Phased roadmap | `08-roadmap.md` |
| 9 | Phase 1 epics and Gherkin stories | `09-phase1-epics-stories.md` |
| — | **Strategy v2 alignment (Company OS, Launch Kit)** | `10-strategy-alignment.md` |
| 10 | Phase 1 scaffold (ledger + VAT first) | repo root, see `README.md` |
