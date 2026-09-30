import { describe, expect, it } from 'vitest';
import { aedToArabicWords, aedToEnglishWords } from '../src/index.ts';

describe('amount in words', () => {
  it('English', () => {
    expect(aedToEnglishWords(125050n)).toBe('One thousand two hundred fifty dirhams and fifty fils only');
    expect(aedToEnglishWords(100n)).toBe('One dirham only');
    expect(aedToEnglishWords(3672_50n)).toBe('Three thousand six hundred seventy-two dirhams and fifty fils only');
  });

  // Golden file: reviewed outputs. Changing these needs sign-off from a native Arabic reviewer.
  it.each([
    [1_260_000n, 'فقط اثنا عشر ألفاً وستمائة درهم لا غير'], // matches the Falaj brand-book invoice sample
    [100n, 'فقط درهم واحد لا غير'],
    [200n, 'فقط درهمان لا غير'],
    [500n, 'فقط خمسة دراهم لا غير'],
    [2_100n, 'فقط واحد وعشرون درهماً لا غير'],
    [10_000n, 'فقط مائة درهم لا غير'],
    [125_050n, 'فقط ألف ومائتان وخمسون درهماً وخمسون فلساً لا غير'],
    [300_000n, 'فقط ثلاثة آلاف درهم لا غير'],
    [200_000_000n, 'فقط مليونا درهم لا غير'],
    [200_000n, 'فقط ألفا درهم لا غير'],
    [5n, 'فقط خمسة فلوس لا غير'],
  ])('Arabic %s fils', (minor, words) => {
    expect(aedToArabicWords(minor)).toBe(words);
  });
});
