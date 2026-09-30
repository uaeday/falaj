import { authority } from '@falaj/company';
import { nextOccurrences } from '@falaj/compliance';
import { PLANS, STEPS } from '@falaj/provisioning';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mark } from '@/components/mark';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';
import { DEMO_LICENCES, runDemoLaunch } from '@/lib/launch-demo';

const card = 'rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5 min-w-0';
const dot: Record<string, string> = {
  DONE: 'bg-[var(--accent)]',
  WAITING: 'bg-sarooj',
  FAILED: 'bg-sarooj',
  PENDING: 'bg-[var(--line)]',
};

export default async function Launch({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ licence?: string }>;
}) {
  const { locale } = await params;
  const { licence: picked } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('launch');
  const brand = await getTranslations('brand');
  const ar = locale === 'ar';
  const { state: s, kpi, site, chain, licence } = await runDemoLaunch(picked ?? DEMO_LICENCES[0]!.key);
  const c = s.company!;
  const name = (x: { en: string; ar?: string | undefined }) => (ar ? (x.ar ?? x.en) : x.en);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const plan = PLANS.find((p) => p.code === s.plan)!;
  const auth = authority(c.authority);
  const owner = c.people[0]!;
  const siteHtml = site?.files[ar ? 'ar/index.html' : 'index.html'];

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-6">
      <SiteHeader active="launch" />

      <section className="grid gap-3 border-t border-[var(--line)] py-10">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-medium leading-[1.1] tracking-[-0.01em] text-[var(--mark)]">{t('title')}</h1>
        <p className="max-w-[70ch] text-sm text-[var(--muted)]">{t('sample')}</p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-sm text-[var(--muted)]">{t('pick')}:</span>
          {DEMO_LICENCES.map((d) => (
            <Link
              key={d.key}
              href={{ pathname: '/launch', query: { licence: d.key } }}
              className={`rounded-full border px-3 py-1 text-sm ${d.key === licence.licenceNo ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'}`}
            >
              {name(d.licence.tradeName)}
            </Link>
          ))}
        </div>
      </section>

      {/* Scorecard metric #1 */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div className={`${card} grid gap-1`}>
          <small className="text-[0.78rem] text-[var(--muted)]">{t('kpi.time')}</small>
          <b className="text-[1.4rem] font-medium"><span className="num">{kpi.minutes ?? 0}</span> {t('minutesUnit')}</b>
          <span className={`text-[0.72rem] ${kpi.metTarget ? 'text-[var(--accent)]' : 'text-sarooj'}`}>{kpi.metTarget ? t('kpi.met') : t('kpi.target')}</span>
        </div>
        <div className={`${card} grid gap-1`}>
          <small className="text-[0.78rem] text-[var(--muted)]">{t('kpi.open')}</small>
          <b className="text-[1.1rem] font-medium">{kpi.openItems.length ? kpi.openItems.map((i) => t(`steps.${i}.title`)).join(' · ') : t('kpi.none')}</b>
          <span className="text-[0.72rem] text-[var(--muted)]">{t(`status.${s.status}`)}</span>
        </div>
        <div className={`${card} grid gap-1`}>
          <small className="text-[0.78rem] text-[var(--muted)]">{t('kpi.plan')}</small>
          <b className="text-[1.3rem] font-medium">{name(plan.name)}</b>
          <span className="text-[0.72rem] text-[var(--muted)]"><bdi className="num">[AED __]</bdi> · {t('kpi.price')}</span>
        </div>
        <div className={`${card} grid gap-1`}>
          <small className="text-[0.78rem] text-[var(--muted)]">{t('kpi.partner')}</small>
          <b className="text-[1.1rem] font-medium">{c.partner?.type === 'SETUP_AGENT' ? (ar ? 'وكيل تأسيس' : 'Setup agent') : '—'}</b>
          <span className="num text-[0.72rem] text-[var(--muted)]">{c.partner?.partnerId}</span>
        </div>
      </section>

      {/* The seven-step journey */}
      <section className={`${card} mt-4`}>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
          {STEPS.map((id, i) => {
            const st = s.steps[id];
            return (
              <li key={id} className={`grid content-start gap-1.5 border-t-4 pt-3 ${st.status === 'DONE' ? 'border-[var(--accent)]' : st.status === 'PENDING' ? 'border-[var(--line)]' : 'border-sarooj'}`}>
                <span className="font-display text-2xl leading-none text-[var(--accent)]">{i + 1}</span>
                <b className="font-display font-medium">{t(`steps.${id}.title`)}</b>
                <span className="text-xs text-[var(--muted)]">{t(`steps.${id}.body`)}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`inline-block h-2 w-2 rounded-full ${dot[st.status]}`} />
                  {t(`stepStatus.${st.status}`)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {s.steps.BANK.status === 'WAITING' && (
        <p className="mt-4 rounded-[10px] border-2 border-sarooj px-5 py-3 text-sm">{t('bankWaiting', { name: name(owner.name) })}</p>
      )}

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className={card}>
          <h2 className="mb-3 font-display text-lg font-medium">{t('company')}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-[var(--muted)]">{t('licence')}</dt>
            <dd><span className="num">{c.licenceNo}</span> · <span className="whitespace-nowrap">{date(c.licenceExpiryDate)}</span></dd>
            <dt className="text-[var(--muted)]">{t('authority')}</dt>
            <dd>{auth ? name(auth.name) : c.authority}</dd>
            <dt className="text-[var(--muted)]">{t('vertical')}</dt>
            <dd>{t(`verticals.${c.vertical}`)}</dd>
            <dt className="text-[var(--muted)]">{t('people')}</dt>
            <dd className="grid gap-0.5">
              {c.people.map((p) => (
                <span key={p.id}>
                  {name(p.name)}
                  {p.sharePct && <span className="num ms-1 text-[var(--muted)]">{p.sharePct}%</span>}
                  {s.uboCandidates?.includes(p.id) && <span className="ms-2 text-xs text-[var(--accent)]">{t('ubo')}</span>}
                </span>
              ))}
            </dd>
          </dl>
        </article>

        <article className={card}>
          <h2 className="mb-3 font-display text-lg font-medium">{t('workspace')}</h2>
          <p className="num mb-3 text-xl font-medium text-[var(--mark)]">{s.domain}</p>
          <h3 className="mb-1 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">{t('mailboxes')}</h3>
          <ul className="mb-3 grid gap-0.5 text-sm">
            {s.mailboxes?.map((m) => (
              <li key={m.address}>
                <span className="num">{m.address}</span>
                {m.kind === 'ROLE' && <span className="ms-2 text-xs text-[var(--muted)]">{t('role')}</span>}
              </li>
            ))}
          </ul>
          <h3 className="mb-1 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">{t('dns')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {s.dns?.map((r) => (
                  <tr key={`${r.type}${r.host}${r.value}`} className="border-t border-[var(--line)]">
                    <td className="num py-1 pe-2">{r.type}</td>
                    <td className="num py-1 pe-2">{r.host}</td>
                    <td className="num py-1 pe-2 break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className={`${card} mt-4`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-medium">{t('website')}</h2>
          <span className="num text-sm text-[var(--accent)]">{s.site?.url}</span>
        </div>
        {siteHtml && (
          <iframe title={t('website')} sandbox="" srcDoc={siteHtml} className="h-[440px] w-full rounded-lg border border-[var(--line)] bg-white" />
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">{t('websiteNote')}</p>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <article className={card}>
          <h2 className="mb-3 font-display text-lg font-medium">{t('books')}</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-[var(--muted)]">{t('accounts', { count: s.finance!.accounts.length })}</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {s.finance!.accounts.filter((a) => a.control || a.ctTreatment).map((a) => (
                  <span key={a.id} className="rounded bg-[var(--plate)] px-1.5 py-0.5 text-xs"><span className="num">{a.code}</span> {name(a.name)}</span>
                ))}
              </dd>
            </div>
            <div><dt className="text-[var(--muted)]">{t('firstYear')}</dt><dd>{date(s.finance!.firstFinancialYearEnd)}</dd></div>
            <div><dd className="text-[var(--accent)]">{t('asp')}</dd></div>
          </dl>
        </article>

        <article className={card}>
          <h2 className="mb-3 font-display text-lg font-medium">{t('calendar')}</h2>
          <ul className="grid gap-2 text-sm">
            {nextOccurrences(s.calendar ?? []).map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--line)] pt-2">
                <span>{ar ? o.title.ar : o.title.en}</span>
                <span className="flex items-center gap-2">
                  {o.verify && <span className="rounded-full bg-[color-mix(in_srgb,var(--color-sarooj)_16%,transparent)] px-2 py-0.5 text-[0.7rem] text-sarooj">{t('verify')}</span>}
                  {o.recurring && <span className="text-[0.7rem] text-[var(--muted)]">{t('recurring')}</span>}
                  <span className="whitespace-nowrap text-[var(--muted)] [font-variant-numeric:tabular-nums]">{o.due ? date(o.due) : t('ongoing')}</span>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <footer className="mt-10 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        <Mark size={16} className="text-[var(--mark)]" />
        {brand('tagline')}
        {chain.valid && <span className="ms-auto text-xs">{t('audit')} · <span className="num">{chain.head.slice(0, 12)}…</span></span>}
      </footer>
    </div>
  );
}
