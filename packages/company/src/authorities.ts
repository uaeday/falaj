import type { Emirate } from '@falaj/core';

export type Jurisdiction = 'MAINLAND' | 'FREE_ZONE' | 'DIFC' | 'ADGM';

export interface LicensingAuthority {
  code: string;
  name: { en: string; ar: string };
  emirate: Emirate;
  jurisdiction: Jurisdiction;
}

/**
 * Launch reference list (strategy: Dubai & Abu Dhabi mainland + main free zones). Names and codes are
 * reference data to confirm with each authority (VERIFY), and the list grows as partners sign.
 */
export const AUTHORITIES: readonly LicensingAuthority[] = [
  { code: 'DET', name: { en: 'Dubai Department of Economy and Tourism', ar: 'دائرة الاقتصاد والسياحة في دبي' }, emirate: 'DXB', jurisdiction: 'MAINLAND' },
  { code: 'ADDED', name: { en: 'Abu Dhabi Department of Economic Development', ar: 'دائرة التنمية الاقتصادية – أبوظبي' }, emirate: 'AUH', jurisdiction: 'MAINLAND' },
  { code: 'SEDD', name: { en: 'Sharjah Economic Development Department', ar: 'دائرة التنمية الاقتصادية – الشارقة' }, emirate: 'SHJ', jurisdiction: 'MAINLAND' },
  { code: 'DMCC', name: { en: 'Dubai Multi Commodities Centre', ar: 'مركز دبي للسلع المتعددة' }, emirate: 'DXB', jurisdiction: 'FREE_ZONE' },
  { code: 'IFZA', name: { en: 'International Free Zone Authority', ar: 'آيفزا' }, emirate: 'DXB', jurisdiction: 'FREE_ZONE' },
  { code: 'JAFZA', name: { en: 'Jebel Ali Free Zone', ar: 'المنطقة الحرة لجبل علي' }, emirate: 'DXB', jurisdiction: 'FREE_ZONE' },
  { code: 'DAFZA', name: { en: 'Dubai Airport Free Zone', ar: 'المنطقة الحرة لمطار دبي' }, emirate: 'DXB', jurisdiction: 'FREE_ZONE' },
  { code: 'MEYDAN', name: { en: 'Meydan Free Zone', ar: 'المنطقة الحرة ميدان' }, emirate: 'DXB', jurisdiction: 'FREE_ZONE' },
  { code: 'SAIF', name: { en: 'Sharjah Airport International Free Zone', ar: 'المنطقة الحرة لمطار الشارقة الدولي' }, emirate: 'SHJ', jurisdiction: 'FREE_ZONE' },
  { code: 'SHAMS', name: { en: 'Sharjah Media City', ar: 'مدينة الشارقة للإعلام (شمس)' }, emirate: 'SHJ', jurisdiction: 'FREE_ZONE' },
  { code: 'RAKEZ', name: { en: 'Ras Al Khaimah Economic Zone', ar: 'منطقة رأس الخيمة الاقتصادية' }, emirate: 'RAK', jurisdiction: 'FREE_ZONE' },
  { code: 'DIFC', name: { en: 'Dubai International Financial Centre', ar: 'مركز دبي المالي العالمي' }, emirate: 'DXB', jurisdiction: 'DIFC' },
  { code: 'ADGM', name: { en: 'Abu Dhabi Global Market', ar: 'سوق أبوظبي العالمي' }, emirate: 'AUH', jurisdiction: 'ADGM' },
];

export const authority = (code: string): LicensingAuthority | undefined => AUTHORITIES.find((a) => a.code === code);
