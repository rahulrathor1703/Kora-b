import type {
  LocationComponent,
  LocationInputMode,
} from '../../common/location/location-field.types';

export type CompanyFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'company-category'
  | 'company-location'
  | 'location'
  | 'section';

export interface CompanyFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface CompanyFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CompanyFieldType;
  required?: boolean;
  sortOrder: number;
  showInTable: boolean;
  showInForm: boolean;
  filterable?: boolean;
  options?: CompanyFieldOption[];
  locationComponents?: LocationComponent[];
  locationInputMode?: LocationInputMode;
  sectionId?: string;
  system?: boolean;
  editableOnDetail?: boolean;
  formColSpan?: number;
}

export const BROKER_NAME_FIELD_KEY = 'brokerName';
export const CATEGORY_FIELD_KEY = 'categoryId';

export interface CompanyFieldSchema {
  fields: CompanyFieldDefinition[];
}

function field(partial: CompanyFieldDefinition): CompanyFieldDefinition {
  return partial;
}

export const DEFAULT_COMPANY_FIELD_SCHEMA: CompanyFieldSchema = {
  fields: [
    field({
      id: '00000000-0000-4000-9000-000000000001',
      key: BROKER_NAME_FIELD_KEY,
      label: 'Broker Name',
      type: 'text',
      required: true,
      sortOrder: 0,
      showInTable: true,
      showInForm: true,
      system: true,
      editableOnDetail: true,
    }),
    field({
      id: '00000000-0000-4000-9000-000000000002',
      key: CATEGORY_FIELD_KEY,
      label: 'Category',
      type: 'company-category',
      sortOrder: 1,
      showInTable: true,
      showInForm: true,
      filterable: true,
      system: true,
      editableOnDetail: true,
    }),
    field({
      id: '00000000-0000-4000-9000-000000000004',
      key: 'principalOfficerName',
      label: 'Principal Officer Name',
      type: 'text',
      sortOrder: 2,
      showInTable: true,
      showInForm: true,
      editableOnDetail: true,
    }),
    field({
      id: '00000000-0000-4000-9000-000000000005',
      key: 'poEmail',
      label: 'PO Email',
      type: 'email',
      sortOrder: 3,
      showInTable: true,
      showInForm: true,
      editableOnDetail: true,
    }),
    field({
      id: '00000000-0000-4000-9000-000000000006',
      key: 'remarks',
      label: 'Remarks',
      type: 'textarea',
      sortOrder: 4,
      showInTable: true,
      showInForm: true,
      editableOnDetail: true,
    }),
  ],
};
