import { Money, RegulatoryConfig } from '@falaj/core';
import type { Company } from '@falaj/company';
import { UAE_DEFAULT_RULES, eInvoiceMandate } from '@falaj/tax-uae';
import { COMPLIANCE_RULES } from './rules.ts';

export type ObligationKind =
  | 'LICENCE_RENEWAL' | 'CT_REGISTRATION' | 'CT_RETURN' | 'VAT_REGISTRATION' | 'VAT_RETURN'
  | 'EINVOICE_ASP' | 'EINVOICE_GO_LIVE' | 'UBO_REGISTER' | 'WPS_SALARY';

export interface Obligation {
  id: string;
  kind: ObligationKind;
  title: { en: string; ar: string };
  /** ISO due date; null for ongoing duties with no fixed date. */
  due: string | null;
  /** Reminder dates before `due`. */
  remindOn: string[];
  source: string;
  /** True while any rule behind the date is unconfirmed (show "verify" badge). */
  verify: boolean;
}

/** Facts about the company beyond the licence. Unknowns are simply omitted. */
export interface CompanyFacts {
  company: Company;
  /** Last day of the first financial year (CT tax period end). */
  firstFinancialYearEnd: string;
  expectedAnnualTaxableSupplies?: Money;
  expectedAnnualRevenue?: Money;
  vat?: { registered: true; firstPeriodEnd: string; periodMonths: 1 | 3 };
  hasEmployees?: boolean;
  isGovernment?: boolean;
}

export const defaultComplianceConfig = (): RegulatoryConfig => new RegulatoryConfig([...UAE_DEFAULT_RULES, ...COMPLIANCE_RULES]);

const DAY = 86_400_000;
const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * DAY).toISOString().slice(0, 10);
/** Adds months, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
const monthEnd = (iso: string) => addDays(addMonths(`${iso.slice(0, 8)}01`, 1), -1);

/**
 * Builds the compliance calendar for [from, to]. Every date traces to a config rule and its source,
 * so a law change is a config change, and `verify` flows through to the UI.
 */
