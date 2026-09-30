import type { TradeLicence } from './types.ts';

/**
 * Sample licences covering the strategy's first three verticals. All names, numbers and people are fictitious.
 * Emirates IDs carry valid check digits only so the validators pass.
 */
export const SAMPLE_LICENCES: readonly TradeLicence[] = [
  {
    authority: 'DET',
    licenceNo: '1234567',
    legalForm: 'LLC',
    legalName: { en: 'Sidra Management Consultancy L.L.C', ar: 'سدرة للاستشارات الإدارية ذ.م.م' },
    tradeName: { en: 'Sidra Consultancy', ar: 'سدرة للاستشارات' },
    issueDate: '2026-09-29',
    expiryDate: '2027-09-28',
    activities: [
      { code: '7020001', name: { en: 'Management Consultancy', ar: 'الاستشارات الإدارية' } },
      { code: '7310002', name: { en: 'Marketing Services', ar: 'خدمات التسويق' } },
    ],
    parties: [
      { name: { en: 'Layla Haddad', ar: 'ليلى حداد' }, nationality: 'JO', roles: ['PARTNER', 'MANAGER'], sharePct: '60', emiratesId: '784-1988-1234567-0', email: 'layla.h@example.com', mobile: '+971501234567' },
      { name: { en: 'Omar Al Suwaidi', ar: 'عمر السويدي' }, nationality: 'AE', roles: ['PARTNER'], sharePct: '40', emiratesId: '784-1985-7654321-3' },
    ],
    address: { emirate: 'DXB', area: 'Business Bay', building: 'Bay Square 5', unit: '402', poBox: '123456', makani: '2877396541' },
  },
  {
    authority: 'DMCC',
    licenceNo: 'DMCC-876543',
    legalForm: 'FZ_LLC',
    legalName: { en: 'Qattara Foods Trading DMCC', ar: 'قطارة لتجارة المواد الغذائية م.د.م.س' },
    tradeName: { en: 'Qattara Foods', ar: 'قطارة للأغذية' },
    issueDate: '2026-09-15',
    expiryDate: '2027-09-14',
    activities: [{ code: '4630', name: { en: 'Foodstuff Trading', ar: 'تجارة المواد الغذائية' } }],
    parties: [
      { name: { en: 'Arjun Mehta' }, nationality: 'IN', roles: ['SHAREHOLDER', 'MANAGER'], sharePct: '100', email: 'arjun@example.com', mobile: '+971551112233' },
    ],
    address: { emirate: 'DXB', area: 'Jumeirah Lakes Towers', building: 'Cluster X', unit: '1105', poBox: '654321' },
  },
  {
    authority: 'SHAMS',
    licenceNo: 'SMC-2026-44120',
    legalForm: 'FZE',
    legalName: { en: 'Nabta Online FZE', ar: 'نبتة أونلاين م.م.ح' },
    tradeName: { en: 'Nabta', ar: 'نبتة' },
    issueDate: '2026-09-30',
    expiryDate: '2027-09-29',
    activities: [{ code: '4791', name: { en: 'E-Commerce', ar: 'التجارة الإلكترونية' } }],
    parties: [
      { name: { en: 'Mariam Al Nuaimi', ar: 'مريم النعيمي' }, nationality: 'AE', roles: ['OWNER', 'MANAGER'], sharePct: '100', emiratesId: '784-1995-3456789-8', mobile: '+971561234567' },
    ],
    address: { emirate: 'SHJ', area: 'Sharjah Media City', poBox: '515000' },
  },
];
