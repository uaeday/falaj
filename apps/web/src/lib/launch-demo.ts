import 'server-only';
import { FixtureLicenceSource, SAMPLE_LICENCES, type TradeLicence } from '@falaj/company';
import { HashChain, verifyChain } from '@falaj/ledger';
import { FakeAspOnboarding, FakeOpenFinance, type LaunchState, licenceToLive, newLaunch, runLaunch } from '@falaj/provisioning';
import { FakeSitePublisher } from '@falaj/website';
import { FakeEmailProvider, FakeRegistrar } from '@falaj/workspace';

export const DEMO_LICENCES = SAMPLE_LICENCES.map((l) => ({ key: l.licenceNo, licence: l }));

const HEADCOUNT: Record<string, number> = { '1234567': 4, 'DMCC-876543': 12, 'SMC-2026-44120': 2 };
const REVENUE: Record<string, string> = { '1234567': '1500000', 'DMCC-876543': '18000000', 'SMC-2026-44120': '600000' };

/**
 * Runs the real launch saga against sandbox partners (registrar, email reseller, hosting, open finance, ASP).
 * The clock is simulated at 4 minutes per partner call, so the licence-to-live time shown is a model, not a measurement.
 */
export async function runDemoLaunch(licenceNo: string) {
  const entry = DEMO_LICENCES.find((d) => d.key === licenceNo) ?? DEMO_LICENCES[0]!;
  const l: TradeLicence = entry.licence;
  let t = Date.parse('2026-10-01T05:00:00Z');
  let id = 0;
  const chain = new HashChain();
  const registrar = new FakeRegistrar(new Set(['qattara.ae']));
  const sites = new FakeSitePublisher();
  const deps = {
    licences: new FixtureLicenceSource(SAMPLE_LICENCES),
    registrar,
    email: new FakeEmailProvider('M365'),
    sites,
    openFinance: new FakeOpenFinance(),
    asp: new FakeAspOnboarding(),
    audit: { record: (e: Parameters<HashChain['append']>[0]) => void chain.append(e) },
    now: () => new Date((t += 4 * 60_000)),
    newId: () => `demo-${++id}`,
    sitesHost: { apexIp: '203.0.113.10', cname: 'sites.falaj.ae' },
  };
  const state: LaunchState = await runLaunch(
    newLaunch(`demo-${l.licenceNo}`, 'demo-tenant', {
      licence: { authority: l.authority, licenceNo: l.licenceNo },
      emailProvider: 'M365',
      headcount: HEADCOUNT[l.licenceNo] ?? 3,
      contact: { whatsapp: l.parties.find((p) => p.mobile)?.mobile ?? '', phone: l.parties.find((p) => p.mobile)?.mobile ?? '' },
      partner: { partnerId: 'sample-setup-agent', type: 'SETUP_AGENT' },
      expectedAnnualRevenueAed: REVENUE[l.licenceNo] ?? '1000000',
    }, new Date(t)),
    deps,
  );
  const site = state.domain ? sites.published.get(state.domain) : undefined;
  return { state, kpi: licenceToLive(state), site, chain: verifyChain(chain.all()), licence: l };
}
