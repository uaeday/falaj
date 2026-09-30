import { type Result, isValidEmiratesId, isEmirate, parseDecimal } from '@falaj/core';
import { authority } from './authorities.ts';
import type { Company, PartnerAttribution, TradeLicence, Vertical } from './types.ts';

export type LicenceIssueCode =
  | 'UNKNOWN_AUTHORITY' | 'EXPIRED' | 'EXPIRES_SOON' | 'NO_ACTIVITIES' | 'NO_OWNERS'
  | 'SHARES_NOT_100' | 'EMIRATES_ID_INVALID' | 'ARABIC_NAME_MISSING' | 'BAD_EMIRATE' | 'BAD_DATES';

export interface LicenceIssue {
  code: LicenceIssueCode;
  severity: 'ERROR' | 'WARNING';
  message: string;
}

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Checks an imported licence before a company is created from it. Errors block provisioning; warnings do not. */
export function validateLicence(l: TradeLicence, today: string): LicenceIssue[] {
  const issues: LicenceIssue[] = [];
  const add = (code: LicenceIssueCode, severity: LicenceIssue['severity'], message: string) => issues.push({ code, severity, message });

  if (!authority(l.authority)) add('UNKNOWN_AUTHORITY', 'ERROR', `Licensing authority ${l.authority} is not supported yet`);
  if (!isEmirate(l.address.emirate)) add('BAD_EMIRATE', 'ERROR', 'Address emirate is not one of the seven emirates');
  if (l.issueDate > l.expiryDate) add('BAD_DATES', 'ERROR', 'Licence expires before it was issued');
  if (l.expiryDate < today) add('EXPIRED', 'ERROR', `Licence expired on ${l.expiryDate}`);
  else if (l.expiryDate <= addDays(today, 30)) add('EXPIRES_SOON', 'WARNING', `Licence expires on ${l.expiryDate}`);
  if (!l.activities.length) add('NO_ACTIVITIES', 'ERROR', 'The licence lists no activities');
  const owners = l.parties.filter((p) => p.roles.some((r) => r !== 'MANAGER'));
  if (!owners.length) add('NO_OWNERS', 'ERROR', 'The licence lists no owner, partner or shareholder');
  const shares = owners.filter((p) => p.sharePct !== undefined);
  if (shares.length) {
    const total = shares.reduce((s, p) => {
      const d = parseDecimal(p.sharePct!);
      return s + Number(d.units) / 10 ** d.scale;
    }, 0);
    if (Math.abs(total - 100) > 0.0001) add('SHARES_NOT_100', 'ERROR', `Ownership shares add up to ${total}%, not 100%`);
  }
  for (const p of l.parties) {
    if (p.emiratesId && !isValidEmiratesId(p.emiratesId)) add('EMIRATES_ID_INVALID', 'ERROR', `Emirates ID for ${p.name.en} is invalid`);
  }
  if (!l.tradeName.ar) add('ARABIC_NAME_MISSING', 'WARNING', 'No Arabic trade name; invoices and the website need one');
  return issues;
}

/** Vertical from licence activities (keyword heuristic; the customer confirms it during onboarding). */
export function inferVertical(l: TradeLicence): Vertical {
  const text = l.activities.map((a) => a.name.en.toLowerCase()).join(' | ');
  if (/e-?commerce|online|electronic trading|internet/.test(text)) return 'ECOMMERCE';
  if (/contract|construction|fit-?out|mep|building|civil works/.test(text)) return 'CONTRACTING';
  if (/trading|import|export|wholesale|retail|general trading/.test(text)) return 'TRADING';
  if (/consult|advis|management|marketing|design|services|agency|software|it |clinic|legal|account/.test(text)) return 'PROFESSIONAL_SERVICES';
  return 'OTHER';
}

export function companyFromLicence(
  l: TradeLicence,
  ctx: { tenantId: string; today: string; now: string; newId: () => string; partner?: PartnerAttribution },
): Result<Company, LicenceIssue[]> {
  const issues = validateLicence(l, ctx.today);
  const errors = issues.filter((i) => i.severity === 'ERROR');
  if (errors.length) return { ok: false, error: errors };
  const auth = authority(l.authority)!;
  return {
    ok: true,
    value: {
      id: ctx.newId(),
      tenantId: ctx.tenantId,
      legalName: l.legalName,
      tradeName: l.tradeName,
      legalForm: l.legalForm,
      jurisdiction: auth.jurisdiction,
      emirate: l.address.emirate,
      authority: l.authority,
      licenceNo: l.licenceNo,
      licenceIssueDate: l.issueDate,
      licenceExpiryDate: l.expiryDate,
      activities: l.activities,
      vertical: inferVertical(l),
      address: l.address,
      people: l.parties.map((p) => ({ id: ctx.newId(), ...p })),
      ...(ctx.partner ? { partner: ctx.partner } : {}),
      createdAt: ctx.now,
    },
  };
}

/**
 * People who may be beneficial owners: direct share at or above the threshold (25% in Cabinet Decision 109/2023, VERIFY).
 * This only seeds the UBO register; indirect ownership and control still need a human declaration.
 */
export function uboCandidates(c: Company, thresholdPct = 25) {
  return c.people.filter((p) => p.sharePct !== undefined && Number(p.sharePct) >= thresholdPct);
}
