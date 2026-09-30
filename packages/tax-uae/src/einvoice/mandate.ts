import { Money } from '@falaj/core';
import type { RegulatoryConfig } from '@falaj/core';

export type EInvoiceBand = 'LARGE' | 'STANDARD' | 'GOVERNMENT';

export interface EInvoiceMandate {
  band: EInvoiceBand;
  aspDeadline: string;
  goLive: string;
  /** True while any underlying date is still marked verify in config. */
  provisional: boolean;
}

/** E-invoicing readiness calendar (F-EINV-06): dates come from config because they have been amended before. */
export function eInvoiceMandate(
  tenant: { annualRevenue: Money; isGovernment: boolean },
  asOf: string,
  config: RegulatoryConfig,
): EInvoiceMandate {
  const threshold = Money.fromDecimal(config.value('einvoice.large.revenue_threshold', asOf), 'AED');
  const band: EInvoiceBand = tenant.isGovernment ? 'GOVERNMENT' : tenant.annualRevenue.compare(threshold) >= 0 ? 'LARGE' : 'STANDARD';
  const prefix = `einvoice.${band.toLowerCase()}`;
  const asp = config.get(`${prefix}.asp_deadline`, asOf);
  const live = config.get(`${prefix}.go_live`, asOf);
  return { band, aspDeadline: asp.value, goLive: live.value, provisional: asp.verify || live.verify };
}
