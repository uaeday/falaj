import { describe, expect, it } from 'vitest';
import { HashChain, canonicalJson, verifyChain } from '../src/index.ts';

describe('hash chain', () => {
  const build = (n: number) => {
    const chain = new HashChain();
    for (let i = 0; i < n; i++) {
      chain.append({ tenantId: 't', action: 'x.updated', entityType: 'x', entityId: `id-${i}`, actorId: 'u', at: '2027-01-01T00:00:00Z', after: { i } });
    }
    return chain.all().map((e) => ({ ...e }));
  };

  it('verifies an untouched chain of 1,000 events', () => {
    expect(verifyChain(build(1000))).toMatchObject({ valid: true, length: 1000 });
  });

  it('detects an edited event', () => {
    const events = build(1000);
    events[499] = { ...events[499]!, after: { i: 'tampered' } };
    expect(verifyChain(events)).toEqual({ valid: false, brokenAt: 500 });
  });

  it('detects a deleted event', () => {
    const events = build(10);
    events.splice(3, 1);
    expect(verifyChain(events)).toEqual({ valid: false, brokenAt: 5 });
  });

  it('canonical JSON is key-order independent and bigint-safe', () => {
    expect(canonicalJson({ b: 1n, a: [2, { d: undefined, c: 3 }] })).toBe(canonicalJson({ a: [2, { c: 3 }], b: 1n }));
  });
});
