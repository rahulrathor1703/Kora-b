import type { CompanyFieldDefinition } from '../types/company-field-schema';

/** Mirrors frontend `getFieldsForLiveCreateForm` (layout canvas fields only). */
export function filterCompanyLiveCreateFields(
  fields: CompanyFieldDefinition[],
): CompanyFieldDefinition[] {
  return fields.filter((field) => {
    if (field.type === 'section') {
      return false;
    }

    if (!field.sectionId) {
      return false;
    }

    return field.showInForm !== false;
  });
}
