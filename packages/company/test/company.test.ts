import { describe, expect, it } from 'vitest';
import {
  FixtureLicenceSource, SAMPLE_LICENCES, type TradeLicence, companyFromLicence, inferVertical, uboCandidates, validateLicence,
} from '../src/index.ts';

const today = '2026-10-01';
const [sidra, qattara, nabta] = SAMPLE_LICENCES as [TradeLicence, TradeLicence, TradeLicence];
let n = 0;
const ctx = { tenantId: 't1', today, now: '2026-10-01T06:00:00Z', newId: () => `id-${++n}` };

describe('licence import and validation (journey step 1)', () => {
  it('all sample licences are valid', () => {
    for (const l of SAMPLE_LICENCES) expect(validateLicence(l, today).filter((i) => i.severity === 'ERROR')).toEqual([]);
  });

  it('warns when the Arabic trade name is missing', () => {
    const l = { ...qattara, tradeName: { en: 'Qattara Foods' } };
    expect(validateLicence(l, today).map((i) => i.code)).toEqual(['ARABIC_NAME_MISSING']);
  });

  it('blocks expired licences, unknown authorities, bad shares and bad Emirates IDs', () => {
    const bad: TradeLicence = {
      ...sidra,
      authority: 'NOPE',
      expiryDate: '2026-09-01',
      issueDate: '2025-09-01',
      parties: [
        { ...sidra.parties[0]!, sharePct: '60', emiratesId: '784-1988-1234567-1' },
        { ...sidra.parties[1]!, sharePct: '30' },
      ],
    };
    expect(validateLicence(bad, today).map((i) => i.code)).toEqual(['UNKNOWN_AUTHORITY', 'EXPIRED', 'SHARES_NOT_100', 'EMIRATES_ID_INVALID']);
  });

  it('warns 30 days before expiry', () => {
    expect(validateLicence({ ...sidra, expiryDate: '2026-10-20' }, today).map((i) => i.code)).toEqual(['EXPIRES_SOON']);
  });

  it('infers the strategy vertical from activities', () => {
    expect(SAMPLE_LICENCES.map(inferVertical)).toEqual(['PROFESSIONAL_SERVICES', 'TRADING', 'ECOMMERCE']);
  });

  it('fixture source returns copies and NOT_FOUND', async () => {
    const src = new FixtureLicenceSource(SAMPLE_LICENCES);
    const a = await src.fetch({ authority: 'DET', licenceNo: '1234567' });
    expect(a.ok && a.value.tradeName.en).toBe('Sidra Consultancy');
    if (a.ok) a.value.tradeName.en = 'mutated';
    const b = await src.fetch({ authority: 'DET', licenceNo: '1234567' });
    expect(b.ok && b.value.tradeName.en).toBe('Sidra Consultancy');
    expect(await src.fetch({ authority: 'DET', licenceNo: '0' })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('one company record', () => {
  it('creates the company, people and partner attribution from the licence', () => {
    const r = companyFromLicence(sidra, { ...ctx, partner: { partnerId: 'agent-7', type: 'SETUP_AGENT', attributedAt: ctx.now } });
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value).toMatchObject({ jurisdiction: 'MAINLAND', emirate: 'DXB', vertical: 'PROFESSIONAL_SERVICES', partner: { type: 'SETUP_AGENT' } });
    expect(r.value.people.map((p) => p.name.en)).toEqual(['Layla Haddad', 'Omar Al Suwaidi']);
  });

  it('refuses to create a company from an invalid licence', () => {
    expect(companyFromLicence({ ...nabta, activities: [] }, ctx)).toMatchObject({ ok: false, error: [{ code: 'NO_ACTIVITIES' }] });
  });

  it('seeds UBO candidates at the 25% threshold', () => {
    const r = companyFromLicence(sidra, ctx);
    if (!r.ok) throw new Error();
    expect(uboCandidates(r.value).map((p) => p.sharePct)).toEqual(['60', '40']);
    expect(uboCandidates(r.value, 50).map((p) => p.name.en)).toEqual(['Layla Haddad']);
  });
});
