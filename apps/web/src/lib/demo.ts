import 'server-only';
import { type Emirate, Money, aed, aedToArabicWords, aedToEnglishWords } from '@falaj/core';
import {
  type Account, type Actor, type AuditEventInput, HashChain, InMemoryLedgerRepository, Ledger, type JournalEntryInput,
  PERMISSIONS, PeriodCalendar, monthlyPeriods, verifyChain,
} from '@falaj/ledger';
import {
  type VatCode, type VatTransaction, buildVat201, calculateVatDocument, defaultUaeConfig, eInvoiceMandate, isVatCode, vatRate,
} from '@falaj/tax-uae';

/**
 * Demo data for the Phase 1 shell: a sample tenant's Q1 2027 posted through the real ledger and VAT engine.
 * Nothing is persisted. All names and numbers are samples.
 */

const ENTITY = 'al-qattara';
const config = defaultUaeConfig();

const a = (id: string, code: string, en: string, ar: string, type: Account['type'], extra: Partial<Account> = {}): Account => ({
  id, entityId: ENTITY, code, name: { en, ar }, type, isActive: true, ...extra,
});

export const ACCOUNTS: Account[] = [
  a('bank', '1100', 'Bank — Emirates NBD', 'البنك — الإمارات دبي الوطني', 'ASSET'),
  a('ar', '1200', 'Accounts receivable', 'الذمم المدينة', 'ASSET', { control: 'AR' }),
  a('vat-in', '1300', 'VAT recoverable', 'ضريبة المدخلات القابلة للاسترداد', 'ASSET', { control: 'VAT' }),
  a('ap', '2100', 'Accounts payable', 'الذمم الدائنة', 'LIABILITY', { control: 'AP' }),
  a('vat-out', '2200', 'VAT payable', 'ضريبة المخرجات المستحقة', 'LIABILITY', { control: 'VAT' }),
  a('capital', '3000', 'Share capital', 'رأس المال', 'EQUITY'),
  a('sales', '4000', 'Sales', 'المبيعات', 'INCOME'),
  a('rent', '6100', 'Warehouse rent', 'إيجار المستودع', 'EXPENSE'),
  a('consult', '6200', 'Consultancy (overseas)', 'استشارات (خارجية)', 'EXPENSE'),
  a('ent', '6300', 'Client entertainment', 'ضيافة العملاء', 'EXPENSE', { ctTreatment: 'PARTIAL_50' }),
];

const actor: Actor = { userId: 'demo-accountant', permissions: new Set([PERMISSIONS.postManual]) };

export const SAMPLE_INVOICE = {
  number: 'INV-2027-0418',
  date: '2027-02-10',
  supplier: { en: 'Al Qattara Trading LLC', ar: 'القطارة للتجارة ذ.م.م', trn: '100234567890003' },
  lines: [
    { en: 'Chilled display unit', ar: 'وحدة عرض مبرّدة', quantity: '2', unitPrice: aed('4500.00'), code: 'SR' as const },
    { en: 'Installation & commissioning', ar: 'التركيب والتشغيل', quantity: '1', unitPrice: aed('3000.00'), code: 'SR' as const },
  ],
};

function salesInvoice(id: string, date: string, emirate: Emirate, lines: { quantity: string; unitPrice: Money; code: VatCode }[]): JournalEntryInput {
  const doc = calculateVatDocument(lines, { date, config });
  const byCode = new Map<VatCode, Money>();
  for (const l of doc.lines) byCode.set(l.code, (byCode.get(l.code) ?? Money.zero('AED')).add(l.net));
  return {
    entityId: ENTITY, postingDate: date, source: { type: 'AR_INVOICE', id }, memo: `Sales invoice ${id}`,
    lines: [
      { accountId: 'ar', debit: doc.gross, counterpartyId: 'cust' },
      ...[...byCode].map(([code, net]) => ({ accountId: 'sales', credit: net, taxCode: code, taxBase: net, emirate })),
      ...(doc.vat.isZero() ? [] : [{ accountId: 'vat-out', credit: doc.vat }]),
    ],
  };
}

