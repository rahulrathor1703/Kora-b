export type FieldValidationType =
  | 'number'
  | 'alphanumeric'
  | 'uppercase-alphanumeric'
  | 'alphabet'
  | 'email'
  | 'url';

export interface FieldLengthValidation {
  minLength?: number;
  maxLength?: number;
}

export interface FieldStringValidationRules extends FieldLengthValidation {
  validationType?: FieldValidationType;
}
