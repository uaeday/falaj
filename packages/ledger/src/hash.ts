import { createHash } from 'node:crypto';

/**
 * Deterministic JSON: object keys sorted, bigint as decimal string, objects with toJSON() serialised via it,
 * undefined properties dropped. Two logically equal values always hash the same.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}

function normalise(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return normalise((value as { toJSON: () => unknown }).toJSON());
  }
  if (Array.isArray(value)) return value.map(normalise);
  if (value instanceof Set) return [...value].map(normalise).sort();
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) out[key] = normalise(v);
  }
  return out;
}

export const sha256 = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex');

export const GENESIS_HASH = '0'.repeat(64);

export interface AuditEventInput {
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  at: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export interface AuditEvent extends AuditEventInput {
  seq: number;
  prevHash: string;
  hash: string;
}

export const hashAuditEvent = (prevHash: string, event: AuditEventInput & { seq: number }): string =>
  sha256(prevHash + canonicalJson(event));

/** Append-only, per-tenant hash chain: hash(n) = SHA-256(hash(n-1) ‖ canonical(event n)). */
export class HashChain {
  private readonly events: AuditEvent[] = [];

  append(input: AuditEventInput): AuditEvent {
    const prev = this.events.at(-1);
    const seq = (prev?.seq ?? 0) + 1;
    const prevHash = prev?.hash ?? GENESIS_HASH;
    const event: AuditEvent = Object.freeze({ ...input, seq, prevHash, hash: hashAuditEvent(prevHash, { ...input, seq }) });
    this.events.push(event);
    return event;
  }

  all(): readonly AuditEvent[] {
    return this.events;
  }
}

export type ChainVerification = { valid: true; head: string; length: number } | { valid: false; brokenAt: number };

export function verifyChain(events: readonly AuditEvent[]): ChainVerification {
  let prevHash = GENESIS_HASH;
  for (const [i, e] of events.entries()) {
    const { hash, prevHash: storedPrev, ...rest } = e;
    if (e.seq !== i + 1 || storedPrev !== prevHash || hashAuditEvent(prevHash, rest) !== hash) {
      return { valid: false, brokenAt: e.seq };
    }
    prevHash = hash;
  }
  return { valid: true, head: prevHash, length: events.length };
}
