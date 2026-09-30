import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  // Workspace domain packages ship TypeScript source.
  transpilePackages: ['@falaj/core', '@falaj/ledger', '@falaj/tax-uae', '@falaj/company', '@falaj/compliance', '@falaj/provisioning', '@falaj/website', '@falaj/workspace'],
  poweredByHeader: false,
};

export default withNextIntl(config);
