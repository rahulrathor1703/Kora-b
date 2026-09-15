import { BadRequestException } from '@nestjs/common';
import { isSectionFieldType } from './section-field.utils';

export const FORM_GRID_COLUMNS = 12;

const FULL_WIDTH_FIELD_TYPES = new Set([
  'textarea',
  'location',
  'company-category',
  'company-location',
]);

export function defaultFormColSpan(type: string): number {
  if (isSectionFieldType(type) || FULL_WIDTH_FIELD_TYPES.has(type)) {
    return FORM_GRID_COLUMNS;
  }

  return 6;
}

export function normalizeFormColSpan(
  type: string,
  formColSpan: number | undefined,
  fieldLabel: string,
): number | undefined {
  if (isSectionFieldType(type)) {
    return undefined;
  }

  const span = formColSpan ?? defaultFormColSpan(type);

  if (!Number.isInteger(span) || span < 1 || span > FORM_GRID_COLUMNS) {
    throw new BadRequestException(
      `Field "${fieldLabel}" formColSpan must be an integer between 1 and ${FORM_GRID_COLUMNS}`,
    );
  }

  return span;
}
