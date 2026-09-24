import { BadRequestException } from '@nestjs/common';
import {
  assertFieldStringValidation,
  normalizeFieldLengthValidation,
} from './field-validation.utils';

describe('field-validation.utils', () => {
  describe('normalizeFieldLengthValidation', () => {
    it('rejects min length greater than max length', () => {
      expect(() =>
        normalizeFieldLengthValidation({ minLength: 10, maxLength: 2 }, 'Name'),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertFieldStringValidation', () => {
    it('enforces min and max length', () => {
      expect(() =>
        assertFieldStringValidation('Code', { minLength: 3 }, 'ab'),
      ).toThrow('at least 3 characters');

      expect(() =>
        assertFieldStringValidation('Code', { maxLength: 2 }, 'abc'),
      ).toThrow('at most 2 characters');
    });

    it('enforces alphanumeric validation type', () => {
      expect(() =>
        assertFieldStringValidation(
          'Code',
          { validationType: 'alphanumeric' },
          'abc-1',
        ),
      ).toThrow('required format');
    });
  });
});
