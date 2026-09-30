import { aed } from '@falaj/core';
import { describe, expect, it } from 'vitest';
import { type TaxInvoiceDraft, defaultUaeConfig, validateTaxInvoice } from '../src/index.ts';

const config = defaultUaeConfig();

const base: TaxInvoiceDraft = {
  kind: 'TAX_INVOICE',
  title: 'Tax Invoice / فاتورة ضريبية',
  number: 'INV-2027-0418',
  issueDate: '2027-02-10',
  currency: 'AED',
  supplier: { name: 'Al Qattara Trading LLC', address: 'Al Quoz, Dubai', trn: '100234567890003' },
  recipient: { name: 'Gulf Builders LLC', address: 'Musaffah, Abu Dhabi', trn: '100987654321003', isVatRegistered: true },
  lines: [{ description: 'Chilled display unit', quantity: '2', unitPrice: aed('4500'), net: aed('9000'), vat: aed('450'), rate: '0.05' }],
  totalVat: aed('450'),
  totalPayable: aed('9450'),
};

describe('tax invoice validator (US-03.4)', () => {
  it('passes a complete invoice', () => {
    expect(validateTaxInvoice(base, config)).toEqual({ status: 'PASS', issues: [] });
  });

  it('blocks a registered recipient without TRN', () => {
    const r = validateTaxInvoice({ ...base, recipient: { ...base.recipient, trn: undefined as unknown as string } }, config);
    expect(r.issues.map((i) => i.code)).toEqual(['RECIPIENT_TRN_REQUIRED']);
  });

  it('requires the title, a valid supplier TRN and consistent VAT', () => {
    const r = validateTaxInvoice({ ...base, title: 'Invoice', supplier: { ...base.supplier, trn: '123' }, totalVat: aed('451') }, config);
    expect(r.issues.map((i) => i.code)).toEqual(['TITLE_MISSING', 'SUPPLIER_TRN_INVALID', 'VAT_TOTAL_MISMATCH']);
  });

  it('foreign-currency invoices must show VAT in AED', () => {
    const r = validateTaxInvoice({ ...base, currency: 'USD' }, config);
    expect(r.issues.map((i) => i.code)).toContain('VAT_AED_REQUIRED');
  });

  it('simplified invoices to registered recipients are capped (configured amount)', () => {
    const simplified = { ...base, kind: 'SIMPLIFIED_TAX_INVOICE' as const };
    expect(validateTaxInvoice(simplified, config).status).toBe('PASS');
    const big = { ...simplified, totalPayable: aed('10000.01') };
    expect(validateTaxInvoice(big, config).issues.map((i) => i.code)).toEqual(['SIMPLIFIED_NOT_ALLOWED']);
    const toConsumer = { ...big, recipient: { isVatRegistered: false } };
    expect(validateTaxInvoice(toConsumer, config).status).toBe('PASS');
  });
});
