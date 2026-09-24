import type { FieldStoredValue } from '../../common/location/location-field.types';
import { BANT_RESPONSES_VALUE_KEY } from '../../bant-settings/types/bant-settings.types';
import type {
  BantResponses,
  BantSettingsConfig,
} from '../../bant-settings/types/bant-settings.types';
import {
  computeWeightedBantScore,
  resolveBantTier,
} from '../../bant-settings/utils/bant-scoring.utils';

export const PROSPECT_BANT_COMPUTED_FIELD_KEYS = ['score', 'bantTier'] as const;

export type ProspectBantComputedFieldKey =
  (typeof PROSPECT_BANT_COMPUTED_FIELD_KEYS)[number];

const BANT_COMPUTED_KEY_SET = new Set<string>(
  PROSPECT_BANT_COMPUTED_FIELD_KEYS,
);

export function isProspectBantComputedFieldKey(key: string): boolean {
  return BANT_COMPUTED_KEY_SET.has(key);
}

export function isProspectBantComputedField(field: { key: string }): boolean {
  return isProspectBantComputedFieldKey(field.key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractProspectBantResponses(
  values: Record<string, FieldStoredValue | undefined>,
): BantResponses {
  const raw = values[BANT_RESPONSES_VALUE_KEY];
  if (!isRecord(raw)) {
    return {};
  }

  const responses: BantResponses = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) {
      responses[key] = value.trim();
    }
  }

  return responses;
}

/** Writes `score` and `bantTier` on `values` from stored BANT responses. */
export function applyProspectBantComputedFieldValues(
  values: Record<string, FieldStoredValue>,
  config: BantSettingsConfig,
): void {
  const responses = extractProspectBantResponses(values);
  const computedScore = computeWeightedBantScore(config, responses);
  const computedTier = resolveBantTier(computedScore, config.tiers);

  if (computedScore === null) {
    return;
  }

  values.score = computedScore;
  values.bantTier = computedTier ?? null;
}
