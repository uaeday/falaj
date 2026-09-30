import { SAMPLE_LICENCES, companyFromLicence } from '@falaj/company';
import { describe, expect, it } from 'vitest';
import { emailDnsRecords, isValidLabel, nameWords, planMailboxes, suggestDomains } from '../src/index.ts';

let n = 0;
const company = (i: number) => {
  const r = companyFromLicence(SAMPLE_LICENCES[i]!, { tenantId: 't', today: '2026-10-01', now: 'x', newId: () => `p${++n}` });
  if (!r.ok) throw new Error();
  return r.value;
};

describe('domain suggestions (journey step 2)', () => {
  it('strips legal forms and punctuation', () => {
    expect(nameWords('Sidra Management Consultancy L.L.C')).toEqual(['sidra', 'management', 'consultancy']);
    expect(nameWords('Qattara Foods Trading DMCC')).toEqual(['qattara', 'foods', 'trading']);
    expect(nameWords('Nabta Online FZE')).toEqual(['nabta', 'online']);
    expect(nameWords('Café & Co. L.L.C')).toEqual(['cafe', 'and']);
  });

  it('suggests .ae first, then .com', () => {
    expect(suggestDomains('Sidra Consultancy', { max: 4 })).toEqual(['sidra.ae', 'sidra.com', 'sidraconsultancy.ae', 'sidraconsultancy.com']);
    expect(suggestDomains('Qattara Foods Trading DMCC', { max: 4 })).toEqual(['qattarafoods.ae', 'qattarafoods.com', 'qattara-foods.ae', 'qattara-foods.com']);
  });

  it('only emits valid DNS labels', () => {
    expect(isValidLabel('a-b')).toBe(true);
    expect(isValidLabel('-ab')).toBe(false);
    expect(isValidLabel('xn--abc')).toBe(false);
    expect(suggestDomains('الشركة')).toEqual([]);
    for (const d of suggestDomains('A very long name '.repeat(10))) expect(isValidLabel(d.split('.')[0]!)).toBe(true);
  });
});

describe('mailboxes and DNS (journey step 3)', () => {
  it('one mailbox per licence party plus info@ and accounts@', () => {
    expect(planMailboxes(company(0), 'sidra.ae').map((m) => m.address)).toEqual([
      'layla@sidra.ae', 'omar@sidra.ae', 'info@sidra.ae', 'accounts@sidra.ae',
    ]);
  });

  it('resolves clashes', () => {
    const c = company(0);
    const twin = { ...c.people[0]!, id: 'x', name: { en: 'Layla Nasser' } };
    const info = { ...c.people[0]!, id: 'y', name: { en: 'Info Desk' } };
    expect(planMailboxes(c, 'sidra.ae', [twin, info]).map((m) => m.address).slice(0, 4)).toEqual([
      'layla@sidra.ae', 'omar@sidra.ae', 'layla.nasser@sidra.ae', 'info.desk@sidra.ae',
    ]);
  });

  it('produces MX, SPF, DMARC and verification records per provider', () => {
    const m365 = emailDnsRecords('sidra.ae', 'M365', 'abc');
    expect(m365.find((r) => r.type === 'MX')!.value).toBe('sidra-ae.mail.protection.outlook.com');
    expect(m365.map((r) => r.purpose)).toContain('DMARC policy');
    const google = emailDnsRecords('sidra.ae', 'GOOGLE', 'abc');
    expect(google.find((r) => r.type === 'MX')!.value).toBe('smtp.google.com');
    expect(google[0]!.value).toBe('google-site-verification=abc');
  });
});
