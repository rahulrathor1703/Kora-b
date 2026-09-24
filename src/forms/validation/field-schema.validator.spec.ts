import { DEFAULT_COMPANY_FIELD_SCHEMA } from '../../companies/types/company-field-schema';
import { DEFAULT_PROSPECT_FIELD_SCHEMA } from '../../prospects/types/prospect-field-schema';
import { validateFormFieldSchema } from './field-schema.validator';

describe('validateFormFieldSchema', () => {
  it('accepts default CRM prospect field keys with camelCase', () => {
    const normalized = validateFormFieldSchema(
      DEFAULT_PROSPECT_FIELD_SCHEMA.fields.map((field, index) => ({
        ...field,
        sortOrder: index,
      })),
    );

    expect(normalized.some((field) => field.key === 'fullName')).toBe(true);
    expect(normalized.some((field) => field.key === 'leadStatus')).toBe(true);
  });

  it('accepts default CRM company field catalog with sections', () => {
    const normalized = validateFormFieldSchema(
      DEFAULT_COMPANY_FIELD_SCHEMA.fields.map((field, index) => ({
        ...field,
        sortOrder: index,
      })),
    );

    expect(normalized.some((field) => field.key === 'brokerName')).toBe(true);
    expect(normalized.some((field) => field.type === 'section')).toBe(true);
  });

  it('normalizes select options with colors and displayOptionsAsChips', () => {
    const normalized = validateFormFieldSchema([
      {
        id: 'f1',
        key: 'priority',
        label: 'Priority',
        type: 'select',
        sortOrder: 0,
        displayOptionsAsChips: true,
        options: [
          { value: ' high ', label: ' High ', color: ' #ff0000 ' },
          { value: 'low', label: 'Low' },
        ],
      },
    ]);

    expect(normalized[0]?.options).toEqual([
      { value: 'high', label: 'High', color: '#ff0000' },
      { value: 'low', label: 'Low', color: undefined },
    ]);
    expect(normalized[0]?.displayOptionsAsChips).toBe(true);
  });

  it('preserves displayOptionsAsChips false on multiselect fields', () => {
    const normalized = validateFormFieldSchema([
      {
        id: 'f2',
        key: 'tags',
        label: 'Tags',
        type: 'multiselect',
        sortOrder: 0,
        displayOptionsAsChips: false,
        options: [{ value: 'a', label: 'A' }],
      },
    ]);

    expect(normalized[0]?.displayOptionsAsChips).toBe(false);
  });

  it('defaults showInTable to true for non-section fields when unset', () => {
    const normalized = validateFormFieldSchema([
      {
        id: 'f3',
        key: 'vendor_code',
        label: 'Vendor code',
        type: 'text',
        sortOrder: 0,
      },
    ]);

    expect(normalized[0]?.showInTable).toBe(true);
  });

  it('preserves explicit showInTable false on non-section fields', () => {
    const normalized = validateFormFieldSchema([
      {
        id: 'f4',
        key: 'internal_note',
        label: 'Internal note',
        type: 'textarea',
        sortOrder: 0,
        showInTable: false,
      },
    ]);

    expect(normalized[0]?.showInTable).toBe(false);
  });
});
