/**
 * E-invoicing (MD 243 & 244/2025, PINT-AE over Peppol 5-corner model) — PORTS ONLY in this scaffold.
 *
 * Deliberately not implemented yet: the UBL 2.1 PINT-AE renderer. Its CustomizationID/ProfileID values, mandatory
 * business terms and schematron rules must be taken from the official MoF/FTA PINT-AE specification and validation
 * artefacts (VERIFY latest version), not written from memory. Epic E-07 implements it against those artefacts.
 */
import type { Money } from '@falaj/core';

export type TransmissionStatus = 'QUEUED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'REPORTED_TO_FTA';

export interface EInvoiceDocument {
  invoiceId: string;
  kind: 'INVOICE' | 'CREDIT_NOTE';
  /** UBL 2.1 PINT-AE XML, validated before submission. */
  xml: string;
  sha256: string;
  sellerTrn: string;
  buyerTrn?: string;
  total: Money;
}

export interface AspSubmission {
  aspMessageId: string;
  status: TransmissionStatus;
  receivedAt: string;
  raw?: unknown;
}

export interface AspRejection {
  code: string;
  message: string;
  field?: string;
}

/** Port implemented once per Accredited Service Provider (≥ 2 in Phase 1 for resilience). */
export interface AccreditedServiceProvider {
  readonly code: string;
  /** Must be idempotent on `idempotencyKey`: retries after timeouts must not create duplicates. */
  submit(doc: EInvoiceDocument, idempotencyKey: string): Promise<AspSubmission>;
  status(aspMessageId: string): Promise<{ status: TransmissionStatus; rejections?: AspRejection[] }>;
  /** Inbound supplier e-invoices addressed to the tenant's participant id. */
  fetchInbound(since: string): Promise<EInvoiceDocument[]>;
}

/** Renders and validates PINT-AE XML. Implemented in E-07 against the official validation artefacts. */
export interface PintAeRenderer {
  render(invoice: unknown): Promise<{ xml: string; sha256: string }>;
  validate(xml: string): Promise<{ valid: boolean; errors: { rule: string; message: string }[] }>;
}
