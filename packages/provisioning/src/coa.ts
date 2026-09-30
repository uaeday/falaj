import type { Account, CtTreatment, SubLedger } from '@falaj/ledger';
import type { Vertical } from '@falaj/company';

type Row = [code: string, en: string, ar: string, type: Account['type'], control?: SubLedger | undefined, ct?: CtTreatment];

const BASE: Row[] = [
  ['1100', 'Bank', 'البنك', 'ASSET'],
  ['1150', 'Petty cash', 'النثرية', 'ASSET'],
  ['1200', 'Accounts receivable', 'الذمم المدينة', 'ASSET', 'AR'],
  ['1300', 'VAT recoverable', 'ضريبة المدخلات القابلة للاسترداد', 'ASSET', 'VAT'],
  ['1400', 'Prepayments', 'مصروفات مدفوعة مقدماً', 'ASSET'],
  ['1500', 'Property and equipment', 'الممتلكات والمعدات', 'ASSET', 'FIXED_ASSET'],
  ['1590', 'Accumulated depreciation', 'مجمع الإهلاك', 'ASSET', 'FIXED_ASSET'],
  ['2100', 'Accounts payable', 'الذمم الدائنة', 'LIABILITY', 'AP'],
  ['2200', 'VAT payable', 'ضريبة المخرجات المستحقة', 'LIABILITY', 'VAT'],
  ['2300', 'Accruals', 'المستحقات', 'LIABILITY'],
  ['2400', 'End-of-service provision', 'مخصص مكافأة نهاية الخدمة', 'LIABILITY', 'PAYROLL'],
  ['2410', 'Salaries payable', 'رواتب مستحقة', 'LIABILITY', 'PAYROLL'],
  ['2500', 'Corporate Tax payable', 'ضريبة الشركات المستحقة', 'LIABILITY'],
  ['3000', 'Share capital', 'رأس المال', 'EQUITY'],
  ['3100', 'Retained earnings', 'الأرباح المحتجزة', 'EQUITY'],
  ['3200', 'Owners’ current account', 'الحساب الجاري للشركاء', 'EQUITY'],
  ['4000', 'Revenue', 'الإيرادات', 'INCOME'],
  ['4900', 'Other income', 'إيرادات أخرى', 'INCOME'],
  ['5000', 'Cost of sales', 'تكلفة المبيعات', 'EXPENSE'],
  ['6100', 'Rent', 'الإيجار', 'EXPENSE'],
  ['6200', 'Salaries and benefits', 'الرواتب والمزايا', 'EXPENSE'],
  ['6300', 'Professional fees', 'أتعاب مهنية', 'EXPENSE'],
  ['6400', 'Marketing', 'التسويق', 'EXPENSE'],
  ['6500', 'Client entertainment', 'ضيافة العملاء', 'EXPENSE', undefined, 'PARTIAL_50'],
  ['6600', 'Bank charges', 'رسوم بنكية', 'EXPENSE'],
  ['6700', 'Government fees', 'الرسوم الحكومية', 'EXPENSE'],
  ['6800', 'Depreciation', 'الإهلاك', 'EXPENSE'],
  ['6900', 'Fines and penalties', 'الغرامات والمخالفات', 'EXPENSE', undefined, 'NON_DEDUCTIBLE'],
  ['7000', 'Foreign exchange gains and losses', 'أرباح وخسائر فروق العملة', 'EXPENSE'],
];

const BY_VERTICAL: Record<Vertical, Row[]> = {
  PROFESSIONAL_SERVICES: [
    ['1260', 'Unbilled revenue', 'إيرادات غير مفوترة', 'ASSET'],
    ['2600', 'Deferred revenue', 'إيرادات مؤجلة', 'LIABILITY'],
  ],
  TRADING: [
    ['1250', 'Post-dated cheques received', 'شيكات مؤجلة مستلمة', 'ASSET', 'AR'],
    ['1600', 'Inventory', 'المخزون', 'ASSET', 'INVENTORY'],
    ['2150', 'Post-dated cheques issued', 'شيكات مؤجلة صادرة', 'LIABILITY', 'AP'],
    ['5100', 'Customs duty', 'الرسوم الجمركية', 'EXPENSE'],
    ['5200', 'Freight inward', 'مصاريف الشحن الوارد', 'EXPENSE'],
  ],
  ECOMMERCE: [
    ['1270', 'Payment gateway clearing', 'حساب تسوية بوابة الدفع', 'ASSET', 'BANK'],
    ['1600', 'Inventory', 'المخزون', 'ASSET', 'INVENTORY'],
    ['5300', 'Gateway and marketplace fees', 'رسوم بوابات الدفع والمنصات', 'EXPENSE'],
  ],
  CONTRACTING: [
    ['1280', 'Retention receivable', 'محتجزات مدينة', 'ASSET', 'AR'],
    ['1290', 'Contract assets', 'أصول العقود', 'ASSET'],
    ['2700', 'Retention payable', 'محتجزات دائنة', 'LIABILITY', 'AP'],
  ],
  OTHER: [],
};

/** Chart of accounts for a new company, IFRS-shaped with VAT control accounts and CT tags pre-set (strategy: compliant by default). */
export function chartOfAccounts(entityId: string, vertical: Vertical, newId: (code: string) => string = (code) => `${entityId}:${code}`): Account[] {
  return [...BASE, ...BY_VERTICAL[vertical]]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, en, ar, type, control, ct]) => ({
      id: newId(code),
      entityId,
      code,
      name: { en, ar },
      type,
      isActive: true,
      ...(control ? { control } : {}),
      ...(ct ? { ctTreatment: ct } : {}),
    }));
}
