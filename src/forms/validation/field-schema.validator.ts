import { BadRequestException } from '@nestjs/common';
import { FIELD_KEY_PATTERN } from '../../common/field-schema/field-key.pattern';
import { normalizeFieldStringValidationRules } from '../../common/field-schema/field-validation.utils';
import { normalizeFormColSpan } from '../../common/field-schema/form-layout.utils';
import { slugifySectionKey } from '../../common/field-schema/section-field.utils';
import { normalizeLocationInputMode } from '../../common/location/location-field.types';
import { validateLocationComponents } from '../../common/location/location-value.validation';
import type { FormFieldDefinition } from '../types/form-schema.types';

export { FIELD_KEY_PATTERN };

export function validateFormFieldSchema(
  fields: FormFieldDefinition[],
): FormFieldDefinition[] {
  const keys = new Set<string>();
  const ids = new Set<string>();

  const normalized = fields.map((field, index) => {
    const label = field.label.trim();

    if (!label) {
      throw new BadRequestException('Every field must have a label');
    }

    if (field.type === 'section') {
      const key = slugifySectionKey(field.key.trim() || label);

      if (!FIELD_KEY_PATTERN.test(key)) {
        throw new BadRequestException(
          `Section key "${key}" must start with a lowercase letter and contain only letters, numbers, and underscores`,
        );
      }

      if (keys.has(key)) {
        throw new BadRequestException(`Duplicate field key "${key}"`);
      }

      if (ids.has(field.id)) {
        throw new BadRequestException(`Duplicate field id "${field.id}"`);
      }

      keys.add(key);
      ids.add(field.id);

      const sectionTier: 'main' | 'sub' =
        field.sectionTier === 'sub' ? 'sub' : 'main';

      return {
        ...field,
        key,
        label,
        sortOrder: index,
        showInTable: false,
        showInForm: field.showInForm ?? true,
        filterable: false,
        required: false,
        sectionId: undefined,
        pipelineStage: false,
        sectionTier,
      };
    }

    const key = field.key.trim();

    if (!FIELD_KEY_PATTERN.test(key)) {
      throw new BadRequestException(
        `Field key "${field.key}" must start with a lowercase letter and contain only letters, numbers, and underscores`,
      );
    }

    if (keys.has(key)) {
      throw new BadRequestException(`Duplicate field key "${key}"`);
    }

    if (ids.has(field.id)) {
      throw new BadRequestException(`Duplicate field id "${field.id}"`);
    }

    keys.add(key);
    ids.add(field.id);

    if (
      (field.type === 'select' || field.type === 'multiselect') &&
      (!field.options || field.options.length === 0)
    ) {
      throw new BadRequestException(
        `Select field "${key}" must include at least one option`,
      );
    }

    const { minLength, maxLength, validationType } =
      normalizeFieldStringValidationRules(field, label);

    const locationComponents =
      field.type === 'location'
        ? validateLocationComponents(field.locationComponents, label)
        : undefined;
    const locationInputMode =
      field.type === 'location'
        ? normalizeLocationInputMode(field.locationInputMode)
        : undefined;

    const isOptionsField =
      field.type === 'select' || field.type === 'multiselect';
    const displayOptionsAsChips =
      isOptionsField && field.displayOptionsAsChips === true
        ? true
        : isOptionsField && field.displayOptionsAsChips === false
          ? false
          : undefined;

    return {
      ...field,
      key,
      label,
      sortOrder: index,
      showInTable: field.showInTable ?? true,
      filterable: field.type === 'location' ? false : field.filterable,
      options: field.options?.map((option) => ({
        value: option.value.trim(),
        label: option.label.trim(),
        color: option.color?.trim() || undefined,
      })),
      displayOptionsAsChips,
      locationComponents,
      locationInputMode,
      formColSpan: normalizeFormColSpan(field.type, field.formColSpan, label),
      minLength,
      maxLength,
      validationType,
    };
  });

  const sectionIds = new Set(
    normalized
      .filter((field) => field.type === 'section')
      .map((field) => field.id),
  );

  for (const field of normalized) {
    if (field.type === 'section') {
      continue;
    }

    if (field.sectionId && !sectionIds.has(field.sectionId)) {
      throw new BadRequestException(
        `Field "${field.label}" references an unknown section`,
      );
    }
  }

  return normalized;
}
