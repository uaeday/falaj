import type { Money } from '@falaj/core';

const fmt = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Money for display: grouped, 2 dp, Western digits, LTR-isolated so it reads correctly inside Arabic text. */
export function Amount({ value, className = '' }: { value: Money; className?: string }) {
  const formatted = fmt.format(value.toDecimalString() as unknown as number);
  return <bdi className={`num ${className}`}>{formatted}</bdi>;
}
