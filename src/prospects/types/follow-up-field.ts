import type { ProspectFieldDefinition } from './prospect-field-schema';

export const SYSTEM_FOLLOW_UP_FIELD_KEY = 'followUpDue';

export const LEGACY_FOLLOW_UP_FIELD_KEYS = ['follow_update'] as const;

export const FOLLOW_UP_FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;

function isFollowUpIntent(field: ProspectFieldDefinition): boolean {
  if (field.type !== 'date') {
    return false;
  }

  const haystack = `${field.key} ${field.label}`.toLowerCase();

  return (
    haystack.includes('follow') &&
    (haystack.includes('date') ||
      haystack.includes('due') ||
      haystack.includes('update'))
  );
}

export function isValidFollowUpFieldKey(
  key: string,
  fields: ProspectFieldDefinition[],
): boolean {
  if (!FOLLOW_UP_FIELD_KEY_PATTERN.test(key)) {
    return false;
  }

  const field = fields.find((item) => item.key === key);
  return field?.type === 'date';
}

export function resolveFollowUpFieldKey(
  fields: ProspectFieldDefinition[],
): string | null {
  const dateFields = fields.filter((field) => field.type === 'date');

  const systemField = dateFields.find(
    (field) => field.key === SYSTEM_FOLLOW_UP_FIELD_KEY,
  );
  if (systemField) {
    return systemField.key;
  }

  for (const legacyKey of LEGACY_FOLLOW_UP_FIELD_KEYS) {
    const legacyField = dateFields.find((field) => field.key === legacyKey);
    if (legacyField) {
      return legacyField.key;
    }
  }

  const heuristicField = dateFields.find(isFollowUpIntent);
  if (heuristicField) {
    return heuristicField.key;
  }

  return null;
}
