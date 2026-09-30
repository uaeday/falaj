/**
 * Arabic amount-in-words (tafqit) for AED invoices, following common UAE invoice style:
 *   "فقط اثنا عشر ألفاً وستمائة درهم لا غير"
 * Counted nouns follow the classical rules: 1 → singular + واحد, 2 → dual, 3–10 → plural,
 * 11–99 → accusative singular, otherwise genitive singular.
 * Golden-file tests hold the reviewed outputs. Any change needs review by a native speaker.
 */

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

interface NounForms {
  singular: string;
  dual: string;
  plural: string;
  accusative: string;
}

const SCALES: NounForms[] = [
  { singular: 'ألف', dual: 'ألفان', plural: 'آلاف', accusative: 'ألفاً' },
  { singular: 'مليون', dual: 'مليونان', plural: 'ملايين', accusative: 'مليوناً' },
  { singular: 'مليار', dual: 'ملياران', plural: 'مليارات', accusative: 'ملياراً' },
];

const DIRHAM: NounForms = { singular: 'درهم', dual: 'درهمان', plural: 'دراهم', accusative: 'درهماً' };
const FILS: NounForms = { singular: 'فلس', dual: 'فلسان', plural: 'فلوس', accusative: 'فلساً' };

function below100(n: number): string {
  if (n === 0) return '';
  if (n < 10) return ONES[n]!;
  if (n === 10) return TENS[1]!;
  if (n === 11) return 'أحد عشر';
  if (n === 12) return 'اثنا عشر';
  if (n < 20) return `${ONES[n - 10]} عشر`;
  const u = n % 10;
  const t = TENS[Math.floor(n / 10)]!;
  return u ? `${ONES[u]} و${t}` : t;
}

function below1000(n: number): string {
  const parts = [HUNDREDS[Math.floor(n / 100)]!, below100(n % 100)].filter(Boolean);
  return parts.join(' و');
}

/** Number followed by its counted noun in the correct grammatical form. */
function counted(n: number, noun: NounForms, standaloneOne: boolean): string {
  if (n === 1) return standaloneOne ? `${noun.singular} واحد` : noun.singular;
  if (n === 2) return noun.dual;
  const r = n % 100;
  if (n >= 3 && n <= 10) return `${below1000(n)} ${noun.plural}`;
  if (r >= 11) return `${below1000(n)} ${noun.accusative}`;
  return `${below1000(n)} ${noun.singular}`;
}

export function integerToArabic(value: bigint): string {
  if (value < 0n) throw new RangeError('Negative amounts are not written in words');
  if (value === 0n) return 'صفر';
  const groups: string[] = [];
  let n = value;
  let scale = -1;
  while (n > 0n) {
    const g = Number(n % 1000n);
    if (g) {
      if (scale === -1) groups.unshift(below1000(g));
      else {
        const forms = SCALES[scale];
        if (!forms) throw new RangeError('Amount too large');
        groups.unshift(counted(g, forms, false));
      }
    }
    n /= 1000n;
    scale++;
  }
  return groups.join(' و');
}

/** Counted form of a whole amount of `noun`, e.g. 12 600 → "اثنا عشر ألفاً وستمائة درهم". */
function amountWithNoun(value: bigint, noun: NounForms): string {
  const last = Number(value % 1000n);
  if (value < 1000n) return counted(last, noun, true);
  const words = integerToArabic(value);
  // A dual scale word in construct with the noun drops its nun: "ألفا درهم", "مليونا درهم".
  if (last === 0) return `${words.replace(/(ألف|مليون|مليار)ان$/, '$1ا')} ${noun.singular}`;
  // Noun agreement is decided by the final group (1000 < n): 1 and 2 read as "…وواحد درهم".
  const r = last % 100;
  if (last >= 3 && last <= 10) return `${words} ${noun.plural}`;
  if (r >= 11) return `${words} ${noun.accusative}`;
  return `${words} ${noun.singular}`;
}

export function aedToArabicWords(minor: bigint): string {
  if (minor < 0n) throw new RangeError('Negative amounts are not written in words');
  const major = minor / 100n;
  const fils = minor % 100n;
  const parts: string[] = [];
  if (major > 0n || fils === 0n) parts.push(major === 0n ? `صفر ${DIRHAM.singular}` : amountWithNoun(major, DIRHAM));
  if (fils > 0n) parts.push(amountWithNoun(fils, FILS));
  return `فقط ${parts.join(' و')} لا غير`;
}
