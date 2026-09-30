import { EMIRATE_NAMES } from '@falaj/core';
import { BOX_LABELS, type Vat201BoxId } from '@falaj/tax-uae';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Amount } from '@/components/amount';
import { Mark } from '@/components/mark';
import { SiteHeader } from '@/components/site-header';
import { SAMPLE_INVOICE, buildDemo } from '@/lib/demo';

const SHOWN_BOXES: Vat201BoxId[] = ['1a', '1b', '3', '4', '8', '9', '10', '11', '14'];
const BOX_AR: Partial<Record<Vat201BoxId, string>> = {
  '1a': `التوريدات الخاضعة للنسبة الأساسية في ${EMIRATE_NAMES.AUH.ar}`,
  '1b': `التوريدات الخاضعة للنسبة الأساسية في ${EMIRATE_NAMES.DXB.ar}`,
  '3': 'التوريدات الخاضعة لآلية الاحتساب العكسي',
  '4': 'التوريدات الخاضعة لنسبة الصفر',
  '8': 'الإجمالي (المبيعات والمخرجات)',
  '9': 'النفقات الخاضعة للنسبة الأساسية',
  '10': 'التوريدات الخاضعة لآلية الاحتساب العكسي (المدخلات)',
  '11': 'الإجمالي (النفقات والمدخلات)',
  '14': 'الضريبة المستحقة الدفع عن الفترة',
};

const card = 'rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5 min-w-0';
const eyebrow = 'eyebrow';

