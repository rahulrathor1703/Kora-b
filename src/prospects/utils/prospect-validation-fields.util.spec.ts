import {
  getProspectValidationFields,
  filterProspectFullValidationFields,
} from './prospect-validation-fields.util';
import { PROSPECT_COMPANY_DETAILS_SECTION_FIELD_KEY } from './prospect-lead-type-fields.util';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

const COMPANY_SECTION_ID = '00000000-0000-4000-8001-000000000002';
const BASIC_SECTION_ID = '00000000-0000-4000-8001-000000000001';

function field(
  partial: Partial<ProspectFieldDefinition> &
    Pick<ProspectFieldDefinition, 'key'>,
): ProspectFieldDefinition {
  return {
    id: partial.id ?? '00000000-0000-4000-8000-000000000099',
    label: partial.label ?? partial.key,
    type: partial.type ?? 'text',
    sortOrder: partial.sortOrder ?? 0,
    showInTable: partial.showInTable ?? true,
    showInForm: partial.showInForm ?? true,
    ...partial,
  };
}

describe('getProspectValidationFields', () => {
  const schema = [
    field({ key: 'fullName', system: true, sectionId: BASIC_SECTION_ID }),
    field({ key: 'leadType', type: 'select', sectionId: BASIC_SECTION_ID }),
    field({
      id: COMPANY_SECTION_ID,
      key: PROSPECT_COMPANY_DETAILS_SECTION_FIELD_KEY,
      type: 'section',
    }),
    field({
      key: 'company',
      required: true,
      sectionId: COMPANY_SECTION_ID,
    }),
    field({ key: 'firstName', required: true, sectionId: BASIC_SECTION_ID }),
    field({ key: 'score', type: 'number' }),
    field({ key: 'bantTier', type: 'select' }),
  ];

  it('liveCreate mode excludes system fields and applies lead type rules', () => {
    const applicable = getProspectValidationFields(
      schema,
      { leadType: 'individual' },
      { mode: 'liveCreate' },
    );

    expect(applicable.map((item) => item.key)).toEqual([
      'leadType',
      'firstName',
    ]);
  });

  it('full mode includes non-section fields and applies lead type rules', () => {
    const applicable = getProspectValidationFields(
      schema,
      { leadType: 'company' },
      { mode: 'full' },
    );

    expect(applicable.map((item) => item.key)).toEqual([
      'fullName',
      'leadType',
      'company',
      'firstName',
    ]);
  });

  it('excludes BANT-computed fields from write validation', () => {
    const applicable = getProspectValidationFields(
      schema,
      { leadType: 'individual' },
      { mode: 'full' },
    );

    expect(applicable.map((item) => item.key)).not.toContain('score');
    expect(applicable.map((item) => item.key)).not.toContain('bantTier');
  });
});

describe('filterProspectFullValidationFields', () => {
  it('drops section rows', () => {
    const fields = [
      field({ key: 'firstName' }),
      field({
        key: PROSPECT_COMPANY_DETAILS_SECTION_FIELD_KEY,
        type: 'section',
      }),
    ];

    expect(
      filterProspectFullValidationFields(fields).map((f) => f.key),
    ).toEqual(['firstName']);
  });
});
