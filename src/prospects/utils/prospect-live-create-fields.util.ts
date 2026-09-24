import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

/** Mirrors frontend `getFieldsForLiveCreateForm` (layout canvas fields only). */
export function filterProspectLiveCreateFields(
  fields: ProspectFieldDefinition[],
): ProspectFieldDefinition[] {
  return fields.filter((field) => {
    if (field.type === 'section') {
      return false;
    }

    if (!field.sectionId) {
      return false;
    }

    if (field.system) {
      return false;
    }

    return field.showInForm !== false;
  });
}
