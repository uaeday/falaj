import { Money, parseDecimal } from '@falaj/core';
import type { RegulatoryConfig } from '@falaj/core';
import { VAT_CODES, type VatCode } from './codes.ts';

export type PriceMode = 'EXCLUSIVE' | 'INCLUSIVE';

export interface VatLineInput {
  /** Decimal quantity, e.g. "2" or "1.5". */
  quantity: string;
  unitPrice: Money;
  discount?: Money;
  code: VatCode;
  priceMode?: PriceMode;
}

export interface VatLineResult {
  code: VatCode;
  rate: string;
  net: Money;
  /** VAT charged on the document (0 for reverse charge). */
  vat: Money;
  /** VAT the recipient self-accounts under reverse charge (0 otherwise). */
  selfAccountedVat: Money;
  gross: Money;
}

export function vatRate(code: VatCode, date: string, config: RegulatoryConfig): string {
  return VAT_CODES[code].standardRated ? config.value('vat.rate.standard', date) : '0';
}

/** 1 + rate as a decimal string, e.g. "0.05" → "1.05". */
function onePlus(rate: string): string {
  const { units, scale } = parseDecimal(rate);
  const one = 10n ** BigInt(scale);
  const total = (one + units).toString().padStart(scale + 1, '0');
  return scale ? `${total.slice(0, -scale)}.${total.slice(-scale)}` : total;
}

/**
 * Per-line VAT with half-up rounding to the fils (F-VAT-06). Line-level rounding is applied consistently;
 * document VAT is the sum of line VAT. Whether invoice-level rounding is also acceptable is VERIFY (FTA).
 */
export function calculateVatLine(line: VatLineInput, ctx: { date: string; config: RegulatoryConfig }): VatLineResult {
  const def = VAT_CODES[line.code];
  const rate = vatRate(line.code, ctx.date, ctx.config);
  const extended = line.unitPrice.multiply(line.quantity);
  const discounted = line.discount ? extended.subtract(line.discount) : extended;
  if (discounted.isNegative()) throw new RangeError('Discount exceeds line value');

  const zero = Money.zero(line.unitPrice.currency);
  if (def.reverseCharge) {
    return { code: line.code, rate, net: discounted, vat: zero, selfAccountedVat: discounted.multiply(rate), gross: discounted };
  }
  if (line.priceMode === 'INCLUSIVE') {
    const net = discounted.divide(onePlus(rate));
    return { code: line.code, rate, net, vat: discounted.subtract(net), selfAccountedVat: zero, gross: discounted };
  }
  const vat = discounted.multiply(rate);
  return { code: line.code, rate, net: discounted, vat, selfAccountedVat: zero, gross: discounted.add(vat) };
}

export interface VatDocumentResult {
  lines: VatLineResult[];
  net: Money;
  vat: Money;
  gross: Money;
  /** VAT and net grouped by rate for the tax summary block of a tax invoice. */
  byRate: { rate: string; net: Money; vat: Money }[];
}

export function calculateVatDocument(lines: readonly VatLineInput[], ctx: { date: string; config: RegulatoryConfig }): VatDocumentResult {
  if (lines.length === 0) throw new RangeError('A document needs at least one line');
  const results = lines.map((l) => calculateVatLine(l, ctx));
  const cur = results[0]!.net.currency;
  const sum = (pick: (r: VatLineResult) => Money) => results.reduce((a, r) => a.add(pick(r)), Money.zero(cur));
  const byRate = new Map<string, { rate: string; net: Money; vat: Money }>();
  for (const r of results) {
    const g = byRate.get(r.rate) ?? { rate: r.rate, net: Money.zero(cur), vat: Money.zero(cur) };
    byRate.set(r.rate, { rate: r.rate, net: g.net.add(r.net), vat: g.vat.add(r.vat) });
  }
  return { lines: results, net: sum((r) => r.net), vat: sum((r) => r.vat), gross: sum((r) => r.gross), byRate: [...byRate.values()] };
}
