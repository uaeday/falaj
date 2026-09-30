import { FixtureLicenceSource, SAMPLE_LICENCES } from '@falaj/company';
import { HashChain, verifyChain } from '@falaj/ledger';
import { FakeSitePublisher } from '@falaj/website';
import { FakeEmailProvider, FakeRegistrar } from '@falaj/workspace';
import { describe, expect, it } from 'vitest';
import {
  FakeAspOnboarding, FakeOpenFinance, InMemoryLaunchStore, type LaunchInput, STEPS, chartOfAccounts, firstFinancialYearEnd,
  licenceToLive, newLaunch, recommendPlan, runLaunch,
} from '../src/index.ts';

function harness(opts: { taken?: string[]; failRegister?: number } = {}) {
  let t = Date.parse('2026-10-01T05:00:00Z');
  let id = 0;
  const chain = new HashChain();
  const deps = {
    licences: new FixtureLicenceSource(SAMPLE_LICENCES),
    registrar: new FakeRegistrar(new Set(opts.taken ?? []), opts.failRegister ?? 0),
    email: new FakeEmailProvider('M365'),
    sites: new FakeSitePublisher(),
    openFinance: new FakeOpenFinance(),
    asp: new FakeAspOnboarding(),
    audit: { record: (e: Parameters<HashChain['append']>[0]) => void chain.append(e) },
    now: () => new Date((t += 4 * 60_000)), // each tick = 4 minutes of wall-clock work
    newId: () => `id-${++id}`,
    sitesHost: { apexIp: '203.0.113.10', cname: 'sites.falaj.ae' },
    store: new InMemoryLaunchStore(),
  };
  return { deps: { ...deps, save: (s: Parameters<InMemoryLaunchStore['save']>[0]) => deps.store.save(s) }, chain, raw: deps };
}

const input = (licenceNo = '1234567', authority = 'DET'): LaunchInput => ({
  licence: { authority, licenceNo },
  emailProvider: 'M365',
  headcount: 4,
  contact: { whatsapp: '050 123 4567' },
  partner: { partnerId: 'agent-7', type: 'SETUP_AGENT' },
  expectedAnnualRevenueAed: '1500000',
});

