import { BadRequestException } from '@nestjs/common';
import type { FormFieldDefinition } from './types/form-schema.types';
import {
  applyOptionColorOverlay,
  extractOrgExtensionFields,
  mergePlatformFieldForOrg,
  mergePlatformFieldWithOrgOverlay,
} from './org-extension-fields.util';

function platformField(
  partial: Partial<FormFieldDefinition> &
    Pick<FormFieldDefinition, 'key' | 'label' | 'type'>,
): FormFieldDefinition {
  return {
    id: partial.id ?? `platform-${partial.key}`,
    sortOrder: partial.sortOrder ?? 0,
    showInTable: partial.showInTable ?? true,
    showInForm: partial.showInForm ?? true,
    ...partial,
  };
}

describe('applyOptionColorOverlay', () => {
  it('merges colors by option value and ignores unknown overlay values', () => {
    const platform = [
      { value: 'a', label: 'A', color: '#111111' },
      { value: 'b', label: 'B' },
    ];
    const overlay = [
      { value: 'a', label: 'A', color: '#222222' },
      { value: 'c', label: 'C', color: '#333333' },
    ];

    expect(applyOptionColorOverlay(platform, overlay)).toEqual([
      { value: 'a', label: 'A', color: '#222222' },
      { value: 'b', label: 'B' },
    ]);
  });
});

