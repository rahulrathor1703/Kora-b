import { isLocationValue, type FieldStoredValue } from './location-field.types';
import { isEmptyLocationValue } from './location-value.validation';

export function hasFieldStoredData(
  value: FieldStoredValue | undefined,
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (isLocationValue(value)) {
    return !isEmptyLocationValue(value);
  }

  return false;
}
