import type { DnsRecord, EmailProviderCode, MailboxPlan } from './email.ts';
import type { DomainAvailability, DomainRegistrar, EmailProvider } from './ports.ts';

/** In-memory registrar for tests, demos and the alpha sandbox. `taken` domains report unavailable. */
export class FakeRegistrar implements DomainRegistrar {
  readonly registered = new Map<string, string>();
  readonly dns = new Map<string, DnsRecord[]>();
  calls = 0;
  constructor(private readonly taken: ReadonlySet<string> = new Set(), private readonly failRegister = 0) {}

  async check(domains: string[]): Promise<DomainAvailability[]> {
    return domains.map((d) => ({ domain: d, available: !this.taken.has(d) && !this.registered.has(d), priceMinor: d.endsWith('.ae') ? 15_000n : 6_000n }));
  }

  async register(domain: string, _r: { legalName: string; licenceNo: string; email: string }, key: string) {
    this.calls++;
    if (this.calls <= this.failRegister) throw new Error('Registrar temporarily unavailable');
    const existing = [...this.registered.entries()].find(([, k]) => k === key);
    if (existing) return { orderId: `order-${existing[0]}` };
    if (this.taken.has(domain) || this.registered.has(domain)) throw new Error(`${domain} is not available`);
    this.registered.set(domain, key);
    return { orderId: `order-${domain}` };
  }

  async setDns(domain: string, records: DnsRecord[]) {
    this.dns.set(domain, records);
  }
}

export class FakeEmailProvider implements EmailProvider {
  readonly mailboxes: MailboxPlan[] = [];
  private readonly tenants = new Map<string, string>();
  constructor(readonly code: EmailProviderCode = 'M365') {}

  async createTenant(domain: string, key: string) {
    const ref = this.tenants.get(key) ?? `tenant-${domain}`;
    this.tenants.set(key, ref);
    return { tenantRef: ref, verificationToken: `ms${domain.length}${domain.replace(/\W/g, '').slice(0, 6)}` };
  }

  async verifyDomain() {
    return 'VERIFIED' as const;
  }

  async createMailbox(_ref: string, mailbox: MailboxPlan) {
    if (!this.mailboxes.some((m) => m.address === mailbox.address)) this.mailboxes.push(mailbox);
    return { id: mailbox.address };
  }
}
