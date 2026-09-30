import { type Result, err, ok } from '@falaj/core';
import type { TradeLicence } from './types.ts';

export interface LicenceRef {
  authority: string;
  licenceNo: string;
}

export type LicenceImportError = { code: 'NOT_FOUND' | 'UNAVAILABLE' | 'CONSENT_REQUIRED'; message: string };

/**
 * Port for importing a licence (UAE PASS-linked licence data or an authority/partner API). Implementations
 * per authority; which integrations exist is a partnership question (strategy: GTM with licensing authorities).
 */
export interface LicenceSource {
  fetch(ref: LicenceRef): Promise<Result<TradeLicence, LicenceImportError>>;
}

/** Deterministic source for demos, tests and the December 2026 alpha before authority APIs are live. */
export class FixtureLicenceSource implements LicenceSource {
  constructor(private readonly licences: readonly TradeLicence[]) {}

  async fetch(ref: LicenceRef): Promise<Result<TradeLicence, LicenceImportError>> {
    const l = this.licences.find((x) => x.authority === ref.authority && x.licenceNo === ref.licenceNo);
    return l ? ok(structuredClone(l)) : err({ code: 'NOT_FOUND', message: `No licence ${ref.licenceNo} at ${ref.authority}` });
  }
}
