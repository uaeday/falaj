import type { Emirate } from '@falaj/core';
import type { Jurisdiction } from './authorities.ts';

export type Bilingual = { en: string; ar?: string };

export type LegalForm =
  | 'LLC' | 'SOLE_ESTABLISHMENT' | 'CIVIL_COMPANY' | 'FZE' | 'FZCO' | 'FZ_LLC' | 'BRANCH' | 'PJSC' | 'OTHER';

export type PartyRole = 'OWNER' | 'PARTNER' | 'SHAREHOLDER' | 'MANAGER';

export interface LicenceParty {
  name: Bilingual;
  nationality: string;
  roles: PartyRole[];
  /** Ownership share as a decimal string percentage, e.g. "51". */
  sharePct?: string;
  emiratesId?: string;
  email?: string;
  mobile?: string;
}

export interface LicenceActivity {
  code: string;
  name: Bilingual;
}

export interface UaeAddress {
  emirate: Emirate;
  area?: string;
  building?: string;
  unit?: string;
  poBox?: string;
  /** Dubai Makani number (10 digits). */
  makani?: string;
}

/** Trade licence as imported from the licensing authority / UAE PASS (licence import, journey step 1). */
export interface TradeLicence {
  authority: string;
  licenceNo: string;
  legalForm: LegalForm;
  legalName: Bilingual;
  tradeName: Bilingual;
  issueDate: string;
  expiryDate: string;
  activities: LicenceActivity[];
  parties: LicenceParty[];
  address: UaeAddress;
}

/** Strategy verticals, in priority order. */
export type Vertical = 'PROFESSIONAL_SERVICES' | 'TRADING' | 'ECOMMERCE' | 'CONTRACTING' | 'OTHER';

export type PartnerType = 'SETUP_AGENT' | 'FREE_ZONE' | 'BANK' | 'ACCOUNTING_FIRM';

/** Which channel partner activated the company; drives recurring revenue share (rate is unset config). */
export interface PartnerAttribution {
  partnerId: string;
  type: PartnerType;
  attributedAt: string;
}

export interface Person {
  id: string;
  name: Bilingual;
  nationality: string;
  roles: PartyRole[];
  sharePct?: string;
  emiratesId?: string;
  email?: string;
  mobile?: string;
}

/** The one company record every module shares: email, website, ledger, HR and CRM hang off it. */
export interface Company {
  id: string;
  tenantId: string;
  legalName: Bilingual;
  tradeName: Bilingual;
  legalForm: LegalForm;
  jurisdiction: Jurisdiction;
  emirate: Emirate;
  authority: string;
  licenceNo: string;
  licenceIssueDate: string;
  licenceExpiryDate: string;
  activities: LicenceActivity[];
  vertical: Vertical;
  address: UaeAddress;
  people: Person[];
  partner?: PartnerAttribution;
  createdAt: string;
}
