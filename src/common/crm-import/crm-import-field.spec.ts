import { BadRequestException } from '@nestjs/common';
import {
  assertRequiredFieldsMapped,
  assertUniqueFieldMappingColumns,
  buildImportableFieldDescriptors,
  mapCsvRowToRawValues,
} from './crm-import-field.utils';

describe('crm-import-field.utils', () => {
  it('builds importable field descriptors with location components', () => {
    const descriptors = buildImportableFieldDescriptors([
      {
        key: 'fullName',
        label: 'Name',
        type: 'text',
        required: true,
      },
      {
        key: 'office',
        label: 'Office',
        type: 'location',
        required: true,
        locationComponents: ['city', 'country'] as const,
      },
    ]);

    expect(descriptors).toEqual([
      expect.objectContaining({
        key: 'fullName',
        type: 'text',
        required: true,
      }),
      expect.objectContaining({
        key: 'office.city',
        type: 'location-component',
        required: true,
      }),
      expect.objectContaining({
        key: 'office.country',
        type: 'location-component',
        required: true,
      }),
    ]);
  });

  it('rejects duplicate column mappings', () => {
    expect(() =>
      assertUniqueFieldMappingColumns({
        email: 'Email',
        fullName: 'Email',
      }),
    ).toThrow(BadRequestException);
  });

  it('requires mapped required fields', () => {
    expect(() =>
      assertRequiredFieldsMapped(
        [
          {
            key: 'email',
            label: 'Email',
            type: 'email',
            required: true,
          },
        ],
        {},
      ),
    ).toThrow(BadRequestException);
  });

  it('maps select values by label', () => {
    const values = mapCsvRowToRawValues(
      { Status: 'Hot Lead' },
      { crmStatus: 'Status' },
      [
        {
          key: 'crmStatus',
          label: 'Status',
          type: 'select',
          options: [{ value: 'hot', label: 'Hot Lead' }],
        },
      ],
    );

    expect(values.crmStatus).toBe('hot');
  });

  it('maps multiselect comma-separated labels', () => {
    const values = mapCsvRowToRawValues(
      { Tags: 'Alpha, Beta' },
      { tags: 'Tags' },
      [
        {
          key: 'tags',
          label: 'Tags',
          type: 'multiselect',
          options: [
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ],
        },
      ],
    );

    expect(values.tags).toEqual(['a', 'b']);
  });

  it('throws for invalid select values', () => {
    expect(() =>
      mapCsvRowToRawValues({ Status: 'Missing' }, { crmStatus: 'Status' }, [
        {
          key: 'crmStatus',
          label: 'Status',
          type: 'select',
          options: [{ value: 'a', label: 'Alpha' }],
        },
      ]),
    ).toThrow(BadRequestException);
  });
});
