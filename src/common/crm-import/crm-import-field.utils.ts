import { BadRequestException } from '@nestjs/common';
import type {
  FieldStoredValue,
  LocationComponent,
  LocationValue,
} from '../location/location-field.types';
import {
  LOCATION_COMPONENTS,
  normalizeLocationComponents,
} from '../location/location-field.types';
import type { CrmImportFieldDescriptor } from './crm-import.types';

export interface CrmImportOptionRef {
  value: string;
  label: string;
}

export interface CrmImportConfigOptionRef {
  id: string;
  label: string;
}

function normalizeMatchValue(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSelectValue(
  raw: string,
  options: CrmImportOptionRef[] | undefined,
  fieldLabel: string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = normalizeMatchValue(trimmed);
  const match = options?.find(
    (option) =>
      normalizeMatchValue(option.value) === normalized ||
      normalizeMatchValue(option.label) === normalized,
  );

  if (!match) {
    throw new BadRequestException(`Invalid value for ${fieldLabel}`);
  }

  return match.value;
}

function resolveConfigOptionId(
  raw: string,
  options: CrmImportConfigOptionRef[],
  fieldLabel: string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = normalizeMatchValue(trimmed);
  const match = options.find(
    (option) =>
      option.id.toLowerCase() === normalized ||
      normalizeMatchValue(option.label) === normalized,
  );

  if (!match) {
    throw new BadRequestException(`Invalid value for ${fieldLabel}`);
  }

  return match.id;
}

function resolveMultiselectValues(
  raw: string,
  options: CrmImportOptionRef[] | undefined,
  fieldLabel: string,
): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(',')
    .map((part) => resolveSelectValue(part, options, fieldLabel))
    .filter((value) => value.length > 0);
}

export function buildImportableFieldDescriptors(
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    locationComponents?: LocationComponent[];
  }>,
): CrmImportFieldDescriptor[] {
  const descriptors: CrmImportFieldDescriptor[] = [];

  for (const field of fields) {
    if (field.type === 'section') {
      continue;
    }

    if (field.type === 'location') {
      const components = normalizeLocationComponents(
        field.locationComponents ?? [],
      );

      for (const component of components) {
        descriptors.push({
          key: `${field.key}.${component}`,
          label: `${field.label} (${component})`,
          type: 'location-component',
          required: Boolean(field.required),
          locationComponents: [component],
        });
      }

      continue;
    }

    descriptors.push({
      key: field.key,
      label: field.label,
      type: field.type,
      required: Boolean(field.required),
    });
  }

  return descriptors;
}

export function assertUniqueFieldMappingColumns(
  fieldMapping: Record<string, string>,
): void {
  const usedColumns = new Map<string, string>();

  for (const [fieldKey, column] of Object.entries(fieldMapping)) {
    const trimmedColumn = column.trim();
    if (!trimmedColumn) {
      continue;
    }

    const existingField = usedColumns.get(trimmedColumn);
    if (existingField) {
      throw new BadRequestException(
        `Column "${trimmedColumn}" is mapped to multiple fields (${existingField}, ${fieldKey})`,
      );
    }

    usedColumns.set(trimmedColumn, fieldKey);
  }
}

export function assertRequiredFieldsMapped(
  fields: CrmImportFieldDescriptor[],
  fieldMapping: Record<string, string>,
): void {
  for (const field of fields) {
    if (!field.required) {
      continue;
    }

    if (field.type === 'location-component') {
      const parentKey = field.key.split('.')[0] ?? field.key;
      const hasAnyComponent = fields.some(
        (item) =>
          item.key.startsWith(`${parentKey}.`) &&
          fieldMapping[item.key]?.trim(),
      );

      if (!hasAnyComponent) {
        throw new BadRequestException(`${field.label} is required`);
      }

      continue;
    }

    if (!fieldMapping[field.key]?.trim()) {
      throw new BadRequestException(`${field.label} must be mapped`);
    }
  }
}

export function mapCsvRowToRawValues(
  row: Record<string, string>,
  fieldMapping: Record<string, string>,
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    options?: CrmImportOptionRef[];
    locationComponents?: LocationComponent[];
  }>,
  configOptions?: {
    categories: CrmImportConfigOptionRef[];
    locations: CrmImportConfigOptionRef[];
  },
): Record<string, FieldStoredValue> {
  const values: Record<string, FieldStoredValue> = {};
  const locationDrafts = new Map<string, LocationValue>();

  for (const field of fields) {
    if (field.type === 'section') {
      continue;
    }

    if (field.type === 'location') {
      const components = normalizeLocationComponents(
        field.locationComponents ?? [],
      );
      const locationValue: LocationValue = {};

      for (const component of components) {
        const mappingKey = `${field.key}.${component}`;
        const column = fieldMapping[mappingKey]?.trim();
        if (!column) {
          continue;
        }

        const raw = (row[column] ?? '').trim();
        if (raw) {
          locationValue[component] = raw;
        }
      }

      locationDrafts.set(field.key, locationValue);
      continue;
    }

    const column = fieldMapping[field.key]?.trim();
    if (!column) {
      continue;
    }

    const raw = (row[column] ?? '').trim();
    if (!raw) {
      continue;
    }

    values[field.key] = coerceScalarImportValue(field, raw, configOptions);
  }

  for (const [fieldKey, locationValue] of locationDrafts.entries()) {
    values[fieldKey] = locationValue;
  }

  return values;
}

function coerceScalarImportValue(
  field: {
    key: string;
    label: string;
    type: string;
    options?: CrmImportOptionRef[];
  },
  raw: string,
  configOptions?: {
    categories: CrmImportConfigOptionRef[];
    locations: CrmImportConfigOptionRef[];
  },
): FieldStoredValue {
  switch (field.type) {
    case 'select':
      return resolveSelectValue(raw, field.options, field.label);
    case 'multiselect':
      return resolveMultiselectValues(raw, field.options, field.label);
    case 'company-category':
      return resolveConfigOptionId(
        raw,
        configOptions?.categories ?? [],
        field.label,
      );
    case 'company-location':
      return resolveConfigOptionId(
        raw,
        configOptions?.locations ?? [],
        field.label,
      );
    case 'number': {
      const numericValue = Number(raw);
      if (Number.isNaN(numericValue)) {
        throw new BadRequestException(`${field.label} must be a number`);
      }
      return numericValue;
    }
    default:
      return raw;
  }
}

export function getImportDedupKeyFromValues(
  entityType: 'prospect' | 'company',
  values: Record<string, FieldStoredValue>,
  brokerName?: string,
): string | null {
  if (entityType === 'prospect') {
    const email = values.email;
    if (typeof email !== 'string' || !email.trim()) {
      return null;
    }

    return email.trim().toLowerCase();
  }

  const brokerValue = values.brokerName;
  const name =
    brokerName?.trim() ||
    (typeof brokerValue === 'string' ? brokerValue.trim() : '');
  return name ? name.toLowerCase() : null;
}

export function isLocationComponentMappingKey(key: string): boolean {
  const suffix = key.split('.').at(-1);
  return (
    key.includes('.') &&
    LOCATION_COMPONENTS.includes(suffix as (typeof LOCATION_COMPONENTS)[number])
  );
}
