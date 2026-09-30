import { RegulatoryConfig } from '@falaj/core';
import { UAE_DEFAULT_RULES } from './uae-defaults.ts';

export { RegulatoryConfig, type RuleVersion } from '@falaj/core';
export { UAE_DEFAULT_RULES } from './uae-defaults.ts';

export const defaultUaeConfig = (): RegulatoryConfig => new RegulatoryConfig(UAE_DEFAULT_RULES);
