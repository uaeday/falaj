const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML element content and quoted attributes. Every licence/customer field passes through this. */
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** Tagged template that escapes interpolations unless they are `raw()`-wrapped fragments built by this module. */
const RAW = Symbol('raw');
export type Raw = { [RAW]: string };
export const raw = (html: string): Raw => ({ [RAW]: html });
export function html(strings: TemplateStringsArray, ...values: (string | number | Raw | Raw[] | undefined | null | false)[]): Raw {
  let out = strings[0]!;
  values.forEach((v, i) => {
    if (v === undefined || v === null || v === false) out += '';
    else if (Array.isArray(v)) out += v.map((x) => x[RAW]).join('');
    else if (typeof v === 'object') out += v[RAW];
    else out += esc(String(v));
    out += strings[i + 1]!;
  });
  return raw(out);
}
export const toString = (r: Raw): string => r[RAW];

/** A colour must be a 6-digit hex; anything else falls back, so user input can never break out of CSS. */
export const safeHex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);
