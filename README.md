# falaj · فلج

*Every dirham, in its channel.* **The company operating system for the UAE:** licence in the morning, open for business by the afternoon.

- Strategy: [Falaj Company OS Strategy v2](https://claude.ai/artifact/1fSp6KpaJBewsi2ySs7DSF). How the code maps to it is in [docs/10](docs/10-strategy-alignment.md).
- Brand: [Falaj Brand Book](https://claude.ai/artifact/Rnv9YSmQgtbrCYd8GS8spf).

**Building now: Phase 1 · Launch Kit.** Licence import → domain → email → website → bank link → books → go live, with invoicing, VAT, e-invoicing and a compliance calendar underneath.

> **Not legal or tax advice.** Regulatory values live in effective-dated configuration, and anything marked `verify: true` / `VERIFY` must be confirmed with the named authority (FTA, MoF, CBUAE, MOHRE, GPSSA) before production use.

## What's here

| Path | What it is |
|---|---|
| `docs/00…10` | Assumptions, executive summary, Big Four-style diagnostic, feature inventory, UAE compliance matrix, fintech licensing map, ERD, architecture, roadmap, Gherkin stories, **strategy alignment** |
| `packages/company` | Trade-licence import and validation; the one company record; UBO candidates |
| `packages/workspace` | Domain suggestions, mailbox plan and email/website DNS, with registrar and email-reseller ports |
| `packages/website` | Bilingual (EN/AR, RTL) website generator from licence data |
| `packages/compliance` | Compliance calendar (licence, CT, VAT, e-invoicing, UBO, WPS) from effective-dated rules |
| `packages/provisioning` | The licence-to-live saga: idempotent, resumable, audited; vertical charts of accounts; plans |
| `packages/core` | Money (bigint minor units, half-up), UAE validators, EN/AR amount-in-words, `RegulatoryConfig` |
| `packages/ledger` | Immutable double-entry ledger: validation, reversal-only corrections, periods, gapless numbering, trial balance, hash-chained audit log |
| `packages/tax-uae` | VAT engine, VAT201 builder, tax-invoice validator, Corporate Tax working paper, e-invoicing mandate calendar, UAE default rules |
| `packages/db` | Postgres migration (RLS, append-only triggers, deferred balance check), Drizzle schema, ledger repository |
| `packages/payroll-uae` | Gratuity, leave entitlement, WPS SIF |
| `packages/einvoice-pint-ae` | ASP and PINT-AE renderer ports (implementation in epic E-07) |
| `apps/web` | Next.js 16: `/` Company OS home, `/launch` runs the real saga on sample licences, `/ledger` Run preview; EN/AR + RTL; Falaj brand |

## Run it

Requires Node ≥ 22 and pnpm 10 (`npm i -g pnpm`, or `npx pnpm@10.18.0 …`).

```bash
pnpm install
```

```bash
pnpm test
```

```bash
pnpm dev
```

`pnpm dev` serves the app at http://localhost:3000/en. Try http://localhost:3000/en/launch and http://localhost:3000/ar/launch?licence=DMCC-876543.

The database tests run the real migration in embedded Postgres (PGlite), so you don't need a Postgres server. In production, apply `packages/db/migrations/*.sql` as the schema owner and connect the app as `falaj_app`.

## Design rules this code enforces

- **No floats near money.** Amounts are `bigint` fils, and every rounding step is explicit and half-up.
- **Posted is permanent.** Entries are frozen in memory and append-only in Postgres (grants plus triggers). Corrections are reversals, and each entry can be reversed at most once.
- **Balanced twice.** The domain validates each journal before posting, and Postgres re-checks the balance at COMMIT with a deferred constraint trigger.
- **Tenant isolation in the database.** RLS is forced on every table, and a session without a tenant sees nothing.
- **Every number drills down.** Trial-balance rows and VAT201 boxes carry `entry#line` references.
- **Partners behind ports.** The registrar, email reseller, hosting, open finance and ASP are interfaces with fakes. Falaj never moves money.
- **No invented prices.** Plan prices and partner revenue share stay unset until the pricing study and partner agreements.
- **Rules are data.** VAT/CT rates, SBR window, QFZP de minimis, e-invoicing dates and gratuity factors are effective-dated config with `verify` flags.
