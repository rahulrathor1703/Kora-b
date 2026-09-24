import { createDefaultBantSettingsConfig } from '../../bant-settings/types/default-bant-settings';
import {
  applyProspectBantComputedFieldValues,
  isProspectBantComputedField,
  isProspectBantComputedFieldKey,
  PROSPECT_BANT_COMPUTED_FIELD_KEYS,
} from './prospect-bant-computed-fields.util';

describe('prospect-bant-computed-fields.util', () => {
  it('lists score and bantTier as computed keys', () => {
    expect(PROSPECT_BANT_COMPUTED_FIELD_KEYS).toEqual(['score', 'bantTier']);
  });

  it('identifies BANT-computed field keys', () => {
    expect(isProspectBantComputedFieldKey('score')).toBe(true);
    expect(isProspectBantComputedFieldKey('bantTier')).toBe(true);
    expect(isProspectBantComputedFieldKey('fullName')).toBe(false);
  });

  it('identifies BANT-computed fields by key', () => {
    expect(isProspectBantComputedField({ key: 'bantTier' })).toBe(true);
    expect(isProspectBantComputedField({ key: 'email' })).toBe(false);
  });

  it('derives score and tier from stored BANT responses', () => {
    const values: Record<string, unknown> = {
      bantResponses: {
        need: 'clear',
        budget: 'confirmed',
        timeline: 'near_term',
        authority: 'decision_maker',
      },
    };

    applyProspectBantComputedFieldValues(
      values as Record<string, never>,
      createDefaultBantSettingsConfig(),
    );

    expect(typeof values.score).toBe('number');
    expect(values.bantTier).toBeTruthy();
  });
});
