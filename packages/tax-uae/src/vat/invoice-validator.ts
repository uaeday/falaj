import { type Money, isValidTrn } from '@falaj/core';
import type { RegulatoryConfig } from '@falaj/core';

/**
 * Tax-invoice mandatory-particulars check (F-AR-03). The field list follows the VAT Executive Regulation
 * (Art. 59 as understood; VERIFY against the amended regulation). The result is stored with the invoice as evidence.
 */
export interface TaxInvoiceDraft {
  kind: 'TAX_INVOICE' | 'SIMPLIFIED_TAX_INVOICE';
  title: string;
  number: string;
  issueDate: string;
  supplyDate?: string;
  currency: string;
  supplier: { name: string; address: string; trn: string };
  recipient: { name?: string; address?: string; trn?: string; isVatRegistered: boolean };
  lines: { description: string; quantity: string; unitPrice: Money; net: Money; vat: Money; rate: string }[];
  totalVat: Money;
  /** Total VAT expressed in AED, required when the invoice is in another currency. */
  totalVatAed?: Money;
  fxRate?: string;
  totalPayable: Money;
}

export type InvoiceIssueCode =
  | 'TITLE_MISSING'
  | 'SUPPLIER_TRN_INVALID'
  | 'SUPPLIER_DETAILS_MISSING'
  | 'NUMBER_MISSING'
  | 'RECIPIENT_TRN_REQUIRED'
  | 'RECIPIENT_TRN_INVALID'
  | 'RECIPIENT_DETAILS_MISSING'
  | 'LINE_DESCRIPTION_MISSING'
  | 'VAT_TOTAL_MISMATCH'
  | 'VAT_AED_REQUIRED'
  | 'SIMPLIFIED_NOT_ALLOWED';

export interface InvoiceValidation {
  status: 'PASS' | 'FAIL';
  issues: { code: InvoiceIssueCode; message: string }[];
}

export function validateTaxInvoice(inv: TaxInvoiceDraft, config: RegulatoryConfig): InvoiceValidation {
  const issues: InvoiceValidation['issues'] = [];
  const add = (code: InvoiceIssueCode, message: string) => issues.push({ code, message });

  if (!/tax invoice/i.test(inv.title) && !inv.title.includes('فاتورة ضريبية')) add('TITLE_MISSING', 'Document must be titled "Tax Invoice"');
  if (!inv.supplier.name.trim() || !inv.supplier.address.trim()) add('SUPPLIER_DETAILS_MISSING', 'Supplier name and address are required');
  if (!isValidTrn(inv.supplier.trn)) add('SUPPLIER_TRN_INVALID', 'Supplier TRN must be 15 digits');
  if (!inv.number.trim()) add('NUMBER_MISSING', 'A sequential invoice number is required');

  if (inv.recipient.isVatRegistered) {
    if (!inv.recipient.trn) add('RECIPIENT_TRN_REQUIRED', 'Recipient is VAT-registered; their TRN is required');
    else if (!isValidTrn(inv.recipient.trn)) add('RECIPIENT_TRN_INVALID', 'Recipient TRN must be 15 digits');
  }
  if (inv.kind === 'TAX_INVOICE' && (!inv.recipient.name?.trim() || !inv.recipient.address?.trim())) {
    add('RECIPIENT_DETAILS_MISSING', 'Full tax invoices need the recipient name and address');
  }
  inv.lines.forEach((l, i) => {
    if (!l.description.trim()) add('LINE_DESCRIPTION_MISSING', `Line ${i + 1} needs a description`);
  });

  const lineVat = inv.lines.reduce((a, l) => a + l.vat.minor, 0n);
  if (lineVat !== inv.totalVat.minor) add('VAT_TOTAL_MISMATCH', 'Total VAT must equal the sum of line VAT');
  if (inv.currency !== 'AED' && (!inv.totalVatAed || inv.totalVatAed.currency !== 'AED' || !inv.fxRate)) {
    add('VAT_AED_REQUIRED', 'Foreign-currency invoices must show the VAT amount in AED and the rate used');
  }

  if (inv.kind === 'SIMPLIFIED_TAX_INVOICE' && inv.recipient.isVatRegistered) {
    const max = config.value('vat.simplified_invoice.max_total', inv.issueDate);
    const payableAed = inv.currency === 'AED' ? inv.totalPayable : inv.fxRate ? inv.totalPayable.convert(inv.fxRate, 'AED') : undefined;
    if (!payableAed || payableAed.minor > BigInt(max) * 100n) {
      add('SIMPLIFIED_NOT_ALLOWED', `Simplified invoices to registered recipients are limited to AED ${max}`);
    }
  }

  return { status: issues.length ? 'FAIL' : 'PASS', issues };
}
