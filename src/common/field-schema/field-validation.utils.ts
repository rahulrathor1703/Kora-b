import { BadRequestException } from '@nestjs/common';
import type {
  FieldLengthValidation,
  FieldStringValidationRules,
  FieldValidationType,
} from './field-validation.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^(https?:\/\/)[^\s/$.?#][^\s]*$/i;

const VALIDATION_TYPE_PATTERNS: Record<
  Exclude<FieldValidationType, 'email' | 'url'>,
  RegExp
> = {
  number: /^\d+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  'uppercase-alphanumeric': /^[A-Z0-9]+$/,
  alphabet: /^[a-zA-Z]+$/,
};

export function normalizeFieldLengthValidation(
  field: FieldLengthValidation,
  label: string,
): FieldLengthValidation {
  const minLength =
    field.minLength !== undefined && field.minLength >= 0
      ? field.minLength
      : undefined;
  const maxLength =
    field.maxLength !== undefined && field.maxLength >= 0
      ? field.maxLength
      : undefined;

  if (
    minLength !== undefined &&
    maxLength !== undefined &&
    minLength > maxLength
  ) {
    throw new BadRequestException(
      `Field "${label}" min length cannot exceed max length`,
    );
  }

  return { minLength, maxLength };
}

export function normalizeFieldStringValidationRules(
  field: FieldStringValidationRules,
  label: string,
): FieldStringValidationRules {
  const { minLength, maxLength } = normalizeFieldLengthValidation(field, label);

  return {
    minLength,
    maxLength,
    validationType: field.validationType || undefined,
  };
}

export function assertFieldStringValidation(
  label: string,
  rules: FieldStringValidationRules,
  rawValue: string,
): void {
  const value = rawValue.trim();
  const { minLength, maxLength, validationType } = rules;

  if (minLength !== undefined && value.length < minLength) {
    throw new BadRequestException(
      `${label} must be at least ${minLength} characters`,
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new BadRequestException(
      `${label} must be at most ${maxLength} characters`,
    );
  }

  if (!validationType) {
    return;
  }

  switch (validationType) {
    case 'email': {
      if (!EMAIL_PATTERN.test(value)) {
        throw new BadRequestException(`${label} must be a valid email`);
      }
      return;
    }
    case 'url': {
      if (!URL_PATTERN.test(value)) {
        throw new BadRequestException(`${label} must be a valid URL`);
      }
      return;
    }
    default: {
      const pattern = VALIDATION_TYPE_PATTERNS[validationType];
      if (!pattern.test(value)) {
        throw new BadRequestException(
          `${label} does not match the required format`,
        );
      }
    }
  }
}
