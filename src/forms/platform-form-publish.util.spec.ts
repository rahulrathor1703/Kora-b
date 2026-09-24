import type { FormSchemaEntity } from './entities/form-schema.entity';
import {
  computeRemovedDefinitionKeys,
  getPublishedPlatformFields,
  getPublishedPlatformLayout,
  getPublishedPlatformSteps,
  platformSchemaHasUnpublishedChanges,
  platformSchemaNeedsRegistryBackfill,
} from './platform-form-publish.util';
import type { FormFieldDefinition } from './types/form-schema.types';

function field(
  partial: Partial<FormFieldDefinition> & Pick<FormFieldDefinition, 'key'>,
): FormFieldDefinition {
  return {
    id: partial.id ?? partial.key,
    label: partial.label ?? partial.key,
    type: partial.type ?? 'text',
    sortOrder: partial.sortOrder ?? 0,
    showInTable: partial.showInTable ?? true,
    showInForm: partial.showInForm ?? true,
    ...partial,
  };
}

describe('platformSchemaNeedsRegistryBackfill', () => {
  it('returns true only when platform fields were never saved', () => {
    expect(
      platformSchemaNeedsRegistryBackfill({
        fields: [],
      } as FormSchemaEntity),
    ).toBe(true);
  });

  it('does not reset customized company forms missing registry sections', () => {
    expect(
      platformSchemaNeedsRegistryBackfill({
        fields: [field({ key: 'custom_note', sectionId: 's1' })],
      } as FormSchemaEntity),
    ).toBe(false);
  });

  it('does not reset legacy categoryId rows on every load', () => {
    expect(
      platformSchemaNeedsRegistryBackfill({
        fields: [field({ key: 'categoryId' }), field({ key: 'brokerName' })],
      } as FormSchemaEntity),
    ).toBe(false);
  });
});

describe('getPublishedPlatformFields', () => {
  it('returns published snapshot when present', () => {
    const entity = {
      fields: [field({ key: 'draft_only' })],
      publishedFields: [field({ key: 'published' })],
      publishedVersion: 1,
    } as FormSchemaEntity;

    expect(getPublishedPlatformFields(entity).map((f) => f.key)).toEqual([
      'published',
    ]);
  });

  it('falls back to draft fields when published snapshot is empty', () => {
    const entity = {
      fields: [field({ key: 'draft_only' })],
      publishedFields: [],
      publishedVersion: 2,
    } as FormSchemaEntity;

    expect(getPublishedPlatformFields(entity).map((f) => f.key)).toEqual([
      'draft_only',
    ]);
  });
});

describe('getPublishedPlatformLayout', () => {
  it('returns published layout after first publish', () => {
    const entity = {
      layout: { columns: 2 },
      publishedLayout: { columns: 3 },
      publishedVersion: 1,
    } as FormSchemaEntity;

    expect(getPublishedPlatformLayout(entity)).toEqual({ columns: 3 });
  });

  it('falls back to draft layout before first publish', () => {
    const entity = {
      layout: { columns: 2 },
      publishedLayout: null,
      publishedVersion: 0,
    } as FormSchemaEntity;

    expect(getPublishedPlatformLayout(entity)).toEqual({ columns: 2 });
  });
});

describe('getPublishedPlatformSteps', () => {
  it('returns published steps after first publish', () => {
    const entity = {
      steps: [{ id: 'draft', label: 'Draft', sortOrder: 0 }],
      publishedSteps: [{ id: 'live', label: 'Live', sortOrder: 0 }],
      publishedVersion: 1,
    } as FormSchemaEntity;

    expect(getPublishedPlatformSteps(entity)?.[0]?.id).toBe('live');
  });
});

describe('computeRemovedDefinitionKeys', () => {
  it('lists keys removed from the next snapshot', () => {
    expect(
      computeRemovedDefinitionKeys(
        [field({ key: 'a' }), field({ key: 'b' })],
        [field({ key: 'b' }), field({ key: 'c' })],
      ),
    ).toEqual(['a']);
  });
});

describe('platformSchemaHasUnpublishedChanges', () => {
  it('detects draft drift from published snapshot', () => {
    const entity = {
      fields: [field({ key: 'a', label: 'Draft' })],
      publishedFields: [field({ key: 'a', label: 'Published' })],
      tableColumns: [],
      publishedTableColumns: [],
      layout: null,
      publishedLayout: null,
      steps: null,
      publishedSteps: null,
    } as FormSchemaEntity;

    expect(platformSchemaHasUnpublishedChanges(entity)).toBe(true);
  });

  it('detects canvas-only changes after draft save', () => {
    const entity = {
      fields: [
        field({
          key: 'brokerName',
          sectionId: 'section-1',
          showInForm: false,
        }),
      ],
      publishedFields: [
        field({
          key: 'brokerName',
          sectionId: 'section-1',
          showInForm: true,
        }),
      ],
      tableColumns: [],
      publishedTableColumns: [],
      layout: null,
      publishedLayout: null,
      steps: null,
      publishedSteps: null,
    } as FormSchemaEntity;

    expect(platformSchemaHasUnpublishedChanges(entity)).toBe(true);
  });

  it('detects unpublished layout changes', () => {
    const entity = {
      fields: [field({ key: 'a' })],
      publishedFields: [field({ key: 'a' })],
      tableColumns: [],
      publishedTableColumns: [],
      layout: { columns: 2 },
      publishedLayout: { columns: 1 },
      steps: null,
      publishedSteps: null,
    } as FormSchemaEntity;

    expect(platformSchemaHasUnpublishedChanges(entity)).toBe(true);
  });
});