describe('extractOrgExtensionFields', () => {
  const platformFields = [
    platformField({
      key: 'fullName',
      label: 'Name',
      type: 'text',
      required: true,
    }),
    platformField({
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    }),
  ];

  it('preserves validation rules on org-only fields', () => {
    const orgCustom = platformField({
      id: 'org-1',
      key: 'custom_code',
      label: 'Custom code',
      type: 'text',
      minLength: 4,
      validationType: 'alphanumeric',
    });

    const orgFields = extractOrgExtensionFields(
      [...platformFields, orgCustom],
      platformFields,
    );

    expect(orgFields[0]?.minLength).toBe(4);
    expect(orgFields[0]?.validationType).toBe('alphanumeric');
  });

  it('returns only org-only keys and ignores platform layout drift', () => {
    const orgCustom = platformField({
      id: 'org-1',
      key: 'custom_note',
      label: 'Custom note',
      type: 'textarea',
    });

    const submitted = [
      ...platformFields.map((field) => ({
        ...field,
        sectionId: 'different-section',
        showInForm: false,
      })),
      orgCustom,
    ];

    const orgFields = extractOrgExtensionFields(submitted, platformFields);

    expect(orgFields).toHaveLength(1);
    expect(orgFields[0]?.key).toBe('custom_note');
  });

  it('rejects structural edits to platform fields', () => {
    const submitted = [
      { ...platformFields[0], label: 'Renamed' },
      platformFields[1],
    ];

    expect(() => extractOrgExtensionFields(submitted, platformFields)).toThrow(
      BadRequestException,
    );
  });

  it('rejects removing platform fields', () => {
    expect(() =>
      extractOrgExtensionFields([platformFields[0]], platformFields),
    ).toThrow(BadRequestException);
  });

  it('stores color-only overlay for chip platform selects', () => {
    const chipPlatform = platformField({
      key: 'emailStatus',
      label: 'Email Status',
      type: 'select',
      displayOptionsAsChips: true,
      options: [
        { value: 'eligible', label: 'eligible', color: '#f59e0b' },
        { value: 'done', label: 'Done', color: '#3b82f6' },
      ],
    });

    const submitted = [
      ...platformFields,
      {
        ...chipPlatform,
        options: [
          { value: 'eligible', label: 'eligible', color: '#111111' },
          { value: 'done', label: 'Done', color: '#3b82f6' },
        ],
      },
    ];

    const orgFields = extractOrgExtensionFields(submitted, [
      ...platformFields,
      chipPlatform,
    ]);

    expect(orgFields).toHaveLength(1);
    expect(orgFields[0]?.key).toBe('emailStatus');
    expect(orgFields[0]?.options?.[0]?.color).toBe('#111111');
  });

  it('omits overlay when chip colors match platform', () => {
    const chipPlatform = platformField({
      key: 'emailStatus',
      label: 'Email Status',
      type: 'select',
      displayOptionsAsChips: true,
      options: [{ value: 'eligible', label: 'eligible', color: '#f59e0b' }],
    });

    const orgFields = extractOrgExtensionFields(
      [...platformFields, chipPlatform],
      [...platformFields, chipPlatform],
    );

    expect(orgFields).toHaveLength(0);
  });

  it('rejects option structure changes on non-pipeline chip fields', () => {
    const chipPlatform = platformField({
      key: 'emailStatus',
      label: 'Email Status',
      type: 'select',
      displayOptionsAsChips: true,
      options: [{ value: 'eligible', label: 'eligible' }],
    });

    const submitted = [
      ...platformFields,
      {
        ...chipPlatform,
        options: [{ value: 'eligible', label: 'Renamed label' }],
      },
    ];

    expect(() =>
      extractOrgExtensionFields(submitted, [...platformFields, chipPlatform]),
    ).toThrow(BadRequestException);
  });

  it('stores minimal options overlay for pipeline stage fields', () => {
    const pipelinePlatform = platformField({
      key: 'leadStatus',
      label: 'Lead Status',
      type: 'select',
      pipelineStage: true,
      options: [
        { value: 'new', label: 'New', color: '#64748b' },
        { value: 'contacted', label: 'Contacted', color: '#3b82f6' },
      ],
    });

    const submitted = [
      ...platformFields,
      {
        ...pipelinePlatform,
        options: [
          { value: 'new', label: 'New', color: '#64748b' },
          { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
          { value: 'qualified', label: 'Qualified', color: '#06b6d4' },
        ],
      },
    ];

    const orgFields = extractOrgExtensionFields(submitted, [
      ...platformFields,
      pipelinePlatform,
    ]);

    expect(orgFields).toHaveLength(1);
    expect(orgFields[0]?.key).toBe('leadStatus');
    expect(orgFields[0]?.options).toEqual([
      { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
      { value: 'qualified', label: 'Qualified', color: '#06b6d4' },
    ]);
    expect(orgFields[0]?.pipelineStage).toBe(true);
  });
});

describe('mergePlatformFieldForOrg', () => {
  it('tags platform fields and ignores stored org overrides', () => {
    const merged = mergePlatformFieldForOrg(
      platformField({
        key: 'email',
        label: 'Email',
        type: 'email',
        sectionId: 'platform-section',
      }),
    );

    expect(merged.source).toBe('platform');
    expect(merged.sectionId).toBe('platform-section');
  });
});

describe('mergePlatformFieldWithOrgOverlay', () => {
  it('applies chip color overlay on read', () => {
    const platform = platformField({
      key: 'emailStatus',
      label: 'Email Status',
      type: 'select',
      displayOptionsAsChips: true,
      options: [
        { value: 'eligible', label: 'eligible', color: '#f59e0b' },
        { value: 'done', label: 'Done', color: '#3b82f6' },
      ],
    });

    const overlay: FormFieldDefinition = {
      id: platform.id,
      key: platform.key,
      label: platform.label,
      type: platform.type,
      sortOrder: 0,
      options: [{ value: 'eligible', label: 'eligible', color: '#111111' }],
      source: 'org',
    };

    const merged = mergePlatformFieldWithOrgOverlay(platform, overlay);

    expect(merged.source).toBe('platform');
    expect(merged.options?.[0]?.color).toBe('#111111');
    expect(merged.options?.[1]?.color).toBe('#3b82f6');
  });

  it('merges pipeline stage overlay onto platform baseline', () => {
    const platform = platformField({
      key: 'leadStatus',
      label: 'Lead Status',
      type: 'select',
      pipelineStage: true,
      options: [
        { value: 'new', label: 'New', color: '#64748b' },
        { value: 'contacted', label: 'Contacted', color: '#3b82f6' },
      ],
    });

    const overlay: FormFieldDefinition = {
      id: platform.id,
      key: platform.key,
      label: platform.label,
      type: platform.type,
      sortOrder: 0,
      pipelineStage: true,
      options: [
        { value: 'contacted', label: 'Contacted', color: '#f59e0b' },
        { value: 'eqweq', label: 'Custom', color: '#ec4899' },
      ],
      source: 'org',
    };

    const merged = mergePlatformFieldWithOrgOverlay(platform, overlay);

    expect(merged.options).toEqual([
      {
        value: 'new',
        label: 'New',
        color: '#64748b',
        source: 'platform',
      },
      {
        value: 'contacted',
        label: 'Contacted',
        color: '#f59e0b',
        source: 'platform',
      },
      {
        value: 'eqweq',
        label: 'Custom',
        color: '#ec4899',
        source: 'org',
      },
    ]);
  });
});
