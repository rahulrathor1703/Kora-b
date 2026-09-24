import type { FieldStoredValue } from '../../common/location/location-field.types';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';
import { isProspectBantComputedField } from './prospect-bant-computed-fields.util';
import { filterProspectLiveCreateFields } from './prospect-live-create-fields.util';
import { filterProspectFieldsForLeadType } from './prospect-lead-type-fields.util';

export type ProspectValidationFieldMode = 'liveCreate' | 'full';

export function filterProspectFullValidationFields(
  fields: ProspectFieldDefinition[],
): ProspectFieldDefinition[] {
  return fields.filter((field) => field.type !== 'section');
}

/** Fields used for unknown-key checks (all non-section schema keys). */
export function getProspectKnownValidationFields(
  fields: ProspectFieldDefinition[],
): ProspectFieldDefinition[] {
  return filterProspectFullValidationFields(fields);
}

export function getProspectValidationFields(
  fields: ProspectFieldDefinition[],
  values: Record<string, FieldStoredValue | undefined>,
  options: {
    mode: ProspectValidationFieldMode;
    layoutFields?: ProspectFieldDefinition[];
  },
): ProspectFieldDefinition[] {
  const layoutFields = options.layoutFields ?? fields;
  const modeFields =
    options.mode === 'liveCreate'
      ? filterProspectLiveCreateFields(fields)
      : filterProspectFullValidationFields(fields);

  const leadTypeFiltered = filterProspectFieldsForLeadType(
    modeFields,
    values,
    layoutFields,
  );

  return leadTypeFiltered.filter(
    (field) => !isProspectBantComputedField(field),
  );
}
