import {
  LEAD_STATUS_FIELD_KEY,
  LEGACY_CRM_STATUS_FIELD_KEY,
} from '../types/prospect-field-schema';
import { normalizeProspectFieldSchemaFields } from './prospect-schema-normalize.util';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

function field(
  partial: Partial<ProspectFieldDefinition> &
    Pick<ProspectFieldDefinition, 'key'>,
): ProspectFieldDefinition {
  return {
    id: '00000000-0000-4000-8000-000000000099',
    label: partial.label ?? partial.key,
    type: partial.type ?? 'select',
    sortOrder: partial.sortOrder ?? 0,
    showInTable: partial.showInTable ?? true,
    showInForm: partial.showInForm ?? true,
    ...partial,
  };
}

describe('normalizeProspectFieldSchemaFields', () => {
  it('removes crmStatus when leadStatus exists and marks leadStatus as pipeline stage', () => {
    const fields = [
      field({ key: LEGACY_CRM_STATUS_FIELD_KEY, pipelineStage: true }),
      field({ key: LEAD_STATUS_FIELD_KEY, pipelineStage: false }),
    ];

    const normalized = normalizeProspectFieldSchemaFields(fields);

    expect(normalized.map((item) => item.key)).toEqual([LEAD_STATUS_FIELD_KEY]);
    expect(normalized[0]?.pipelineStage).toBe(true);
  });

  it('clears pipelineStage on non-leadStatus fields', () => {
    const fields = [
      field({ key: 'product', pipelineStage: true }),
      field({ key: LEAD_STATUS_FIELD_KEY }),
    ];

    const normalized = normalizeProspectFieldSchemaFields(fields);

    expect(
      normalized.find((item) => item.key === 'product')?.pipelineStage,
    ).toBe(false);
  });
});
