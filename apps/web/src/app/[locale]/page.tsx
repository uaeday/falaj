import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mark } from '@/components/mark';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';

const PILLARS = ['signup', 'provisioned', 'compliant'] as const;
const PHASES = ['p1', 'p2', 'p3', 'p4'] as const;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const brand = await getTranslations('brand');

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-6">
      <SiteHeader active="home" />

      <section className="grid gap-6 border-t border-[var(--line)] py-14">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1 className="max-w-[18ch] font-display text-[clamp(2.4rem,7vw,4.6rem)] font-light leading-[1.02] tracking-[-0.03em] text-[var(--mark)]">
          {t('title')}
        </h1>
        <p className="max-w-[60ch] text-lg text-[var(--muted)]">{t('lead')}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/launch" className="rounded-lg bg-palm px-5 py-2.5 font-medium text-limestone hover:bg-channel">
            {t('cta')}
          </Link>
          <Link href="/ledger" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 hover:border-[var(--accent)]">
            {t('secondary')}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl bg-channel p-8 text-white sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p} className="grid content-start gap-2 border-t-2 border-spring pt-4">
            <h2 className="font-display text-xl font-medium">{t(`pillars.${p}.title`)}</h2>
            <p className="text-[0.95rem] text-[#E4F1EE]">{t(`pillars.${p}.body`)}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 py-12">
        <h2 className="font-display text-2xl font-medium">{t('phases')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((p, i) => (
            <div key={p} className={`grid content-start gap-2 rounded-[10px] border p-5 ${i === 0 ? 'border-[var(--accent)] bg-[var(--surface)]' : 'border-[var(--line)] bg-[var(--surface)]'}`}>
              <span className="num text-xs text-[var(--muted)]">{String(i + 1).padStart(2, '0')} · {t(`phase.${p}.when`)}</span>
              <h3 className="font-display text-lg font-medium">{t(`phase.${p}.name`)}</h3>
              <p className="text-sm text-[var(--muted)]">{t(`phase.${p}.body`)}</p>
              {i === 0 && <span className="mt-1 w-fit rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">{t('now')}</span>}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-6 flex items-center gap-2 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        <Mark size={16} className="text-[var(--mark)]" />
        {brand('tagline')}
      </footer>
    </div>
  );
}
