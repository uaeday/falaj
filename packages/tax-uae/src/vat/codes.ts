/**
 * VAT treatments under FDL 8/2017. Box numbers follow the FTA VAT201 form (VERIFY against the current EmaraTax form).
 */
export type VatCode = 'SR' | 'ZR' | 'EX' | 'OOS' | 'RC_SVC' | 'RC_IMP' | 'RC_DOM';

export interface VatCodeDef {
  code: VatCode;
  label: { en: string; ar: string };
  /** Whether the standard rate applies (otherwise 0%). */
  standardRated: boolean;
  /** Reverse charge: the recipient self-accounts; the supplier charges no VAT on the invoice. */
  reverseCharge: boolean;
}

export const VAT_CODES: Record<VatCode, VatCodeDef> = {
  SR: { code: 'SR', label: { en: 'Standard-rated', ar: 'خاضع للنسبة الأساسية' }, standardRated: true, reverseCharge: false },
  ZR: { code: 'ZR', label: { en: 'Zero-rated', ar: 'خاضع لنسبة الصفر' }, standardRated: false, reverseCharge: false },
  EX: { code: 'EX', label: { en: 'Exempt', ar: 'معفى' }, standardRated: false, reverseCharge: false },
  OOS: { code: 'OOS', label: { en: 'Out of scope', ar: 'خارج نطاق الضريبة' }, standardRated: false, reverseCharge: false },
  RC_SVC: { code: 'RC_SVC', label: { en: 'Reverse charge – imported services', ar: 'احتساب عكسي – خدمات مستوردة' }, standardRated: true, reverseCharge: true },
  RC_IMP: { code: 'RC_IMP', label: { en: 'Reverse charge – imported goods', ar: 'احتساب عكسي – سلع مستوردة' }, standardRated: true, reverseCharge: true },
  RC_DOM: { code: 'RC_DOM', label: { en: 'Domestic reverse charge (designated goods)', ar: 'احتساب عكسي محلي' }, standardRated: true, reverseCharge: true },
};

export const isVatCode = (v: string): v is VatCode => v in VAT_CODES;
