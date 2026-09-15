import type {
  LocationComponent,
  LocationInputMode,
} from '../../common/location/location-field.types';

export type FormModule = 'crm' | 'email' | 'settings' | 'website';

export type FormType = 'single' | 'wizard' | 'inline';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'password'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'location'
  | 'company-category'
  | 'company-location'
  | 'section'
  | 'rich-text'
  | 'role-picker'
  | 'permission-matrix'
  | 'prospect-search'
  | 'list-picker'
  | 'mailbox-picker'
  | 'color';

export interface FormFieldOption {
  value: string;
  label: string;
  color?: string;
}

export type FormTableColumnType =
  'text' | 'email' | 'phone' | 'number' | 'date';

export interface FormTableColumnDefinition {
  id: string;
  key: string;
  label: string;
  type: FormTableColumnType;
  required: boolean;
  sortOrder: number;
  system?: boolean;
  source?: 'platform' | 'org';
}

export interface FormFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  sortOrder: number;
  showInTable?: boolean;
  showInForm?: boolean;
  filterable?: boolean;
  options?: FormFieldOption[];
  locationComponents?: LocationComponent[];
  locationInputMode?: LocationInputMode;
  sectionId?: string;
  system?: boolean;
  pipelineStage?: boolean;
  editableOnDetail?: boolean;
  formColSpan?: number;
  placeholder?: string;
  helpText?: string;
  source?: 'platform' | 'org';
}

export interface FormWizardStepDefinition {
  id: string;
  label: string;
  sortOrder: number;
  widget?: string;
  fieldKeys?: string[];
}

export interface FormLayoutConfig {
  columns?: number;
}

export interface FormSchemaPayload {
  fields: FormFieldDefinition[];
  tableColumns?: FormTableColumnDefinition[];
  steps?: FormWizardStepDefinition[] | null;
  layout?: FormLayoutConfig | null;
  version?: number;
}

export interface FormRegistryEntry {
  key: string;
  module: FormModule;
  label: string;
  formType: FormType;
  supportsOrgExtensions: boolean;
  supportsTableColumns?: boolean;
  customWidgets?: string[];
  defaultSchema: FormSchemaPayload;
}

export interface ResolvedFormSchemaResponse extends FormSchemaPayload {
  formKey: string;
  fieldKeysInUse?: string[];
}

export interface FormRegistryListItem {
  key: string;
  module: FormModule;
  label: string;
  formType: FormType;
  supportsOrgExtensions: boolean;
  supportsTableColumns?: boolean;
  customWidgets?: string[];
  hasPlatformSchema: boolean;
  hasOrgExtensions: boolean;
}

export interface FormRegistryListResponse {
  forms: FormRegistryListItem[];
}
