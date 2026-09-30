import { EMIRATE_NAMES, normalizeUaePhone } from '@falaj/core';
import { type Company, type Vertical, authority } from '@falaj/company';
import { type Raw, html, safeHex, toString } from './html.ts';

export interface SiteOptions {
  domain: string;
  contactEmail: string;
  phone?: string;
  whatsapp?: string;
  vatTrn?: string;
  brand?: { accent?: string; ink?: string };
  /** Year shown in the footer; passed in so builds are reproducible. */
  year: number;
}

export interface SiteBundle {
  domain: string;
  files: Record<string, string>;
}

type Lang = 'en' | 'ar';

const COPY = {
  en: {
    services: { PROFESSIONAL_SERVICES: 'Services', TRADING: 'What we trade', ECOMMERCE: 'What we sell', CONTRACTING: 'What we build', OTHER: 'What we do' },
    intro: (name: string, auth: string) => `${name} is licensed by ${auth}.`,
    contact: 'Contact', email: 'Email', phone: 'Phone', whatsapp: 'Message us on WhatsApp', address: 'Address', makani: 'Makani',
    licence: 'Trade licence', trn: 'TRN', privacy: 'Privacy notice', other: 'العربية', poBox: 'P.O. Box', by: 'Site by falaj',
  },
  ar: {
    services: { PROFESSIONAL_SERVICES: 'خدماتنا', TRADING: 'مجالات تجارتنا', ECOMMERCE: 'منتجاتنا', CONTRACTING: 'أعمالنا', OTHER: 'نشاطنا' },
    intro: (name: string, auth: string) => `${name} مرخصة من ${auth}.`,
    contact: 'تواصل معنا', email: 'البريد الإلكتروني', phone: 'الهاتف', whatsapp: 'راسلنا عبر واتساب', address: 'العنوان', makani: 'مكاني',
    licence: 'الرخصة التجارية', trn: 'الرقم الضريبي', privacy: 'إشعار الخصوصية', other: 'English', poBox: 'ص.ب', by: 'الموقع من فلج',
  },
} as const;

function page(lang: Lang, title: string, body: Raw, o: SiteOptions, altHref: string): string {
  const accent = safeHex(o.brand?.accent, '#1C6E8C');
  const ink = safeHex(o.brand?.ink, '#1B2330');
  const doc = html`<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="alternate" hreflang="${lang === 'ar' ? 'en' : 'ar'}" href="${altHref}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap">
<style>
:root{--accent:${accent};--ink:${ink};--muted:#5F6B7A;--line:#E3E7EC;--bg:#FBFBFA}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 "IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif}
html[lang=ar] body{font-family:"IBM Plex Sans Arabic","IBM Plex Sans",Tahoma,sans-serif}
.w{max-width:960px;margin:0 auto;padding:0 20px}header{display:flex;justify-content:space-between;align-items:center;padding:20px 0;gap:12px}
header b{font-size:20px}a{color:var(--accent)}h1{font-size:clamp(32px,6vw,52px);line-height:1.1;margin:48px 0 12px}
h2{font-size:24px;margin:40px 0 12px}ul{padding-inline-start:20px}section{border-top:1px solid var(--line)}
.cta{display:inline-block;background:var(--accent);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;margin-top:8px}
.num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
footer{border-top:1px solid var(--line);margin-top:48px;padding:20px 0 40px;font-size:14px;color:var(--muted)}
</style>
</head>
<body>${body}</body>
</html>
`;
  return toString(doc);
}

