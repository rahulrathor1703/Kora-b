import type { FieldStoredValue } from '../../common/location/location-field.types';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

export const PROSPECT_LEAD_TYPE_FIELD_KEYS = ['leadType', 'lead_type'] as const;

export const PROSPECT_COMPANY_DETAILS_SECTION_FIELD_KEY =
  'section_company_details';

export const PROSPECT_LEAD_TYPE_VALUE_COMPANY = 'company';

type ProspectLayoutField = Pick<
  ProspectFieldDefinition,
  'id' | 'key' | 'type' | 'sectionId'
>;

export function readProspectLeadTypeValue(
  values: Record<string, FieldStoredValue | undefined>,
): string {
  for (const key of PROSPECT_LEAD_TYPE_FIELD_KEYS) {
    const raw = values[key];
    if (raw === null || raw === undefined) {
      continue;
    }

    if (typeof raw === 'object') {
      continue;
    }

    const normalized = String(raw).trim().toLowerCase();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export function isProspectCompanyLeadTypeSelected(
  values: Record<string, FieldStoredValue | undefined>,
): boolean {
  return readProspectLeadTypeValue(values) === PROSPECT_LEAD_TYPE_VALUE_COMPANY;
}

export function resolveProspectCompanyDetailsSectionId(
  fields: ProspectLayoutField[],
): string | null {
  const section = fields.find(
    (field) =>
      field.type === 'section' &&
      field.key === PROSPECT_COMPANY_DETAILS_SECTION_FIELD_KEY,
  );

  return section?.id ?? null;
}

export function isProspectCompanyDetailsField(
  field: ProspectLayoutField,
  layoutFields: ProspectLayoutField[],
): boolean {
  const sectionId = resolveProspectCompanyDetailsSectionId(layoutFields);
  if (!sectionId) {
    return false;
  }

  if (field.type === 'section' && field.id === sectionId) {
    return true;
  }

  return field.sectionId === sectionId;
}

export function filterProspectFieldsForLeadType<T extends ProspectLayoutField>(
  fields: T[],
  values: Record<string, FieldStoredValue | undefined>,
  layoutFields?: ProspectLayoutField[],
): T[] {
  if (isProspectCompanyLeadTypeSelected(values)) {
    return fields;
  }

  const sectionContext = layoutFields ?? fields;
  return fields.filter(
    (field) => !isProspectCompanyDetailsField(field, sectionContext),
  );
}