export function complianceCalendar(facts: CompanyFacts, range: { from: string; to: string }, config = defaultComplianceConfig()): Obligation[] {
  const c = facts.company;
  const out: Obligation[] = [];
  const asOf = range.from;
  const rule = (key: string) => config.get(key, asOf);
  const push = (o: Omit<Obligation, 'remindOn'> & { remindOn?: string[] }) => {
    if (o.due === null || (o.due >= range.from && o.due <= range.to)) out.push({ remindOn: [], ...o });
  };

  // Licence renewal
  const reminders = rule('licence.renewal.reminder_days').value.split(',').map(Number);
  push({
    id: `licence:${c.licenceExpiryDate}`, kind: 'LICENCE_RENEWAL', due: c.licenceExpiryDate,
    remindOn: reminders.map((d) => addDays(c.licenceExpiryDate, -d)).filter((d) => d >= range.from),
    title: { en: `Renew trade licence ${c.licenceNo}`, ar: `تجديد الرخصة التجارية ${c.licenceNo}` },
    source: `Licensing authority ${c.authority}`, verify: false,
  });

  // Corporate Tax registration (new juridical persons) and first return
  const ctReg = rule('ct.registration.months_after_incorporation');
  push({
    id: 'ct:registration', kind: 'CT_REGISTRATION', due: addMonths(c.licenceIssueDate, Number(ctReg.value)),
    title: { en: 'Register for Corporate Tax on EmaraTax', ar: 'التسجيل في ضريبة الشركات عبر إمارات تاكس' },
    source: ctReg.source, verify: ctReg.verify,
  });
  const ctRet = rule('ct.return.months_after_period_end');
  push({
    id: `ct:return:${facts.firstFinancialYearEnd}`, kind: 'CT_RETURN', due: addMonths(facts.firstFinancialYearEnd, Number(ctRet.value)),
    title: { en: 'File first Corporate Tax return and pay', ar: 'تقديم أول إقرار لضريبة الشركات والسداد' },
    source: ctRet.source, verify: ctRet.verify,
  });

  // VAT: registration if expected supplies cross the threshold; returns if registered
  if (facts.vat?.registered) {
    const due = rule('vat.return.due_days_after_period');
    for (let end = facts.vat.firstPeriodEnd; end <= range.to; end = monthEnd(addMonths(end, facts.vat.periodMonths))) {
      push({
        id: `vat:return:${end}`, kind: 'VAT_RETURN', due: addDays(end, Number(due.value)),
        title: { en: `File VAT201 for the period ending ${end}`, ar: `تقديم إقرار ضريبة القيمة المضافة للفترة المنتهية في ${end}` },
        source: due.source, verify: due.verify,
      });
    }
  } else if (facts.expectedAnnualTaxableSupplies) {
    const threshold = Money.fromDecimal(rule('vat.registration.mandatory_threshold').value, 'AED');
    const shown = new Intl.NumberFormat('en-US').format(Number(rule('vat.registration.mandatory_threshold').value));
    const days = rule('vat.registration.days_after_threshold');
    if (facts.expectedAnnualTaxableSupplies.compare(threshold) >= 0) {
      push({
        id: 'vat:registration', kind: 'VAT_REGISTRATION', due: null,
        title: {
          en: `Register for VAT within ${days.value} days of taxable supplies passing AED ${shown}`,
          ar: `التسجيل في ضريبة القيمة المضافة خلال ${days.value} يوماً من تجاوز التوريدات الخاضعة للضريبة ${shown} درهم`,
        },
        source: days.source, verify: days.verify,
      });
    }
  }

  // E-invoicing mandate
  const mandate = eInvoiceMandate(
    { annualRevenue: facts.expectedAnnualRevenue ?? Money.zero('AED'), isGovernment: facts.isGovernment ?? false }, asOf, config,
  );
  push({
    id: 'einvoice:asp', kind: 'EINVOICE_ASP', due: mandate.aspDeadline,
    title: { en: 'Appoint an Accredited Service Provider for e-invoicing', ar: 'تعيين مزود خدمة معتمد للفوترة الإلكترونية' },
    source: 'MD 244/2025', verify: mandate.provisional,
  });
  push({
    id: 'einvoice:go-live', kind: 'EINVOICE_GO_LIVE', due: mandate.goLive,
    title: { en: 'Issue B2B invoices as e-invoices (PINT-AE)', ar: 'إصدار الفواتير بين الشركات كفواتير إلكترونية' },
    source: 'MD 244/2025', verify: mandate.provisional,
  });

  // UBO register: ongoing duty
  push({
    id: 'ubo:register', kind: 'UBO_REGISTER', due: null,
    title: { en: 'Keep the UBO register current and report changes to the registrar', ar: 'تحديث سجل المستفيد الحقيقي وإبلاغ المسجل بأي تغيير' },
    source: 'Cabinet Decision 109/2023', verify: true,
  });

  // WPS monthly salary
  if (facts.hasEmployees) {
    const wps = rule('wps.salary.days_after_month_end');
    for (let m = monthEnd(range.from); m <= range.to; m = monthEnd(addMonths(`${m.slice(0, 8)}01`, 1))) {
      push({
        id: `wps:${m.slice(0, 7)}`, kind: 'WPS_SALARY', due: addDays(m, Number(wps.value)),
        title: { en: `Pay ${m.slice(0, 7)} salaries through WPS`, ar: `دفع رواتب ${m.slice(0, 7)} عبر نظام حماية الأجور` },
        source: wps.source, verify: wps.verify,
      });
    }
  }

  return out.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.id.localeCompare(b.id));
}

/** Recurring kinds (monthly WPS, periodic VAT) collapse to their next occurrence for a calm, short list. */
export function nextOccurrences(obligations: readonly Obligation[]): (Obligation & { recurring: boolean })[] {
  const seen = new Set<ObligationKind>();
  const recurring = new Set<ObligationKind>(['WPS_SALARY', 'VAT_RETURN']);
  return obligations.flatMap((o): (Obligation & { recurring: boolean })[] => {
    if (!recurring.has(o.kind)) return [{ ...o, recurring: false }];
    if (seen.has(o.kind)) return [];
    seen.add(o.kind);
    return [{ ...o, recurring: true }];
  });
}
