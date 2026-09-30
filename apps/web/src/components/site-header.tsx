import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { LanguageSwitch } from './language-switch';
import { Mark } from './mark';

export async function SiteHeader({ active }: { active: 'home' | 'launch' | 'ledger' }) {
  const t = await getTranslations('nav');
  const item = (key: 'home' | 'launch' | 'ledger', href: string) => (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 text-sm ${active === key ? 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] font-medium text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
    >
      {t(key)}
    </Link>
  );
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 py-6">
      <Link href="/" className="flex items-center gap-3 text-[var(--mark)]">
        <Mark size={34} />
        <span className="font-display text-[1.7rem] font-medium leading-none tracking-[-0.03em]">falaj</span>
        <span className="h-7 w-px bg-current opacity-30" />
        <span lang="ar" className="font-display text-[1.6rem] font-semibold leading-none">فلج</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1">
        {item('home', '/')}
        {item('launch', '/launch')}
        {item('ledger', '/ledger')}
        <span className="ms-2">
          <Suspense>
            <LanguageSwitch label={t('switch')} />
          </Suspense>
        </span>
      </nav>
    </header>
  );
}