export function buildSite(c: Company, o: SiteOptions): SiteBundle {
  const auth = authority(c.authority);
  const files: Record<string, string> = {};
  const wa = o.whatsapp ? normalizeUaePhone(o.whatsapp) : undefined;
  const phone = o.phone ? normalizeUaePhone(o.phone) : undefined;

  for (const lang of ['en', 'ar'] as const) {
    const t = COPY[lang];
    const name = (lang === 'ar' ? c.tradeName.ar : undefined) ?? c.tradeName.en;
    const authName = auth ? (lang === 'ar' ? auth.name.ar : auth.name.en) : c.authority;
    const prefix = lang === 'ar' ? '../' : '';
    const altHref = lang === 'ar' ? '../index.html' : 'ar/index.html';
    const emirate = EMIRATE_NAMES[c.address.emirate][lang];
    const addr = [c.address.unit, c.address.building, c.address.area, emirate].filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
    const vertical: Vertical = c.vertical;

    const body = html`
<div class="w">
<header><b>${name}</b><a href="${altHref}" lang="${lang === 'ar' ? 'en' : 'ar'}">${t.other}</a></header>
<h1>${name}</h1>
<p>${t.intro(name, authName)}</p>
<section><h2>${t.services[vertical]}</h2>
<ul>${c.activities.map((a) => html`<li>${lang === 'ar' ? (a.name.ar ?? a.name.en) : a.name.en}</li>`)}</ul></section>
<section><h2>${t.contact}</h2>
<p>${t.email}: <a class="num" href="mailto:${o.contactEmail}">${o.contactEmail}</a></p>
${phone ? html`<p>${t.phone}: <a class="num" href="tel:${phone}">${phone}</a></p>` : null}
${wa ? html`<p><a class="cta" href="https://wa.me/${wa.slice(1)}">${t.whatsapp}</a></p>` : null}
<p>${t.address}: ${addr}${c.address.poBox ? html`, ${t.poBox} <span class="num">${c.address.poBox}</span>` : null}</p>
${c.address.makani ? html`<p>${t.makani}: <span class="num">${c.address.makani}</span></p>` : null}
</section>
<footer>
<p>${c.legalName.en}${c.legalName.ar ? html` · <span lang="ar">${c.legalName.ar}</span>` : null}</p>
<p>${t.licence}: <span class="num">${c.licenceNo}</span> · ${authName}${o.vatTrn ? html` · ${t.trn}: <span class="num">${o.vatTrn}</span>` : null}</p>
<p><a href="${prefix}${lang === 'ar' ? 'ar/' : ''}privacy.html">${t.privacy}</a> · © ${o.year} · ${t.by}</p>
</footer>
</div>`;
    files[`${lang === 'ar' ? 'ar/' : ''}index.html`] = page(lang, name, body, o, altHref);

    const privacy = html`
<div class="w"><header><b>${name}</b></header>
<h1>${t.privacy}</h1>
<p>[${lang === 'ar' ? 'نموذج — يراجعه المستشار القانوني قبل النشر' : 'Template: to be reviewed by counsel before publishing'}]</p>
<p>${lang === 'ar'
      ? `تتولى ${c.legalName.ar ?? c.legalName.en} معالجة البيانات الشخصية وفق المرسوم بقانون اتحادي رقم 45 لسنة 2021. للتواصل: `
      : `${c.legalName.en} processes personal data in line with Federal Decree-Law No. 45 of 2021 (PDPL). Contact: `}<a class="num" href="mailto:${o.contactEmail}">${o.contactEmail}</a></p>
</div>`;
    files[`${lang === 'ar' ? 'ar/' : ''}privacy.html`] = page(lang, `${t.privacy} · ${name}`, privacy, o, lang === 'ar' ? '../privacy.html' : 'ar/privacy.html');
  }

  files['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: https://${o.domain}/sitemap.xml\n`;
  files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'ar/'].map((p) => `  <url><loc>https://${o.domain}/${p}</loc></url>`).join('\n')}\n</urlset>\n`;
  return { domain: o.domain, files };
}

/** Hosting port (Falaj Sites on UAE-region object storage + CDN). */
export interface SitePublisher {
  publish(bundle: SiteBundle, idempotencyKey: string): Promise<{ url: string; version: string }>;
}

export class FakeSitePublisher implements SitePublisher {
  readonly published = new Map<string, SiteBundle>();
  async publish(bundle: SiteBundle) {
    this.published.set(bundle.domain, bundle);
    return { url: `https://${bundle.domain}/`, version: `v${this.published.size}` };
  }
}
