import { BadRequestException } from '@nestjs/common';
import type { FieldStoredValue } from '../../common/location/location-field.types';
import {
  LEAD_STATUS_FIELD_KEY,
  PROTECTED_PIPELINE_STAGE_VALUE,
  type ProspectFieldDefinition,
} from '../types/prospect-field-schema';

const LEGACY_NAME_KEYS = ['fullName', 'name', 'full_name'] as const;

function extractString(value: FieldStoredValue | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return '';
  }

  return String(value).trim();
}

export function findPipelineStageField(
  fields: ProspectFieldDefinition[],
): ProspectFieldDefinition | undefined {
  return (
    fields.find((field) => field.pipelineStage === true) ??
    fields.find((field) => field.key === LEAD_STATUS_FIELD_KEY)
  );
}

export function applyDefaultProspectPipelineStage(
  fields: ProspectFieldDefinition[],
  values: Record<string, FieldStoredValue>,
): void {
  const stageField = findPipelineStageField(fields);
  if (!stageField) {
    return;
  }

  const current = extractString(values[stageField.key]);
  if (current.length > 0) {
    return;
  }

  values[stageField.key] = PROTECTED_PIPELINE_STAGE_VALUE;
}

export function resolveProspectFullName(
  fields: ProspectFieldDefinition[],
  values: Record<string, FieldStoredValue>,
): string {
  for (const key of LEGACY_NAME_KEYS) {
    const name = extractString(values[key]);
    if (name) {
      return name;
    }
  }

  const firstName =
    extractString(values.firstName) || extractString(values.first_name);
  const lastName =
    extractString(values.lastName) || extractString(values.last_name);
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (combined) {
    return combined;
  }

  if (firstName) {
    return firstName;
  }

  for (const field of fields) {
    if (field.type === 'section') {
      continue;
    }

    const value = extractString(values[field.key]);
    if (!value) {
      continue;
    }

    if (
      field.key.endsWith('_name') ||
      field.label.toLowerCase().includes('name')
    ) {
      return value;
    }
  }

  throw new BadRequestException(
    'A name is required. Add a name field to the create form layout or fill a name field.',
  );
}

export function resolveProspectEmail(
  fields: ProspectFieldDefinition[],
  values: Record<string, FieldStoredValue>,
): string {
  const legacyEmail = extractString(values.email);
  if (legacyEmail) {
    return legacyEmail.toLowerCase();
  }

  for (const field of fields) {
    if (field.type !== 'email' && field.validationType !== 'email') {
      continue;
    }

    const value = extractString(values[field.key]);
    if (value) {
      return value.toLowerCase();
    }
  }

  return '';
}
