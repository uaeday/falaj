import { type Emirate, Money, type Result, err, ok } from '@falaj/core';
import { VAT_CODES, type VatCode } from './codes.ts';

/**
 * VAT201 builder (F-VAT-07). Input is tax-tagged ledger data; output is the return with a drill-down per box.
 * Box layout per the FTA VAT201 form (VERIFY against the current EmaraTax form before filing).
 */
export type Vat201BoxId =
  | '1a' | '1b' | '1c' | '1d' | '1e' | '1f' | '1g'
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14';

export const EMIRATE_BOX: Record<Emirate, Vat201BoxId> = {
  AUH: '1a', DXB: '1b', SHJ: '1c', AJM: '1d', UAQ: '1e', RAK: '1f', FUJ: '1g',
};

export const BOX_LABELS: Record<Vat201BoxId, string> = {
  '1a': 'Standard rated supplies in Abu Dhabi',
  '1b': 'Standard rated supplies in Dubai',
  '1c': 'Standard rated supplies in Sharjah',
  '1d': 'Standard rated supplies in Ajman',
  '1e': 'Standard rated supplies in Umm Al Quwain',
  '1f': 'Standard rated supplies in Ras Al Khaimah',
  '1g': 'Standard rated supplies in Fujairah',
  '2': 'Tax refunds provided to tourists under the Tax Refunds for Tourists Scheme',
  '3': 'Supplies subject to the reverse charge provisions',
  '4': 'Zero rated supplies',
  '5': 'Exempt supplies',
  '6': 'Goods imported into the UAE',
  '7': 'Adjustments to goods imported into the UAE',
  '8': 'Totals (sales and outputs)',
  '9': 'Standard rated expenses',
  '10': 'Supplies subject to the reverse charge provisions (inputs)',
  '11': 'Totals (expenses and inputs)',
  '12': 'Total value of due tax for the period',
  '13': 'Total value of recoverable tax for the period',
  '14': 'Payable tax for the period',
};

export interface VatTransaction {
  /** Drill-down reference, e.g. "JE-2027-000123#2" or a document number. */
  ref: string;
  date: string;
  direction: 'OUTPUT' | 'INPUT';
  code: VatCode;
  /** Taxable value in AED. */
  net: Money;
  /** VAT in AED (charged, or self-accounted for reverse charge). */
  vat: Money;
  /** Place of supply emirate. Required for standard-rated outputs. */
  emirate?: Emirate;
  /** Input tax recoverability; false for blocked categories (entertainment etc.). Default true. */
  recoverable?: boolean;
  blockedReason?: string;
  /** Output-side adjustments reported in special boxes. */
  adjustment?: 'TOURIST_REFUND' | 'IMPORT_ADJUSTMENT';
}

export interface Vat201Box {
  box: Vat201BoxId;
  label: string;
  amount: Money;
  vat: Money;
  refs: string[];
}

export interface Vat201Return {
  periodStart: string;
  periodEnd: string;
  boxes: Record<Vat201BoxId, Vat201Box>;
  /** Positive = payable to the FTA; negative = refundable / carried forward. */
  netPayable: Money;
  blockedInputs: VatTransaction[];
}

export interface Vat201Issue {
  ref: string;
  code: 'OUT_OF_PERIOD' | 'EMIRATE_REQUIRED' | 'NON_AED' | 'ZERO_RATED_WITH_VAT' | 'RC_ON_OUTPUT';
  message: string;
}

export function buildVat201(
  txns: readonly VatTransaction[],
  period: { start: string; end: string },
): Result<Vat201Return, Vat201Issue[]> {
  const zero = Money.zero('AED');
  const boxes = Object.fromEntries(
    (Object.keys(BOX_LABELS) as Vat201BoxId[]).map((b) => [b, { box: b, label: BOX_LABELS[b], amount: zero, vat: zero, refs: [] as string[] }]),
  ) as Record<Vat201BoxId, Vat201Box>;
  const issues: Vat201Issue[] = [];
  const blockedInputs: VatTransaction[] = [];

  const add = (id: Vat201BoxId, t: VatTransaction, amount: Money, vat: Money) => {
    const b = boxes[id];
    b.amount = b.amount.add(amount);
    b.vat = b.vat.add(vat);
    b.refs.push(t.ref);
  };

  for (const t of txns) {
    if (t.date < period.start || t.date > period.end) {
      issues.push({ ref: t.ref, code: 'OUT_OF_PERIOD', message: `${t.date} is outside ${period.start}–${period.end}` });
      continue;
    }
    if (t.net.currency !== 'AED' || t.vat.currency !== 'AED') {
      issues.push({ ref: t.ref, code: 'NON_AED', message: 'VAT201 amounts must be converted to AED first' });
      continue;
    }
    const def = VAT_CODES[t.code];

    if (t.direction === 'OUTPUT') {
      if (t.adjustment === 'TOURIST_REFUND') { add('2', t, t.net.negate(), t.vat.negate()); continue; }
      if (t.adjustment === 'IMPORT_ADJUSTMENT') { add('7', t, t.net, t.vat); continue; }
      if (def.reverseCharge) {
        issues.push({ ref: t.ref, code: 'RC_ON_OUTPUT', message: 'Reverse charge is declared by the recipient; record it on the purchase (supplier-side reporting of domestic RC supplies: VERIFY FTA)' });
        continue;
      }
      if (!def.standardRated && !t.vat.isZero()) {
        issues.push({ ref: t.ref, code: 'ZERO_RATED_WITH_VAT', message: `${t.code} supplies cannot carry VAT` });
        continue;
      }
      switch (t.code) {
        case 'SR':
          if (!t.emirate) { issues.push({ ref: t.ref, code: 'EMIRATE_REQUIRED', message: 'Standard-rated sales need an emirate' }); break; }
          add(EMIRATE_BOX[t.emirate], t, t.net, t.vat);
          break;
        case 'ZR': add('4', t, t.net, zero); break;
        case 'EX': add('5', t, t.net, zero); break;
        default: break; // OOS: not reported
      }
      continue;
    }

    // INPUT
    const recoverable = t.recoverable ?? true;
    if (def.reverseCharge) {
      add(t.code === 'RC_IMP' ? '6' : '3', t, t.net, t.vat); // self-accounted output tax
      if (recoverable) add('10', t, t.net, t.vat);
      else blockedInputs.push(t);
      continue;
    }
    if (t.code === 'SR') {
      if (recoverable) add('9', t, t.net, t.vat);
      else blockedInputs.push(t);
    }
    // ZR / EX / OOS purchases are not reported.
  }

  if (issues.length) return err(issues);

  const sum = (ids: Vat201BoxId[], pick: (b: Vat201Box) => Money) => ids.reduce((a, id) => a.add(pick(boxes[id])), zero);
  const outputs: Vat201BoxId[] = ['1a', '1b', '1c', '1d', '1e', '1f', '1g', '2', '3', '4', '5', '6', '7'];
  boxes['8'].amount = sum(outputs, (b) => b.amount);
  boxes['8'].vat = sum(outputs, (b) => b.vat);
  boxes['11'].amount = sum(['9', '10'], (b) => b.amount);
  boxes['11'].vat = sum(['9', '10'], (b) => b.vat);
  boxes['12'].vat = boxes['8'].vat;
  boxes['13'].vat = boxes['11'].vat;
  boxes['14'].vat = boxes['12'].vat.subtract(boxes['13'].vat);

  return ok({ periodStart: period.start, periodEnd: period.end, boxes, netPayable: boxes['14'].vat, blockedInputs });
}
