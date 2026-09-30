import type { Company, Person } from '@falaj/company';

export type EmailProviderCode = 'M365' | 'GOOGLE';

export interface MailboxPlan {
  address: string;
  displayName: string;
  kind: 'PERSON' | 'ROLE';
  personId?: string;
  /** Role mailboxes are shared inboxes / aliases, not paid seats. */
  purpose?: string;
}

/** Only ASCII local parts; Arabic-only names fall back to a role or are completed by the user. */
const localPart = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

/**
 * Mailboxes for everyone on the licence plus the role inboxes a UAE company needs from day one
 * (accounts@ receives supplier invoices and FTA mail; info@ goes on the website and invoices).
 */
export function planMailboxes(company: Company, domain: string, extraPeople: Person[] = []): MailboxPlan[] {
  const taken = new Set<string>();
  const plans: MailboxPlan[] = [];
  const reserve = (lp: string) => {
    let candidate = lp;
    for (let i = 2; taken.has(candidate); i++) candidate = `${lp}${i}`;
    taken.add(candidate);
    return candidate;
  };
  for (const role of ['info', 'accounts']) taken.add(role);

  for (const p of [...company.people, ...extraPeople]) {
    const parts = p.name.en.split(/\s+/).map(localPart).filter(Boolean);
    if (!parts.length) continue;
    const first = parts[0]!;
    const last = parts.at(-1)!;
    const lp = reserve(taken.has(first) && parts.length > 1 ? `${first}.${last}` : first);
    plans.push({ address: `${lp}@${domain}`, displayName: p.name.en, kind: 'PERSON', personId: p.id });
  }
  plans.push(
    { address: `info@${domain}`, displayName: company.tradeName.en, kind: 'ROLE', purpose: 'Website, invoices and general enquiries' },
    { address: `accounts@${domain}`, displayName: `${company.tradeName.en} Accounts`, kind: 'ROLE', purpose: 'Supplier invoices, FTA and bank correspondence' },
  );
  return plans;
}

export interface DnsRecord {
  type: 'MX' | 'TXT' | 'CNAME' | 'A';
  host: string;
  value: string;
  priority?: number;
  purpose: string;
}

/**
 * Vendor DNS profiles. Values follow each vendor's published setup guidance as understood on 2026-10-01
 * (VERIFY against the reseller's onboarding API, which is authoritative and returns tenant-specific values).
 */
export function emailDnsRecords(domain: string, provider: EmailProviderCode, verificationToken: string): DnsRecord[] {
  const dmarc: DnsRecord = { type: 'TXT', host: '_dmarc', value: `v=DMARC1; p=quarantine; rua=mailto:accounts@${domain}`, purpose: 'DMARC policy' };
  if (provider === 'M365') {
    return [
      { type: 'TXT', host: '@', value: `MS=${verificationToken}`, purpose: 'Domain ownership verification' },
      { type: 'MX', host: '@', value: `${domain.replace(/\./g, '-')}.mail.protection.outlook.com`, priority: 0, purpose: 'Mail delivery' },
      { type: 'TXT', host: '@', value: 'v=spf1 include:spf.protection.outlook.com -all', purpose: 'SPF' },
      { type: 'CNAME', host: 'autodiscover', value: 'autodiscover.outlook.com', purpose: 'Outlook autodiscover' },
      dmarc,
    ];
  }
  return [
    { type: 'TXT', host: '@', value: `google-site-verification=${verificationToken}`, purpose: 'Domain ownership verification' },
    { type: 'MX', host: '@', value: 'smtp.google.com', priority: 1, purpose: 'Mail delivery' },
    { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.google.com ~all', purpose: 'SPF' },
    dmarc,
  ];
}

/** Website records pointing the apex and www at Falaj Sites hosting (hostnames are config; placeholder values). */
export function websiteDnsRecords(sitesHost: { apexIp: string; cname: string }): DnsRecord[] {
  return [
    { type: 'A', host: '@', value: sitesHost.apexIp, purpose: 'Website (apex)' },
    { type: 'CNAME', host: 'www', value: sitesHost.cname, purpose: 'Website (www)' },
  ];
}