describe('licence-to-live launch (Phase 1 Launch Kit)', () => {
  it('takes a new consultancy from licence to live in one run, with the bank consent left open', async () => {
    const { deps, chain, raw } = harness();
    const s = await runLaunch(newLaunch('run-1', 'tenant-1', input(), deps.now()), deps);

    expect(s.status).toBe('LIVE');
    expect(STEPS.map((id) => s.steps[id].status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'WAITING', 'DONE', 'DONE']);
    expect(s.steps.BANK.waitingFor).toBe('Customer to authorise bank access');
    expect(s.company).toMatchObject({ vertical: 'PROFESSIONAL_SERVICES', partner: { partnerId: 'agent-7', type: 'SETUP_AGENT' } });
    expect(s.plan).toBe('LAUNCH');
    expect(s.domain).toBe('sidra.ae');
    expect(raw.registrar.registered.has('sidra.ae')).toBe(true);
    expect(raw.email.mailboxes.map((m) => m.address)).toEqual(['layla@sidra.ae', 'omar@sidra.ae', 'info@sidra.ae', 'accounts@sidra.ae']);
    expect(raw.registrar.dns.get('sidra.ae')!.map((r) => r.purpose)).toContain('Website (apex)');
    expect(s.site!.url).toBe('https://sidra.ae/');
    expect(raw.sites.published.get('sidra.ae')!.files['ar/index.html']).toContain('dir="rtl"');
    expect(s.finance!.firstFinancialYearEnd).toBe('2027-12-31');
    expect(s.finance!.accounts.find((a) => a.code === '1260')!.name.en).toBe('Unbilled revenue');
    expect(s.finance!.periods[0]!.key).toBe('2026-09');
    expect(s.finance!.periods.at(-1)!.key).toBe('2027-12');
    expect(s.calendar!.map((o) => o.kind)).toEqual(expect.arrayContaining(['CT_REGISTRATION', 'EINVOICE_ASP', 'EINVOICE_GO_LIVE', 'VAT_REGISTRATION', 'LICENCE_RENEWAL']));
    expect(raw.asp.requests).toEqual(['run-1:asp']);

    const kpi = licenceToLive(s);
    expect(kpi.metTarget).toBe(true);
    expect(kpi.openItems).toEqual(['BANK']);
    expect(verifyChain(chain.all())).toMatchObject({ valid: true });
    expect((await raw.store.get('run-1'))!.status).toBe('LIVE');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // state is plain JSON, safe for jsonb
  });

  it('resuming after the customer authorises the bank closes the last item without redoing anything', async () => {
    const { deps, raw } = harness();
    const first = await runLaunch(newLaunch('run-2', 't', input(), deps.now()), deps);
    raw.openFinance.authorise(first.bank!.consentId);
    const sites = raw.sites.published.size;
    const second = await runLaunch(first, deps);
    expect(second.steps.BANK.status).toBe('DONE');
    expect(licenceToLive(second).openItems).toEqual([]);
    expect(raw.sites.published.size).toBe(sites);
    expect(second.liveAt).toBe(first.liveAt);
  });

  it('a registrar outage fails the domain step as retryable; the retry resumes there', async () => {
    const { deps, raw } = harness({ failRegister: 1 });
    const failed = await runLaunch(newLaunch('run-3', 't', input(), deps.now()), deps);
    expect(failed.status).toBe('FAILED');
    expect(failed.steps.SIGN_IN.status).toBe('DONE');
    expect(failed.steps.DOMAIN).toMatchObject({ status: 'FAILED', attempts: 1, error: { retryable: true } });
    const companyId = failed.company!.id;

    const resumed = await runLaunch(failed, deps);
    expect(resumed.status).toBe('LIVE');
    expect(resumed.steps.DOMAIN.attempts).toBe(2);
    expect(resumed.steps.SIGN_IN.attempts).toBe(1);
    expect(resumed.company!.id).toBe(companyId);
    expect(raw.registrar.registered.size).toBe(1);
  });

  it('picks the next free suggestion when the obvious domains are taken', async () => {
    const { deps } = harness({ taken: ['sidra.ae', 'sidra.com'] });
    const s = await runLaunch(newLaunch('run-4', 't', input(), deps.now()), deps);
    expect(s.domain).toBe('sidraconsultancy.ae');
  });

  it('an unknown licence stops at sign-in and is not retryable', async () => {
    const { deps } = harness();
    const s = await runLaunch(newLaunch('run-5', 't', input('999'), deps.now()), deps);
    expect(s.status).toBe('FAILED');
    expect(s.steps.SIGN_IN.error).toEqual({ message: 'No licence 999 at DET', retryable: false });
    expect(s.steps.DOMAIN.status).toBe('PENDING');
  });

  it('trading and e-commerce companies get their vertical chart of accounts', async () => {
    const { deps } = harness();
    const trading = await runLaunch(newLaunch('run-6', 't', { ...input('DMCC-876543', 'DMCC'), headcount: 12 }, deps.now()), deps);
    expect(trading.domain).toBe('qattarafoods.ae');
    expect(trading.plan).toBe('GROW');
    expect(trading.finance!.accounts.filter((a) => ['1250', '1600', '2150'].includes(a.code)).map((a) => a.control)).toEqual(['AR', 'INVENTORY', 'AP']);
    expect(trading.calendar!.some((o) => o.kind === 'WPS_SALARY')).toBe(true);

    const shop = await runLaunch(newLaunch('run-7', 't', input('SMC-2026-44120', 'SHAMS'), deps.now()), deps);
    expect(shop.company!.vertical).toBe('ECOMMERCE');
    expect(shop.finance!.accounts.some((a) => a.code === '1270')).toBe(true);
  });
});

describe('building blocks', () => {
  it('first financial year is 6–18 months', () => {
    expect(firstFinancialYearEnd('2026-03-15')).toBe('2026-12-31');
    expect(firstFinancialYearEnd('2026-07-01')).toBe('2026-12-31');
    expect(firstFinancialYearEnd('2026-07-02')).toBe('2027-12-31');
    expect(firstFinancialYearEnd('2026-09-29')).toBe('2027-12-31');
  });

  it('plans follow headcount bands and carry no invented prices', () => {
    expect([1, 5, 6, 50, 51, 400].map((h) => recommendPlan(h).code)).toEqual(['LAUNCH', 'LAUNCH', 'GROW', 'GROW', 'SCALE', 'SCALE']);
    expect(recommendPlan(3).price).toEqual({ baseMinor: null, perEmployeeMinor: null, quoted: false });
    expect(() => recommendPlan(0)).toThrow();
  });

  it('chart of accounts has unique codes, VAT control accounts and CT tags', () => {
    for (const v of ['PROFESSIONAL_SERVICES', 'TRADING', 'ECOMMERCE', 'CONTRACTING', 'OTHER'] as const) {
      const coa = chartOfAccounts('e', v);
      expect(new Set(coa.map((a) => a.code)).size).toBe(coa.length);
      expect(coa.filter((a) => a.control === 'VAT').map((a) => a.code)).toEqual(['1300', '2200']);
      expect(coa.find((a) => a.code === '6900')!.ctTreatment).toBe('NON_DEDUCTIBLE');
    }
  });
});
