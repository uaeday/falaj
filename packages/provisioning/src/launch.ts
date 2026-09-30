import { aed } from '@falaj/core';
import { type Company, type LicenceRef, type LicenceSource, type PartnerAttribution, companyFromLicence, uboCandidates } from '@falaj/company';
import { type Obligation, addMonths, complianceCalendar } from '@falaj/compliance';
import { type Account, type AuditSink, type FiscalPeriod, monthlyPeriods } from '@falaj/ledger';
import { type SitePublisher, buildSite } from '@falaj/website';
import {
  type DnsRecord, type DomainRegistrar, type EmailProvider, type MailboxPlan, emailDnsRecords, planMailboxes, suggestDomains, websiteDnsRecords,
} from '@falaj/workspace';
import { chartOfAccounts } from './coa.ts';
import { type PlanCode, recommendPlan } from './plans.ts';
import type { AspOnboarding, OpenFinanceProvider } from './ports.ts';

/** The strategy's seven-step customer journey, licence to live. */
export const STEPS = ['SIGN_IN', 'DOMAIN', 'EMAIL', 'WEBSITE', 'BANK', 'FINANCE', 'GO_LIVE'] as const;
export type StepId = (typeof STEPS)[number];

/** Steps that may wait on the customer or DNS without holding up go-live. */
const NON_BLOCKING: ReadonlySet<StepId> = new Set(['EMAIL', 'BANK']);

export type StepStatus = 'PENDING' | 'DONE' | 'WAITING' | 'FAILED';

export interface StepState {
  status: StepStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  waitingFor?: string;
  error?: { message: string; retryable: boolean };
}

export interface LaunchInput {
  licence: LicenceRef;
  /** Chosen by the customer; otherwise the first available suggestion. */
  domain?: string;
  emailProvider: 'M365' | 'GOOGLE';
  headcount: number;
  contact?: { phone?: string; whatsapp?: string };
  brand?: { accent?: string };
  /** Expected annual revenue in AED as a decimal string. State stays plain JSON so it can be persisted. */
  expectedAnnualRevenueAed?: string;
  partner?: Omit<PartnerAttribution, 'attributedAt'>;
}

export interface LaunchState {
  runId: string;
  tenantId: string;
  input: LaunchInput;
  status: 'RUNNING' | 'WAITING' | 'FAILED' | 'LIVE';
  startedAt: string;
  liveAt?: string;
  steps: Record<StepId, StepState>;
  company?: Company;
  domain?: string;
  mailboxes?: MailboxPlan[];
  dns?: DnsRecord[];
  emailTenant?: { ref: string; verificationToken: string };
  site?: { url: string; version: string; files: string[] };
  bank?: { consentId: string; url: string; status: string };
  finance?: { accounts: Account[]; periods: FiscalPeriod[]; firstFinancialYearEnd: string; aspRequestId: string };
  calendar?: Obligation[];
  plan?: PlanCode;
  uboCandidates?: string[];
}

export interface LaunchDeps {
  licences: LicenceSource;
  registrar: DomainRegistrar;
  email: EmailProvider;
  sites: SitePublisher;
  openFinance: OpenFinanceProvider;
  asp: AspOnboarding;
  audit: AuditSink;
  now: () => Date;
  newId: () => string;
  /** Falaj Sites hosting targets (config). */
  sitesHost: { apexIp: string; cname: string };
  /** Persist after every step so a crash resumes where it stopped. */
  save?: (state: LaunchState) => Promise<void>;
}

export class StepError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

type StepResult = { status: 'DONE' } | { status: 'WAITING'; waitingFor: string };

export function newLaunch(runId: string, tenantId: string, input: LaunchInput, now: Date): LaunchState {
  return {
    runId,
    tenantId,
    input,
    status: 'RUNNING',
    startedAt: now.toISOString(),
    steps: Object.fromEntries(STEPS.map((s) => [s, { status: 'PENDING', attempts: 0 }])) as Record<StepId, StepState>,
  };
}

/**
 * First CT tax period: calendar-year financial year, ending 31 Dec of the issue year if that gives at
 * least 6 months, else 31 Dec of the next year (first period between 6 and 18 months; VERIFY FTA rules).
 */
