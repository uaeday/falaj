const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(r < 20 ? ONES[r]! : TENS[Math.floor(r / 10)]! + (r % 10 ? `-${ONES[r % 10]}` : ''));
  return parts.join(' ');
}

export function integerToEnglish(value: bigint): string {
  if (value < 0n) throw new RangeError('Negative amounts are not written in words');
  if (value === 0n) return 'zero';
  const groups: string[] = [];
  let n = value;
  let scale = 0;
  while (n > 0n) {
    const g = Number(n % 1000n);
    if (g) {
      if (scale >= SCALES.length) throw new RangeError('Amount too large');
      groups.unshift(`${below1000(g)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
    }
    n /= 1000n;
    scale++;
  }
  return groups.join(' ');
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "One thousand two hundred fifty dirhams and fifty fils only". Minor units assumed to be 100 per major. */
export function aedToEnglishWords(minor: bigint): string {
  const major = minor / 100n;
  const fils = minor % 100n;
  const parts = [`${integerToEnglish(major)} ${major === 1n ? 'dirham' : 'dirhams'}`];
  if (fils) parts.push(`${integerToEnglish(fils)} fils`);
  return `${capitalise(parts.join(' and '))} only`;
}