function bill(id: string, date: string, expense: string, net: Money, code: VatCode, opts: { recoverable?: boolean } = {}): JournalEntryInput {
  const vat = net.multiply(vatRate(code, date, config));
  const recoverable = opts.recoverable ?? true;
  const dims = recoverable ? undefined : { vatRecoverable: 'false', category: 'ENTERTAINMENT' };
  const lines: JournalEntryInput['lines'] =
    code === 'RC_SVC'
      ? [
          { accountId: expense, debit: net, taxCode: code, taxBase: net },
          { accountId: 'ap', credit: net },
          { accountId: 'vat-in', debit: vat },
          { accountId: 'vat-out', credit: vat },
        ]
      : [
          { accountId: expense, debit: recoverable ? net : net.add(vat), taxCode: code, taxBase: net, ...(dims ? { dimensions: dims } : {}) },
          ...(recoverable && !vat.isZero() ? [{ accountId: 'vat-in', debit: vat }] : []),
          { accountId: 'ap', credit: net.add(vat) },
        ];
  return { entityId: ENTITY, postingDate: date, source: { type: 'AP_BILL', id }, memo: `Vendor bill ${id}`, lines };
}

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function buildDemo() {
  const byId = new Map(ACCOUNTS.map((x) => [x.id, x]));
  const chain = new HashChain();
  const ledger = new Ledger({
    tenantId: 'demo',
    repo: new InMemoryLedgerRepository(),
    accounts: (id) => byId.get(id),
    periods: new PeriodCalendar(monthlyPeriods(ENTITY, 2027)),
    audit: { record: (e: AuditEventInput) => void chain.append(e) },
    now: () => new Date('2027-04-01T06:00:00Z'),
  });

  const journals: JournalEntryInput[] = [
    { entityId: ENTITY, postingDate: '2027-01-01', source: { type: 'OPENING_BALANCE', id: 'OB-2027' }, memo: 'Opening balances',
      lines: [{ accountId: 'bank', debit: aed('500000') }, { accountId: 'capital', credit: aed('500000') }] },
    salesInvoice(SAMPLE_INVOICE.number, SAMPLE_INVOICE.date, 'DXB', SAMPLE_INVOICE.lines),
    salesInvoice('INV-2027-0419', '2027-02-18', 'AUH', [{ quantity: '1', unitPrice: aed('85000.00'), code: 'SR' }]),
    salesInvoice('INV-2027-0420', '2027-03-04', 'DXB', [{ quantity: '4', unitPrice: aed('10000.00'), code: 'ZR' }]),
    { entityId: ENTITY, postingDate: '2027-02-24', source: { type: 'AR_RECEIPT', id: 'RCPT-0088' }, memo: 'Receipt for INV-2027-0418',
      lines: [{ accountId: 'bank', debit: aed('12600.00') }, { accountId: 'ar', credit: aed('12600.00') }] },
    bill('BILL-3301', '2027-01-31', 'rent', aed('30000.00'), 'SR'),
    bill('BILL-3302', '2027-02-12', 'consult', aed('20000.00'), 'RC_SVC'),
    bill('BILL-3303', '2027-03-20', 'ent', aed('5000.00'), 'SR', { recoverable: false }),
  ];

  const posted = [];
  for (const j of journals) {
    const r = await ledger.post(j, actor);
    if (!r.ok) throw new Error(`Demo posting failed: ${JSON.stringify(r.error)}`);
    posted.push(r.value);
  }

  // Ledger → VAT201: every tax-coded line becomes a VAT transaction that drills back to "entry#line".
  const vatTxns: VatTransaction[] = posted.flatMap((e) =>
    e.lines
      .filter((l) => l.taxCode && isVatCode(l.taxCode) && l.taxBase)
      .map((l) => {
        const code = l.taxCode as VatCode;
        const output = byId.get(l.accountId)!.type === 'INCOME';
        return {
          ref: `${e.entryNo}#${l.lineNo}`,
          date: e.postingDate,
          direction: output ? ('OUTPUT' as const) : ('INPUT' as const),
          code,
          net: l.taxBase!,
          vat: l.taxBase!.multiply(vatRate(code, e.postingDate, config)),
          ...(l.emirate ? { emirate: l.emirate } : {}),
          recoverable: l.dimensions?.vatRecoverable !== 'false',
        };
      }),
  );
  const vat = buildVat201(vatTxns, { start: '2027-01-01', end: '2027-03-31' });
  if (!vat.ok) throw new Error(`VAT201 failed: ${JSON.stringify(vat.error)}`);

  const tb = await ledger.trialBalance(ENTITY, { to: '2027-03-31' });
  const invoice = calculateVatDocument(SAMPLE_INVOICE.lines, { date: SAMPLE_INVOICE.date, config });
  const revenue = tb.rows.find((r) => r.account.code === '4000')!.net.negate();

  return {
    tb,
    vat: vat.value,
    invoice: {
      ...invoice,
      words: { en: aedToEnglishWords(invoice.gross.minor), ar: aedToArabicWords(invoice.gross.minor) },
    },
    revenue,
    einvoice: eInvoiceMandate({ annualRevenue: aed('38000000'), isGovernment: false }, '2026-09-30', config),
    vatDue: addDays('2027-03-31', Number(config.value('vat.return.due_days_after_period', '2027-03-31'))),
    entries: posted.length,
    frozen: posted.every((e) => Object.isFrozen(e) && Ledger.verifyEntryHash(e)),
    chain: verifyChain(chain.all()),
  };
}
