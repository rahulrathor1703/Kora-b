import {
  LEAD_STATUS_FIELD_KEY,
  LEGACY_CRM_STATUS_FIELD_KEY,
  type ProspectFieldDefinition,
} from '../types/prospect-field-schema';

export function normalizeProspectFieldSchemaFields(
  fields: ProspectFieldDefinition[],
): ProspectFieldDefinition[] {
  const hasLeadStatus = fields.some(
    (field) => field.key === LEAD_STATUS_FIELD_KEY,
  );

  const withoutLegacyCrmStatus = hasLeadStatus
    ? fields.filter((field) => field.key !== LEGACY_CRM_STATUS_FIELD_KEY)
    : fields;

  return withoutLegacyCrmStatus.map((field) => {
    if (field.key === LEAD_STATUS_FIELD_KEY) {
      return { ...field, pipelineStage: true };
    }

    if (field.pipelineStage) {
      return { ...field, pipelineStage: false };
    }

    return field;
  });
}
