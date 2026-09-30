import { SAMPLE_LICENCES, type TradeLicence, companyFromLicence } from '@falaj/company';
import { describe, expect, it } from 'vitest';
import { buildSite } from '../src/index.ts';

let n = 0;
const make = (l: TradeLicence) => {
  const r = companyFromLicence(l, { tenantId: 't', today: '2026-10-01', now: 'x', newId: () => `p${++n}` });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const opts = { domain: 'sidra.ae', contactEmail: 'info@sidra.ae', phone: '04 123 4567', whatsapp: '050 123 4567', year: 2026 };

describe('website builder (journey step 4)', () => {
  const site = buildSite(make(SAMPLE_LICENCES[0]!), opts);

  it('produces bilingual pages, privacy notices, robots and sitemap', () => {
    expect(Object.keys(site.files).sort()).toEqual(['ar/index.html', 'ar/privacy.html', 'index.html', 'privacy.html', 'robots.txt', 'sitemap.xml']);
  });

  it('English page carries licence disclosure, contact and WhatsApp', () => {
    const en = site.files['index.html']!;
    expect(en).toContain('<html lang="en" dir="ltr">');
    expect(en).toContain('Sidra Consultancy is licensed by Dubai Department of Economy and Tourism.');
    expect(en).toContain('Trade licence: <span class="num">1234567</span>');
    expect(en).toContain('href="https://wa.me/971501234567"');
    expect(en).toContain('href="tel:+97141234567"');
    expect(en).toContain('<li>Management Consultancy</li>');
    expect(en).toContain('Makani: <span class="num">2877396541</span>');
  });

  it('Arabic page is RTL with Arabic names', () => {
    const ar = site.files['ar/index.html']!;
    expect(ar).toContain('<html lang="ar" dir="rtl">');
    expect(ar).toContain('<h1>سدرة للاستشارات</h1>');
    expect(ar).toContain('<li>الاستشارات الإدارية</li>');
    expect(ar).toContain('دبي');
  });

  it('escapes hostile licence data and rejects CSS injection in brand colours', () => {
    const evil = {
      ...SAMPLE_LICENCES[1]!,
      tradeName: { en: '<script>alert(1)</script>', ar: '"><img src=x onerror=alert(1)>' },
      activities: [{ code: '1', name: { en: 'Trading </li><script>x</script>' } }],
    };
    const s = buildSite(make(evil), { ...opts, brand: { accent: 'red;}</style><script>alert(1)</script>' } });
    for (const f of ['index.html', 'ar/index.html']) {
      expect(s.files[f]).not.toContain('<script>');
      expect(s.files[f]).not.toContain('<img src=x');
    }
    expect(s.files['index.html']).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(s.files['index.html']).toContain('--accent:#1C6E8C');
  });

  it('falls back to English where Arabic is missing and omits absent contact lines', () => {
    const s = buildSite(make(SAMPLE_LICENCES[1]!), { domain: 'qattarafoods.ae', contactEmail: 'info@qattarafoods.ae', year: 2026 });
    expect(s.files['ar/index.html']).toContain('<h1>قطارة للأغذية</h1>');
    expect(s.files['index.html']).not.toContain('tel:');
    expect(s.files['index.html']).not.toContain('wa.me');
    expect(s.files['index.html']).toContain('What we trade');
  });
});
