import { filterProspectLiveCreateFields } from './prospect-live-create-fields.util';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

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

describe('filterProspectLiveCreateFields', () => {
  it('includes org/platform fields placed in a layout section', () => {
    const fields = [
      field({ key: 'name', required: true, showInForm: true }),
      field({
        key: 'first_name',
        sectionId: 'section-1',
        required: true,
      }),
      field({
        key: 'lead_type',
        sectionId: 'section-1',
        type: 'select',
        options: [{ value: 'individual', label: 'Individual' }],
      }),
    ];

    const live = filterProspectLiveCreateFields(fields);

    expect(live.map((item) => item.key)).toEqual(['first_name', 'lead_type']);
  });

  it('excludes system fields and fields without sectionId', () => {
    const fields = [
      field({ key: 'fullName', system: true, sectionId: 'section-1' }),
      field({ key: 'email', system: true }),
      field({ key: 'custom', sectionId: 'section-1' }),
    ];

    const live = filterProspectLiveCreateFields(fields);

    expect(live.map((item) => item.key)).toEqual(['custom']);
  });
});
