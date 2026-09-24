import type { CompanyFieldDefinition } from '../types/company-field-schema';
import { filterCompanyLiveCreateFields } from './company-live-create-fields.util';

export type CompanyValidationFieldMode = 'liveCreate' | 'full';

export function filterCompanyFullValidationFields(
  fields: CompanyFieldDefinition[],
): CompanyFieldDefinition[] {
  return fields.filter((field) => field.type !== 'section');
}

/** Fields used for unknown-key checks (all non-section schema keys). */
export function getCompanyKnownValidationFields(
  fields: CompanyFieldDefinition[],
): CompanyFieldDefinition[] {
  return filterCompanyFullValidationFields(fields);
}

export function getCompanyValidationFields(
  fields: CompanyFieldDefinition[],
  options: { mode: CompanyValidationFieldMode },
): CompanyFieldDefinition[] {
  return options.mode === 'liveCreate'
    ? filterCompanyLiveCreateFields(fields)
    : filterCompanyFullValidationFields(fields);
}
