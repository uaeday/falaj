import { describe, expect, it } from 'vitest';
import {
  formatEmiratesId, isValidEmiratesId, isValidIban, isValidTrn, luhnValid, normalizeUaePhone, uaeBankCode,
} from '../src/index.ts';

/** Builds an Emirates ID with a correct Luhn check digit, for test fixtures. */
function makeEid(body14: string): string {
  for (let c = 0; c <= 9; c++) if (luhnValid(body14 + c)) return body14 + c;
  throw new Error('unreachable');
}

describe('UAE validators', () => {
  it('TRN is exactly 15 digits', () => {
    expect(isValidTrn('100123456700003')).toBe(true);
    expect(isValidTrn('10012345670000')).toBe(false);
    expect(isValidTrn('10012345670000A')).toBe(false);
  });

  it('IBAN mod-97 (UAE registry example)', () => {
    expect(isValidIban('AE07 0331 2345 6789 0123 456')).toBe(true);
    expect(isValidIban('AE070331234567890123457')).toBe(false);
    expect(isValidIban('AE07033123456789012345')).toBe(false); // too short
    expect(uaeBankCode('AE070331234567890123456')).toBe('033');
    expect(isValidIban('GB82WEST12345698765432')).toBe(true);
  });

  it('Emirates ID: 784 prefix, plausible year, Luhn digit', () => {
    const eid = makeEid('78419901234567');
    expect(isValidEmiratesId(eid)).toBe(true);
    expect(isValidEmiratesId(formatEmiratesId(eid))).toBe(true);
    const wrongCheck = eid.slice(0, 14) + ((Number(eid[14]) + 1) % 10);
    expect(isValidEmiratesId(wrongCheck)).toBe(false);
    expect(isValidEmiratesId(makeEid('78518901234567'))).toBe(false); // not 784
  });

  it('normalises UAE phone numbers to E.164', () => {
    expect(normalizeUaePhone('050 123 4567')).toBe('+971501234567');
    expect(normalizeUaePhone('+971 4 123 4567')).toBe('+97141234567');
    expect(normalizeUaePhone('00971-55-1234567')).toBe('+971551234567');
    expect(normalizeUaePhone('+1 212 555 0100')).toBeUndefined();
  });
});
