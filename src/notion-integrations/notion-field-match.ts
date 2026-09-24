import { randomUUID } from 'crypto';
import type { CompanyFieldDefinition } from '../companies/types/company-field-schema';
import type { ProspectFieldDefinition } from '../prospects/types/prospect-field-schema';
import type {
  DescribedNotionProperty,
  NotionSuggestedFieldType,
} from './notion-property.mapper';

export type NotionImportDestination = 'company' | 'prospect' | 'contact-list';

export type ImportableFieldDefinition =
  CompanyFieldDefinition | ProspectFieldDefinition;

export interface NotionFieldToCreate {
  id: string;
  key: string;
  label: string;
  type: NotionSuggestedFieldType | 'text';
  sortOrder: number;
  showInTable: boolean;
  showInForm: boolean;
  filterable: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface NotionFieldPlan {
  fieldMapping: Record<string, string>;
  fieldsToCreate: NotionFieldToCreate[];
  missingRequiredLabels: string[];
  columnStatuses: Array<{
    propertyId: string;
    propertyName: string;
    included: boolean;
    status: 'mapped' | 'create' | 'skipped' | 'unsupported';
    targetLabel?: string;
    targetKey?: string;
  }>;
}

interface BuildNotionFieldPlanInput {
  destination: NotionImportDestination;
  fields: ImportableFieldDefinition[];
  properties: DescribedNotionProperty[];
  excludedPropertyIds: string[];
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function slugifyKey(label: string): string {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_') || 'custom_field';

  return /^[a-z]/.test(slug) ? slug : `field_${slug}`;
}

function isTypeCompatible(
  suggestedType: NotionSuggestedFieldType | null,
  fieldType: string,
): boolean {
  if (!suggestedType) {
    return false;
  }

  if (suggestedType === fieldType) {
    return true;
  }

  if (suggestedType === 'text' && fieldType === 'textarea') {
    return true;
  }

  if (suggestedType === 'select' && fieldType === 'company-category') {
    return true;
  }

  return false;
}

function requiredFieldKeys(
  destination: NotionImportDestination,
): Array<{ key: string; label: string }> {
  if (destination === 'company') {
    return [{ key: 'brokerName', label: 'Company Name' }];
  }

  if (destination === 'prospect') {
    return [
      { key: 'fullName', label: 'Name' },
      { key: 'email', label: 'Email' },
    ];
  }

  return [{ key: 'email', label: 'Email' }];
}

function uniqueFieldKey(baseKey: string, usedKeys: Set<string>): string {
  if (!usedKeys.has(baseKey)) {
    return baseKey;
  }

  let index = 2;
  while (usedKeys.has(`${baseKey}_${index}`)) {
    index += 1;
  }

  return `${baseKey}_${index}`;
}

export function buildNotionFieldPlan(
  input: BuildNotionFieldPlanInput,
): NotionFieldPlan {
  const excluded = new Set(input.excludedPropertyIds);
  const usedKeys = new Set(input.fields.map((field) => field.key));
  const maxSortOrder = input.fields.reduce(
    (max, field) => Math.max(max, field.sortOrder),
    -1,
  );

  const fieldMapping: Record<string, string> = {};
  const fieldsToCreate: NotionFieldToCreate[] = [];
  const columnStatuses: NotionFieldPlan['columnStatuses'] = [];

  for (const property of input.properties) {
    const included = !excluded.has(property.id) && property.supported;

    if (excluded.has(property.id)) {
      columnStatuses.push({
        propertyId: property.id,
        propertyName: property.name,
        included: false,
        status: 'skipped',
      });
      continue;
    }

    if (!property.supported) {
      columnStatuses.push({
        propertyId: property.id,
        propertyName: property.name,
        included: false,
        status: 'unsupported',
      });
      continue;
    }

    const match = input.fields.find(
      (field) =>
        field.type !== 'section' &&
        normalizeLabel(field.label) === normalizeLabel(property.name) &&
        isTypeCompatible(property.suggestedFieldType, field.type),
    );

    if (match) {
      fieldMapping[match.key] = property.name;
      columnStatuses.push({
        propertyId: property.id,
        propertyName: property.name,
        included: true,
        status: 'mapped',
        targetLabel: match.label,
        targetKey: match.key,
      });
      continue;
    }

    if (input.destination === 'contact-list') {
      columnStatuses.push({
        propertyId: property.id,
        propertyName: property.name,
        included: false,
        status: 'skipped',
      });
      continue;
    }

    const suggestedType = property.suggestedFieldType ?? 'text';
    const hasOptions = (property.options?.length ?? 0) > 0;
    const createdType =
      input.destination === 'company' && suggestedType === 'multiselect'
        ? 'text'
        : (suggestedType === 'select' || suggestedType === 'multiselect') &&
            !hasOptions
          ? 'text'
          : suggestedType;
    const key = uniqueFieldKey(slugifyKey(property.name), usedKeys);
    usedKeys.add(key);

    const createdField: NotionFieldToCreate = {
      id: randomUUID(),
      key,
      label: property.name,
      type: createdType,
      sortOrder: maxSortOrder + fieldsToCreate.length + 1,
      showInTable: true,
      showInForm: true,
      filterable: createdType === 'select' || createdType === 'multiselect',
      options:
        createdType === 'select' || createdType === 'multiselect'
          ? property.options
          : undefined,
    };

    fieldsToCreate.push(createdField);
    fieldMapping[key] = property.name;
    columnStatuses.push({
      propertyId: property.id,
      propertyName: property.name,
      included,
      status: 'create',
      targetLabel: property.name,
      targetKey: key,
    });
  }

  const missingRequiredLabels = requiredFieldKeys(input.destination)
    .filter((field) => !fieldMapping[field.key])
    .map((field) => field.label);

  return {
    fieldMapping,
    fieldsToCreate,
    missingRequiredLabels,
    columnStatuses,
  };
}
