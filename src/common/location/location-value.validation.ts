import { BadRequestException } from '@nestjs/common';
import {
  emptyLocationValue,
  isLocationValue,
  normalizeLocationComponents,
  type FieldStoredValue,
  type LocationComponent,
  type LocationValue,
} from './location-field.types';

export function validateLocationComponents(
  components: LocationComponent[] | undefined,
  fieldLabel: string,
): LocationComponent[] {
  const normalized = normalizeLocationComponents(components ?? []);

  if (normalized.length === 0) {
    throw new BadRequestException(
      `Location field "${fieldLabel}" must include at least one component`,
    );
  }

  return normalized;
}

export function coerceLocationFieldValue(
  components: LocationComponent[],
  rawValue: unknown,
  fieldLabel: string,
): LocationValue {
  if (rawValue === null || rawValue === undefined) {
    return emptyLocationValue();
  }

  if (!isLocationValue(rawValue)) {
    throw new BadRequestException(`${fieldLabel} must be a location object`);
  }

  const next = emptyLocationValue();

  for (const component of components) {
    const value = rawValue[component];
    if (value === undefined || value === null) {
      next[component] = null;
      continue;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(
        `${fieldLabel}.${component} must be a string`,
      );
    }

    const trimmed = value.trim();
    next[component] = trimmed.length > 0 ? trimmed : null;
  }

  for (const key of Object.keys(rawValue) as LocationComponent[]) {
    if (!components.includes(key) && rawValue[key]) {
      throw new BadRequestException(
        `Unexpected location component "${key}" for ${fieldLabel}`,
      );
    }
  }

  const hasAnyValue = components.some((component) => next[component]);
  if (!hasAnyValue) {
    return emptyLocationValue();
  }

  return next;
}

export function isEmptyLocationValue(value: LocationValue): boolean {
  return !(value.city || value.state || value.country || value.region);
}

export function requireScalarFieldValue(
  rawValue: FieldStoredValue,
  fieldLabel: string,
): string | number {
  if (
    rawValue === null ||
    Array.isArray(rawValue) ||
    typeof rawValue === 'object'
  ) {
    throw new BadRequestException(`${fieldLabel} must be a scalar value`);
  }

  return rawValue;
}
