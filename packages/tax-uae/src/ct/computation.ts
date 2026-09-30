import { Money } from '@falaj/core';
import type { RegulatoryConfig } from '@falaj/core';

/**
 * Corporate Tax working paper (F-CT-02/03). Every adjustment keeps its source references, so each figure
 * drills down to journals. NOT TAX ADVICE: the adjustment catalogue must be reviewed by a registered tax agent.
 */
export interface CtAdjustment {
  code: string;
  description: string;
  /** Positive adds back to taxable income, negative deducts. AED. */
  amount: Money;
  sourceRefs?: string[];
}

export interface CtInput {
  periodStart: string;
  periodEnd: string;
  revenue: Money;
  accountingProfit: Money;
  adjustments: readonly CtAdjustment[];
  sbr?: { elected: boolean; revenueExceededInPriorPeriod: boolean };
  /** Rules in force as of this date (default: period end). */
  asOf?: string;
}

export interface CtResult {
  accountingProfit: Money;
  totalAdjustments: Money;
  taxableIncome: Money;
  zeroRateBand: Money;
  rate: string;
  taxPayable: Money;
  sbr: { applied: boolean; reason: string };
  adjustments: readonly CtAdjustment[];
}

const aedWhole = (value: string) => Money.fromDecimal(value, 'AED');

export function sbrEligibility(input: CtInput, config: RegulatoryConfig): { applied: boolean; reason: string } {
  const asOf = input.asOf ?? input.periodEnd;
  if (!input.sbr?.elected) return { applied: false, reason: 'Small Business Relief not elected' };
  if (input.sbr.revenueExceededInPriorPeriod) return { applied: false, reason: 'Threshold exceeded in a prior period' };
  const threshold = aedWhole(config.value('ct.sbr.revenue_threshold', asOf));
  if (input.revenue.compare(threshold) > 0) return { applied: false, reason: `Revenue exceeds AED ${threshold.toDecimalString()}` };
  const lastEnd = config.value('ct.sbr.last_period_end', asOf);
  if (input.periodEnd > lastEnd) return { applied: false, reason: `SBR only covers tax periods ending on or before ${lastEnd}` };
  return { applied: true, reason: 'Small Business Relief applies: taxable income treated as nil' };
}

export function computeCorporateTax(input: CtInput, config: RegulatoryConfig): CtResult {
  const asOf = input.asOf ?? input.periodEnd;
  const zero = Money.zero('AED');
  const totalAdjustments = input.adjustments.reduce((a, x) => a.add(x.amount), zero);
  const band = aedWhole(config.value('ct.zero_rate_band', asOf));
  const rate = config.value('ct.rate.standard', asOf);
  const sbr = sbrEligibility(input, config);

  const computed = input.accountingProfit.add(totalAdjustments);
  const taxableIncome = sbr.applied || computed.isNegative() ? zero : computed;
  const excess = taxableIncome.subtract(band);
  const taxPayable = excess.isPositive() ? excess.multiply(rate) : zero;

  return { accountingProfit: input.accountingProfit, totalAdjustments, taxableIncome, zeroRateBand: band, rate, taxPayable, sbr, adjustments: input.adjustments };
}

/** Add-back for entertainment spend (share disallowed per config). */
export function entertainmentAddBack(spend: Money, date: string, config: RegulatoryConfig, refs: string[] = []): CtAdjustment {
  return {
    code: 'ENTERTAINMENT',
    description: 'Client entertainment: non-deductible share',
    amount: spend.multiply(config.value('ct.entertainment.disallowed_share', date)),
    sourceRefs: refs,
  };
}

/** QFZP de-minimis monitor (F-CT-05): limit is the lower of a share of total revenue and an absolute cap. */
export function qfzpDeMinimis(totalRevenue: Money, nonQualifyingRevenue: Money, date: string, config: RegulatoryConfig) {
  const byShare = totalRevenue.multiply(config.value('ct.qfzp.de_minimis.share', date));
  const absolute = aedWhole(config.value('ct.qfzp.de_minimis.absolute', date));
  const limit = byShare.compare(absolute) <= 0 ? byShare : absolute;
  return { limit, headroom: limit.subtract(nonQualifyingRevenue), breached: nonQualifyingRevenue.compare(limit) > 0 };
}
