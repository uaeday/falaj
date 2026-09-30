/**
 * UAE identifier validators. Formats are structural checks only. They do not prove that
 * a TRN is registered (FTA TRN verification) or that an Emirates ID is valid (ICP).
 */

const digitsOnly = (s: string): string => s.replace(/[\s-]/g, '');

/** FTA Tax Registration Number: 15 digits. */
export function isValidTrn(trn: string): boolean {
  return /^\d{15}$/.test(digitsOnly(trn));
}

/** Luhn (mod 10) check over a digit string. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Emirates ID: 784-YYYY-NNNNNNN-C (15 digits, UAE country code 784, Luhn check digit). */
export function isValidEmiratesId(id: string): boolean {
  const d = digitsOnly(id);
  if (!/^784\d{12}$/.test(d)) return false;
  const year = Number(d.slice(3, 7));
  if (year < 1900 || year > new Date().getUTCFullYear()) return false;
  return luhnValid(d);
}

export function formatEmiratesId(id: string): string {
  const d = digitsOnly(id);
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}`;
}

/** IBAN lengths for the UAE and its main trading partners (ISO 13616 registry). */
const IBAN_LENGTHS: Record<string, number> = {
  AE: 23, SA: 24, QA: 29, KW: 30, BH: 22, OM: 23, JO: 30, EG: 29, PK: 24,
  GB: 22, DE: 22, FR: 27, NL: 18, CH: 21, IE: 22, IT: 27, ES: 24, TR: 26,
};

export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** ISO 13616 mod-97 check. UAE IBANs are AE + 2 check digits + 3-digit bank code + 16-digit account. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  if (iban.startsWith('AE') && !/^AE\d{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return BigInt(numeric) % 97n === 1n;
}

/** UAE bank code (3 digits) from an AE IBAN, e.g. "033". */
export function uaeBankCode(iban: string): string | undefined {
  const n = normalizeIban(iban);
  return n.startsWith('AE') && isValidIban(n) ? n.slice(4, 7) : undefined;
}

/**
 * Normalises a UAE phone number to E.164 (+971…). Returns undefined if it cannot be a UAE number.
 * Mobile: 5X + 7 digits. Landline: area code 2,3,4,6,7,9 + 7 digits. (VERIFY TDRA numbering plan.)
 */
export function normalizeUaePhone(input: string): string | undefined {
  let d = input.replace(/[\s()-]/g, '');
  if (d.startsWith('+971')) d = d.slice(4);
  else if (d.startsWith('00971')) d = d.slice(5);
  else if (d.startsWith('971') && d.length >= 11) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  if (/^5\d{8}$/.test(d) || /^[234679]\d{7}$/.test(d)) return `+971${d}`;
  return undefined;
}

export const EMIRATES = ['AUH', 'DXB', 'SHJ', 'AJM', 'UAQ', 'RAK', 'FUJ'] as const;
export type Emirate = (typeof EMIRATES)[number];

export const EMIRATE_NAMES: Record<Emirate, { en: string; ar: string }> = {
  AUH: { en: 'Abu Dhabi', ar: 'أبوظبي' },
  DXB: { en: 'Dubai', ar: 'دبي' },
  SHJ: { en: 'Sharjah', ar: 'الشارقة' },
  AJM: { en: 'Ajman', ar: 'عجمان' },
  UAQ: { en: 'Umm Al Quwain', ar: 'أم القيوين' },
  RAK: { en: 'Ras Al Khaimah', ar: 'رأس الخيمة' },
  FUJ: { en: 'Fujairah', ar: 'الفجيرة' },
};

export const isEmirate = (v: string): v is Emirate => (EMIRATES as readonly string[]).includes(v);
