import {
  getCompanyKnownValidationFields,
  getCompanyValidationFields,
} from './company-validation-fields.util';
import type { CompanyFieldDefinition } from '../types/company-field-schema';

function field(
  partial: Partial<CompanyFieldDefinition> &
    Pick<CompanyFieldDefinition, 'key'>,
): CompanyFieldDefinition {
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

describe('getCompanyValidationFields', () => {
  const fields = [
    field({ key: 'section_identity', type: 'section' }),
    field({ key: 'brokerName', system: true }),
    field({ key: 'website', sectionId: 'section-1' }),
    field({ key: 'orphan', showInForm: true }),
  ];

  it('liveCreate mode excludes sections, system, and fields without sectionId', () => {
    const applicable = getCompanyValidationFields(fields, {
      mode: 'liveCreate',
    });

    expect(applicable.map((item) => item.key)).toEqual(['website']);
  });

  it('full mode includes all non-section fields', () => {
    const applicable = getCompanyValidationFields(fields, { mode: 'full' });

    expect(applicable.map((item) => item.key)).toEqual([
      'brokerName',
      'website',
      'orphan',
    ]);
  });
});

describe('getCompanyKnownValidationFields', () => {
  it('returns all non-section schema keys for unknown-field checks', () => {
    const fields = [
      field({ key: 'section_a', type: 'section' }),
      field({ key: 'brokerName', system: true }),
      field({ key: 'website', sectionId: 'section-1' }),
    ];

    const known = getCompanyKnownValidationFields(fields);

    expect(known.map((item) => item.key)).toEqual(['brokerName', 'website']);
  });
});