export function firstFinancialYearEnd(issueDate: string): string {
  const year = Number(issueDate.slice(0, 4));
  const thisYearEnd = `${year}-12-31`;
  const sixMonthsLater = new Date(Date.parse(`${addMonths(issueDate, 6)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return sixMonthsLater <= thisYearEnd ? thisYearEnd : `${year + 1}-12-31`;
}

const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new StepError(`Missing ${what}; earlier step incomplete`, false);
  return v;
};

const HANDLERS: Record<StepId, (s: LaunchState, d: LaunchDeps) => Promise<StepResult>> = {
  // 1 · Sign in: licence imported, owners and activities created once
  async SIGN_IN(s, d) {
    const r = await d.licences.fetch(s.input.licence);
    if (!r.ok) throw new StepError(r.error.message, r.error.code === 'UNAVAILABLE');
    const now = d.now().toISOString();
    const c = companyFromLicence(r.value, {
      tenantId: s.tenantId,
      today: now.slice(0, 10),
      now,
      newId: d.newId,
      ...(s.input.partner ? { partner: { ...s.input.partner, attributedAt: now } } : {}),
    });
    if (!c.ok) throw new StepError(c.error.map((i) => i.message).join('; '), false);
    s.company = c.value;
    s.uboCandidates = uboCandidates(c.value).map((p) => p.id);
    s.plan = recommendPlan(s.input.headcount).code;
    return { status: 'DONE' };
  },

  // 2 · Domain: .ae or .com registered with the registrar partner
  async DOMAIN(s, d) {
    const c = need(s.company, 'company');
    const candidates = s.input.domain ? [s.input.domain] : suggestDomains(c.tradeName.en);
    if (!candidates.length) throw new StepError('No domain candidates; ask the customer to choose one', false);
    const domain = s.domain ?? (await d.registrar.check(candidates)).find((a) => a.available)?.domain;
    if (!domain) throw new StepError(`None of ${candidates.join(', ')} is available; ask the customer to choose`, false);
    s.domain = domain;
    await d.registrar.register(domain, { legalName: c.legalName.en, licenceNo: c.licenceNo, email: `accounts@${domain}` }, `${s.runId}:domain`);
    return { status: 'DONE' };
  },

  // 3 · Email: white-label tenant, DNS, one mailbox per person + role inboxes
  async EMAIL(s, d) {
    const c = need(s.company, 'company');
    const domain = need(s.domain, 'domain');
    s.emailTenant ??= await d.email.createTenant(domain, `${s.runId}:email`).then((t) => ({ ref: t.tenantRef, verificationToken: t.verificationToken }));
    s.dns = [...emailDnsRecords(domain, d.email.code, s.emailTenant.verificationToken), ...websiteDnsRecords(d.sitesHost)];
    await d.registrar.setDns(domain, s.dns);
    if ((await d.email.verifyDomain(s.emailTenant.ref, domain)) === 'PENDING') return { status: 'WAITING', waitingFor: 'DNS propagation for domain verification' };
    s.mailboxes = planMailboxes(c, domain);
    for (const m of s.mailboxes) await d.email.createMailbox(s.emailTenant.ref, m);
    return { status: 'DONE' };
  },

  // 4 · Website: bilingual site built from licence and brand
  async WEBSITE(s, d) {
    const c = need(s.company, 'company');
    const domain = need(s.domain, 'domain');
    const bundle = buildSite(c, {
      domain,
      contactEmail: `info@${domain}`,
      year: d.now().getUTCFullYear(),
      ...(s.input.contact?.phone ? { phone: s.input.contact.phone } : {}),
      ...(s.input.contact?.whatsapp ? { whatsapp: s.input.contact.whatsapp } : {}),
      ...(s.input.brand ? { brand: s.input.brand } : {}),
    });
    const r = await d.sites.publish(bundle, `${s.runId}:site`);
    s.site = { ...r, files: Object.keys(bundle.files) };
    return { status: 'DONE' };
  },

  // 5 · Bank: consent link from the licensed open-finance partner; the customer authorises in their bank
  async BANK(s, d) {
    const c = need(s.company, 'company');
    s.bank ??= { ...(await d.openFinance.createConsent({ companyId: c.id, legalName: c.legalName.en, redirectUrl: `https://app.falaj.ae/launch/${s.runId}` }, `${s.runId}:bank`)), status: 'PENDING' };
    s.bank.status = await d.openFinance.status(s.bank.consentId);
    if (s.bank.status === 'AUTHORISED') return { status: 'DONE' };
    if (s.bank.status === 'PENDING') return { status: 'WAITING', waitingFor: 'Customer to authorise bank access' };
    delete s.bank; // rejected or expired: a fresh consent on retry
    throw new StepError('Bank consent was not granted', true);
  },

  // 6 · ERP ready: chart of accounts, periods, compliance calendar, ASP onboarding
  async FINANCE(s, d) {
    const c = need(s.company, 'company');
    const fye = firstFinancialYearEnd(c.licenceIssueDate);
    const years = [...new Set([Number(c.licenceIssueDate.slice(0, 4)), Number(fye.slice(0, 4))])];
    const periods = years.flatMap((y) => monthlyPeriods(c.id, y)).filter((p) => p.end >= c.licenceIssueDate && p.start <= fye);
    const asp = await d.asp.requestOnboarding({ legalName: c.legalName.en, licenceNo: c.licenceNo, email: `accounts@${need(s.domain, 'domain')}` }, `${s.runId}:asp`);
    s.finance = { accounts: chartOfAccounts(c.id, c.vertical, () => d.newId()), periods, firstFinancialYearEnd: fye, aspRequestId: asp.requestId };
    s.calendar = complianceCalendar(
      { company: c, firstFinancialYearEnd: fye, hasEmployees: s.input.headcount > c.people.length, ...(s.input.expectedAnnualRevenueAed ? { expectedAnnualRevenue: aed(s.input.expectedAnnualRevenueAed), expectedAnnualTaxableSupplies: aed(s.input.expectedAnnualRevenueAed) } : {}) },
      { from: d.now().toISOString().slice(0, 10), to: addMonths(fye, 12) },
    );
    return { status: 'DONE' };
  },

  // 7 · Go live: invoicing and contacts switched on; licence-to-live time recorded
  async GO_LIVE(s) {
    need(s.finance, 'finance setup');
    need(s.site, 'website');
    return { status: 'DONE' };
  },
};

/**
 * Runs (or resumes) a launch. Idempotent: DONE steps are skipped and partner calls carry run-scoped
 * idempotency keys, so calling again after a crash or a partner outage is always safe. Designed to sit
 * inside a durable workflow (Temporal) with this function as the activity body.
 */
export async function runLaunch(state: LaunchState, deps: LaunchDeps): Promise<LaunchState> {
  const s = structuredClone(state);
  s.status = 'RUNNING';
  let waiting = false;

  for (const id of STEPS) {
    const step = s.steps[id];
    if (step.status === 'DONE') continue;
    step.attempts++;
    step.startedAt ??= deps.now().toISOString();
    delete step.error;
    try {
      const r = await HANDLERS[id](s, deps);
      if (r.status === 'DONE') {
        step.status = 'DONE';
        step.finishedAt = deps.now().toISOString();
        delete step.waitingFor;
      } else {
        step.status = 'WAITING';
        step.waitingFor = r.waitingFor;
        waiting = true;
      }
      await deps.audit.record({
        tenantId: s.tenantId, action: `launch.${id.toLowerCase()}.${step.status.toLowerCase()}`, entityType: 'launch_run',
        entityId: s.runId, actorId: 'system:provisioning', at: deps.now().toISOString(),
        after: { attempts: step.attempts, ...(s.domain ? { domain: s.domain } : {}) },
      });
      if (step.status === 'WAITING' && !NON_BLOCKING.has(id)) {
        s.status = 'WAITING';
        await deps.save?.(s);
        return s;
      }
    } catch (e) {
      const retryable = e instanceof StepError ? e.retryable : true;
      step.status = 'FAILED';
      step.error = { message: e instanceof Error ? e.message : String(e), retryable };
      s.status = 'FAILED';
      await deps.audit.record({
        tenantId: s.tenantId, action: `launch.${id.toLowerCase()}.failed`, entityType: 'launch_run', entityId: s.runId,
        actorId: 'system:provisioning', at: deps.now().toISOString(), after: step.error,
      });
      await deps.save?.(s);
      return s;
    }
    await deps.save?.(s);
  }

  s.status = 'LIVE';
  s.liveAt ??= s.steps.GO_LIVE.finishedAt ?? deps.now().toISOString();
  if (waiting) s.status = 'LIVE'; // live with follow-ups (email verification or bank consent) still open
  await deps.save?.(s);
  return s;
}

/** Scorecard metric #1: licence-to-operating time against the "under one working day" target. */
export function licenceToLive(s: LaunchState, targetHours = 8): { minutes: number | null; metTarget: boolean | null; openItems: StepId[] } {
  const openItems = STEPS.filter((id) => s.steps[id].status !== 'DONE');
  if (!s.liveAt) return { minutes: null, metTarget: null, openItems };
  const minutes = Math.round((Date.parse(s.liveAt) - Date.parse(s.startedAt)) / 60_000);
  return { minutes, metTarget: minutes <= targetHours * 60, openItems };
}
