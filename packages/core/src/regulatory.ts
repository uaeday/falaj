/**
 * Effective-dated regulatory configuration. Rates, thresholds and deadlines are data, not code.
 * Values with `verify: true` need confirming against the named authority. The admin UI shows them with
 * a warning badge until a compliance owner signs them off (see docs/04 §4.3).
 *
 * NOT LEGAL OR TAX ADVICE.
 */

export interface RuleVersion {
  key: string;
  /** Decimal numbers and ISO dates are stored as strings so they stay exact. */
  value: string;
  /** Inclusive ISO date from which this version applies. */
  effectiveFrom: string;
  /** Inclusive ISO date to which this version applies; open-ended if omitted. */
  effectiveTo?: string;
  source: string;
  authority: 'FTA' | 'MoF' | 'CBUAE' | 'MOHRE' | 'GPSSA' | 'Cabinet' | 'TDRA';
  verify: boolean;
  note?: string;
}

export class RegulatoryConfig {
  private readonly byKey = new Map<string, RuleVersion[]>();

  constructor(rules: readonly RuleVersion[]) {
    for (const r of rules) {
      const list = this.byKey.get(r.key) ?? [];
      list.push(r);
      this.byKey.set(r.key, list);
    }
    for (const [key, list] of this.byKey) {
      list.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      for (let i = 1; i < list.length; i++) {
        const prevEnd = list[i - 1]!.effectiveTo;
        if (!prevEnd || prevEnd >= list[i]!.effectiveFrom) throw new Error(`Overlapping versions for ${key}`);
      }
    }
  }

  /** The version in force on `date` (ISO). Throws if none, so a missing rule is never silently zero. */
  get(key: string, date: string): RuleVersion {
    const v = this.byKey.get(key)?.find((r) => r.effectiveFrom <= date && (!r.effectiveTo || date <= r.effectiveTo));
    if (!v) throw new RangeError(`No regulatory value for "${key}" on ${date}`);
    return v;
  }

  value(key: string, date: string): string {
    return this.get(key, date).value;
  }

  unverified(): RuleVersion[] {
    return [...this.byKey.values()].flat().filter((r) => r.verify);
  }

  /** Returns a new config with extra/overriding versions (e.g. a tenant-specific or newly published rule). */
  with(rules: readonly RuleVersion[]): RegulatoryConfig {
    const replaced = new Set(rules.map((r) => `${r.key}@${r.effectiveFrom}`));
    const kept = [...this.byKey.values()].flat().filter((r) => !replaced.has(`${r.key}@${r.effectiveFrom}`));
    return new RegulatoryConfig([...kept, ...rules]);
  }
}
