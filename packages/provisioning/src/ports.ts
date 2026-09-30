/** Licensed open-finance provider (CBUAE framework): Falaj never touches credentials or funds. */
export interface OpenFinanceProvider {
  createConsent(input: { companyId: string; legalName: string; redirectUrl: string }, idempotencyKey: string): Promise<{ consentId: string; url: string }>;
  status(consentId: string): Promise<'PENDING' | 'AUTHORISED' | 'REJECTED' | 'EXPIRED'>;
}

/** Accredited e-invoicing Service Provider onboarding (participant registration on the Peppol network). */
export interface AspOnboarding {
  requestOnboarding(input: { legalName: string; licenceNo: string; email: string }, idempotencyKey: string): Promise<{ requestId: string; status: 'REQUESTED' | 'ACTIVE' }>;
}

export class FakeOpenFinance implements OpenFinanceProvider {
  readonly consents = new Map<string, 'PENDING' | 'AUTHORISED' | 'REJECTED' | 'EXPIRED'>();
  async createConsent(input: { companyId: string }, key: string) {
    const id = `consent-${key}`;
    if (!this.consents.has(id)) this.consents.set(id, 'PENDING');
    return { consentId: id, url: `https://openfinance.example/consent/${id}?company=${encodeURIComponent(input.companyId)}` };
  }
  async status(id: string) {
    return this.consents.get(id) ?? 'EXPIRED';
  }
  authorise(id: string) {
    this.consents.set(id, 'AUTHORISED');
  }
}

export class FakeAspOnboarding implements AspOnboarding {
  readonly requests: string[] = [];
  async requestOnboarding(_input: { legalName: string }, key: string) {
    if (!this.requests.includes(key)) this.requests.push(key);
    return { requestId: `asp-${key}`, status: 'REQUESTED' as const };
  }
}
