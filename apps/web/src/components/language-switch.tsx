'use client';

import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';

/** Switches language on the same page, keeping the query (e.g. the selected licence). */
export function LanguageSwitch({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const query = Object.fromEntries(useSearchParams().entries());
  return (
    <Link
      href={{ pathname, query }}
      locale={locale === 'ar' ? 'en' : 'ar'}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-sm hover:border-[var(--accent)]"
    >
      {label}
    </Link>
  );
}
