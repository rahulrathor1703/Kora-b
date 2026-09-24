import { filterCompanyLiveCreateFields } from './company-live-create-fields.util';
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

describe('filterCompanyLiveCreateFields', () => {
  it('includes org/platform fields placed in a layout section', () => {
    const fields = [
      field({ key: 'brokerName', system: true }),
      field({
        key: 'website',
        sectionId: 'section-1',
        required: true,
      }),
      field({
        key: 'custom_note',
        sectionId: 'section-1',
      }),
    ];

    const live = filterCompanyLiveCreateFields(fields);

    expect(live.map((item) => item.key)).toEqual(['website', 'custom_note']);
  });

  it('includes system brokerName when placed on the layout canvas', () => {
    const fields = [
      field({ key: 'brokerName', system: true, sectionId: 'section-1' }),
      field({ key: 'legacy', showInForm: true }),
      field({ key: 'custom', sectionId: 'section-1' }),
    ];

    const live = filterCompanyLiveCreateFields(fields);

    expect(live.map((item) => item.key)).toEqual(['brokerName', 'custom']);
  });

  it('excludes fields removed from the canvas', () => {
    const fields = [
      field({
        key: 'brokerName',
        system: true,
        showInForm: false,
        sectionId: undefined,
      }),
      field({ key: 'custom', sectionId: 'section-1' }),
    ];

    const live = filterCompanyLiveCreateFields(fields);

    expect(live.map((item) => item.key)).toEqual(['custom']);
  });
});
