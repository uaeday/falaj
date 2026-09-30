import type { DnsRecord, EmailProviderCode, MailboxPlan } from './email.ts';

export interface DomainAvailability {
  domain: string;
  available: boolean;
  /** Registration price as quoted by the registrar partner, if any. */
  priceMinor?: bigint;
}

/** Accredited registrar partner (strategy: Partner). Falaj never runs its own registry connection. */
export interface DomainRegistrar {
  check(domains: string[]): Promise<DomainAvailability[]>;
  /** Idempotent on `idempotencyKey`. */
  register(domain: string, registrant: { legalName: string; licenceNo: string; email: string }, idempotencyKey: string): Promise<{ orderId: string }>;
  setDns(domain: string, records: DnsRecord[]): Promise<void>;
}

/** White-label email reseller (M365 or Google Workspace). Falaj provisions and bills; the vendor runs mail. */
export interface EmailProvider {
  readonly code: EmailProviderCode;
  createTenant(domain: string, idempotencyKey: string): Promise<{ tenantRef: string; verificationToken: string }>;
  verifyDomain(tenantRef: string, domain: string): Promise<'VERIFIED' | 'PENDING'>;
  createMailbox(tenantRef: string, mailbox: MailboxPlan): Promise<{ id: string }>;
}
