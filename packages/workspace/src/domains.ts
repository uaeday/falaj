/**
 * Domain name suggestions from the trade name (journey step 2). Falaj proposes; the registrar partner
 * confirms availability. .ae eligibility and naming rules come from the .ae registry (VERIFY TDRA/aeDA policy).
 */

const LEGAL_SUFFIXES = [
  'l.l.c', 'llc', 'fz-llc', 'fz llc', 'fzllc', 'fzco', 'fze', 'dmcc', 'est', 'establishment', 'co', 'company',
  'l.t.d', 'ltd', 'limited', 'sole proprietorship', 'one person company', 'opc', 'branch',
];
const GENERIC_WORDS = ['general', 'trading', 'services', 'service', 'consultancy', 'consultants', 'management', 'group', 'and', 'the', 'of', 'for'];

export const isValidLabel = (label: string): boolean => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !label.includes('--');

/** Lower-case words with punctuation and legal-form suffixes removed. */
export function nameWords(tradeName: string): string[] {
  let s = tradeName.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ');
  for (const suffix of LEGAL_SUFFIXES) s = s.replace(new RegExp(`(^|\\s)${suffix.replace(/[.\-]/g, '[.\\- ]?')}\\.?(\\s|$)`, 'g'), ' ');
  return s.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
}

export function suggestDomains(tradeName: string, opts: { tlds?: string[]; max?: number } = {}): string[] {
  const tlds = opts.tlds ?? ['ae', 'com'];
  const words = nameWords(tradeName);
  if (!words.length) return [];
  const core = words.filter((w) => !GENERIC_WORDS.includes(w));
  const base = core.length ? core : words;
  const labels = [
    base.join(''),
    base.join('-'),
    words.join(''),
    `${base.join('')}uae`,
    base.length > 1 ? base.map((w) => w[0]).join('') + base.at(-1) : `get${base[0]}`,
  ];
  const out: string[] = [];
  for (const label of labels) {
    if (!isValidLabel(label) || label.length < 3) continue;
    for (const tld of tlds) {
      const d = `${label}.${tld}`;
      if (!out.includes(d)) out.push(d);
    }
  }
  return out.slice(0, opts.max ?? 8);
}