export default async function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const tb = await getTranslations('dashboard.tb');
  const brand = await getTranslations('brand');
  const d = await buildDemo();
  const ar = locale === 'ar';
  const name = (x: { en: string; ar: string }) => (ar ? x.ar : x.en);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-6">
      <SiteHeader active="ledger" />

      <section className="grid gap-3 border-t border-[var(--line)] py-10">
        <span className={eyebrow}>{t('eyebrow')}</span>
        <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-medium leading-[1.1] tracking-[-0.01em] text-[var(--mark)]">{t('title')}</h1>
        <p className="text-[var(--muted)]">{t('entity')}</p>
        <p className="max-w-[65ch] text-sm text-[var(--muted)]">{t('sample')}</p>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi label={t('kpi.revenue')}><Amount value={d.revenue} /></Kpi>
        <Kpi label={t('kpi.vatPayable')}><Amount value={d.vat.netPayable} /></Kpi>
        <Kpi label={t('kpi.vatDue')}><span className="num">{date(d.vatDue)}</span></Kpi>
        <Kpi label={t('kpi.einvoice')} note={d.einvoice.provisional ? t('provisional') : undefined}>
          <span className="num">{date(d.einvoice.goLive)}</span>
        </Kpi>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* Tenant tax invoice: the customer's brand leads, falaj signs off */}
        <article className="grid min-w-0 content-start gap-4 rounded-lg border border-[#D5DCD7] bg-white p-6 text-[0.86rem] text-[#14201C]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-palm">
              <Mark size={24} />
              <span className="font-display text-lg font-medium">{name(SAMPLE_INVOICE.supplier)}</span>
            </div>
            <div className="text-end">
              <b className="block font-display text-lg font-medium">{t('invoice.title')}</b>
              <span className="num text-xs">{SAMPLE_INVOICE.number} · {SAMPLE_INVOICE.date}</span>
            </div>
          </div>
          <div className="text-xs text-[#5B6A64]">TRN · <span className="num">{SAMPLE_INVOICE.supplier.trn}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-palm text-start text-xs">
                  <th className="px-1 py-1.5 text-start font-medium">{t('invoice.item')}</th>
                  <th className="px-1 py-1.5 text-end font-medium">{t('invoice.qty')}</th>
                  <th className="px-1 py-1.5 text-end font-medium">{t('invoice.rate')}</th>
                  <th className="px-1 py-1.5 text-end font-medium">{t('invoice.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_INVOICE.lines.map((l, i) => (
                  <tr key={l.en} className="border-b border-[#E1E6E2]">
                    <td className="px-1 py-1.5">{name(l)}</td>
                    <td className="num px-1 py-1.5 text-end">{l.quantity}</td>
                    <td className="px-1 py-1.5 text-end"><Amount value={l.unitPrice} /></td>
                    <td className="px-1 py-1.5 text-end"><Amount value={d.invoice.lines[i]!.net} /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="px-1 py-1.5 text-end">{t('invoice.vat')}</td>
                  <td className="px-1 py-1.5 text-end"><Amount value={d.invoice.vat} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2 rounded-md bg-palm px-3.5 py-2.5 font-medium text-limestone">
            <span>{t('invoice.total')}</span>
            <span className="num">AED <Amount value={d.invoice.gross} /></span>
          </div>
          <p className="text-xs text-[#5B6A64]">{d.invoice.words.en}</p>
          <p lang="ar" dir="rtl" className="font-[family-name:var(--font-plex-arabic)] text-xs text-[#5B6A64]">{d.invoice.words.ar}</p>
          <div className="flex items-center gap-1.5 text-[0.7rem] text-[#5B6A64]">
            <Mark size={12} className="text-channel" />
            {t('invoice.issued')}
          </div>
        </article>

        <article className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-medium">{tb('title')}</h2>
            {d.tb.totalDebit.equals(d.tb.totalCredit) && <Pill tone="ok">{tb('balanced')}</Pill>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                  <th className="py-2 text-start font-medium">{tb('account')}</th>
                  <th className="py-2 text-end font-medium">{tb('debit')}</th>
                  <th className="py-2 text-end font-medium">{tb('credit')}</th>
                </tr>
              </thead>
              <tbody>
                {d.tb.rows.map((r) => (
                  <tr key={r.account.id} className="border-t border-[var(--line)] align-top">
                    <td className="py-1.5 pe-2">
                      <span className="me-2 inline-block text-[var(--muted)]"><span className="num">{r.account.code}</span></span>
                      {name(r.account.name)}
                      <span className="block text-[0.7rem] text-[var(--muted)]">{tb('lines', { count: r.lineRefs.length })}</span>
                    </td>
                    <td className="py-1.5 text-end">{r.net.isPositive() && <Amount value={r.net} />}</td>
                    <td className="py-1.5 text-end">{r.net.isNegative() && <Amount value={r.net.negate()} />}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--mark)] font-medium">
                  <td className="py-2">{tb('total')}</td>
                  <td className="py-2 text-end"><Amount value={sumSide(d.tb.rows, 1)} /></td>
                  <td className="py-2 text-end"><Amount value={sumSide(d.tb.rows, -1)} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="mb-3 font-display text-lg font-medium">{t('vat.title')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                <th className="py-2 text-start font-medium">{t('vat.box')}</th>
                <th className="py-2 text-start font-medium">{t('vat.description')}</th>
                <th className="py-2 text-end font-medium">{t('vat.amount')}</th>
                <th className="py-2 text-end font-medium">{t('vat.vat')}</th>
              </tr>
            </thead>
            <tbody>
              {SHOWN_BOXES.map((id) => {
                const b = d.vat.boxes[id];
                const total = id === '8' || id === '11' || id === '14';
                return (
                  <tr key={id} className={`border-t border-[var(--line)] ${total ? 'font-medium' : ''}`}>
                    <td className="py-1.5 pe-3"><span className="num">{id}</span></td>
                    <td className="py-1.5 pe-3">
                      {ar ? BOX_AR[id] : BOX_LABELS[id]}
                      {b.refs.length > 0 && <span className="num block text-[0.7rem] text-[var(--muted)]">{b.refs.join(' · ')}</span>}
                    </td>
                    <td className="py-1.5 text-end">{id !== '14' && <Amount value={b.amount} />}</td>
                    <td className="py-1.5 text-end"><Amount value={b.vat} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${card} mt-4 grid gap-2`}>
        <h2 className="font-display text-lg font-medium">{t('controls.title')}</h2>
        <Control ok={d.frozen}>{t('controls.immutable')} · {t('controls.entries', { count: d.entries })}</Control>
        <Control ok={d.chain.valid}>
          {t('controls.chain')}
          {d.chain.valid && <span className="num ms-2 text-xs text-[var(--muted)]">{d.chain.head.slice(0, 16)}…</span>}
        </Control>
      </section>

      <footer className="mt-10 flex items-center gap-2 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
        <Mark size={16} className="text-[var(--mark)]" />
        {brand('tagline')}
      </footer>
    </div>
  );
}

function sumSide(rows: Awaited<ReturnType<typeof buildDemo>>['tb']['rows'], sign: 1 | -1) {
  return rows.reduce((a, r) => ((sign === 1 ? r.net.isPositive() : r.net.isNegative()) ? a.add(r.net.abs()) : a), rows[0]!.net.subtract(rows[0]!.net));
}

function Kpi({ label, note, children }: { label: string; note?: string | undefined; children: React.ReactNode }) {
  return (
    <div className={`${card} grid gap-1`}>
      <small className="text-[0.78rem] text-[var(--muted)]">{label}</small>
      <b className="text-[1.3rem] font-medium">{children}</b>
      {note && <span className="text-[0.7rem] text-sarooj">{note}</span>}
    </div>
  );
}

function Pill({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const cls = tone === 'ok'
    ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]'
    : 'bg-[color-mix(in_srgb,var(--color-sarooj)_18%,transparent)] text-sarooj';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Control({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-[var(--accent)]' : 'bg-sarooj'}`} />
      {children}
    </p>
  );
}
