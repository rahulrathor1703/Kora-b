import type { FormSchemaEntity } from './entities/form-schema.entity';
import type {
  FormFieldDefinition,
  FormLayoutConfig,
  FormTableColumnDefinition,
  FormWizardStepDefinition,
} from './types/form-schema.types';

function hasPublishedSnapshot(entity: FormSchemaEntity): boolean {
  return entity.publishedVersion >= 1;
}

/**
 * Only seed platform rows that were never populated. Do not infer legacy migrations
 * on every read — that overwrote superadmin drafts with code defaults.
 */
export function platformSchemaNeedsRegistryBackfill(
  entity: FormSchemaEntity,
): boolean {
  return entity.fields.length === 0;
}

export function getPublishedPlatformFields(
  entity: FormSchemaEntity,
): FormFieldDefinition[] {
  if (entity.publishedFields.length > 0) {
    return entity.publishedFields;
  }

  if (entity.fields.length > 0) {
    return entity.fields;
  }

  return [];
}

export function getPublishedPlatformTableColumns(
  entity: FormSchemaEntity,
): FormTableColumnDefinition[] {
  if (hasPublishedSnapshot(entity) || entity.publishedTableColumns.length > 0) {
    return entity.publishedTableColumns;
  }

  return entity.tableColumns ?? [];
}

export function getPublishedPlatformLayout(
  entity: FormSchemaEntity,
): FormLayoutConfig | null {
  if (hasPublishedSnapshot(entity)) {
    return entity.publishedLayout ?? null;
  }

  return entity.layout ?? null;
}

export function getPublishedPlatformSteps(
  entity: FormSchemaEntity,
): FormWizardStepDefinition[] | null {
  if (hasPublishedSnapshot(entity)) {
    return entity.publishedSteps ?? null;
  }

  return entity.steps ?? null;
}

export function computeRemovedDefinitionKeys<T extends { key: string }>(
  previous: readonly T[],
  next: readonly T[],
): string[] {
  const nextKeys = new Set(next.map((item) => item.key));
  return previous.map((item) => item.key).filter((key) => !nextKeys.has(key));
}

function normalizeFormFieldForPublishCompare(
  field: FormFieldDefinition,
): Record<string, unknown> {
  const isSection = field.type === 'section';

  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    minLength: field.minLength ?? null,
    maxLength: field.maxLength ?? null,
    validationType: field.validationType ?? null,
    sortOrder: field.sortOrder,
    showInTable: isSection ? false : (field.showInTable ?? true),
    showInForm: field.showInForm ?? true,
    filterable: field.filterable ?? false,
    formColSpan: field.formColSpan ?? null,
    sectionId: field.sectionId ?? null,
    placeholder: field.placeholder?.trim() ?? null,
    helpText: field.helpText?.trim() ?? null,
    system: Boolean(field.system),
    pipelineStage: Boolean(field.pipelineStage),
    layoutLocked: Boolean(field.layoutLocked),
    editableOnDetail: field.editableOnDetail ?? null,
    sectionTier: field.sectionTier ?? null,
    displayOptionsAsChips: field.displayOptionsAsChips ?? null,
    options:
      field.options?.map((option) => ({
        value: option.value,
        label: option.label,
        color: option.color ?? null,
      })) ?? null,
    locationComponents: field.locationComponents ?? null,
    locationInputMode: field.locationInputMode ?? null,
  };
}

function stableFieldsFingerprint(fields: FormFieldDefinition[]): string {
  const sorted = [...fields].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.key.localeCompare(right.key),
  );

  return JSON.stringify(sorted.map(normalizeFormFieldForPublishCompare));
}

function stableTableColumnsFingerprint(
  columns: FormTableColumnDefinition[],
): string {
  const sorted = [...columns].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.key.localeCompare(right.key),
  );

  return JSON.stringify(
    sorted.map((column) => ({
      id: column.id,
      key: column.key,
      label: column.label,
      type: column.type,
      required: Boolean(column.required),
      sortOrder: column.sortOrder,
      system: Boolean(column.system),
    })),
  );
}

export function platformSchemaHasUnpublishedChanges(
  entity: FormSchemaEntity,
): boolean {
  return (
    stableFieldsFingerprint(entity.fields) !==
      stableFieldsFingerprint(entity.publishedFields) ||
    stableTableColumnsFingerprint(entity.tableColumns ?? []) !==
      stableTableColumnsFingerprint(entity.publishedTableColumns ?? []) ||
    JSON.stringify(entity.layout ?? null) !==
      JSON.stringify(entity.publishedLayout ?? null) ||
    JSON.stringify(entity.steps ?? null) !==
      JSON.stringify(entity.publishedSteps ?? null)
  );
}
