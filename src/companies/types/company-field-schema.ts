import type { FieldStringValidationRules } from '../../common/field-schema/field-validation.types';
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

export interface CompanyFieldDefinition extends FieldStringValidationRules {
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

export interface CompanyFieldSchema {
  fields: CompanyFieldDefinition[];
}

const SECTION_IDENTITY = '00000000-0000-4000-9001-000000000001';
const SECTION_LOCATION = '00000000-0000-4000-9001-000000000002';
const SECTION_BUSINESS_PROFILE = '00000000-0000-4000-9001-000000000003';
const SECTION_INSURANCE_PROFILE = '00000000-0000-4000-9001-000000000004';
const SECTION_TECHNOLOGY = '00000000-0000-4000-9001-000000000005';
const SECTION_RELATIONSHIP = '00000000-0000-4000-9001-000000000006';
const SECTION_CLASSIFICATION = '00000000-0000-4000-9001-000000000007';
const SECTION_SYSTEM = '00000000-0000-4000-9001-000000000008';

/** Placeholder until options are configured in Platform → Forms. */
const PLACEHOLDER_SELECT_OPTIONS: CompanyFieldOption[] = [
  { value: 'pending', label: 'Pending configuration' },
];

function field(
  partial: Omit<CompanyFieldDefinition, 'sortOrder'>,
): Omit<CompanyFieldDefinition, 'sortOrder'> {
  return partial;
}

const DEFAULT_COMPANY_FIELDS_UNSORTED: Omit<
  CompanyFieldDefinition,
  'sortOrder'
>[] = [
  field({
    id: SECTION_IDENTITY,
    key: 'section_identity',
    label: 'Identity',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9002-000000000001',
    key: BROKER_NAME_FIELD_KEY,
    label: 'Company Name',
    type: 'text',
    required: true,
    showInTable: true,
    showInForm: true,
    editableOnDetail: false,
    system: true,
    sectionId: SECTION_IDENTITY,
  }),
  field({
    id: '00000000-0000-4000-9002-000000000002',
    key: 'legalCompanyName',
    label: 'Legal Company Name',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_IDENTITY,
  }),
  field({
    id: '00000000-0000-4000-9002-000000000003',
    key: 'companyType',
    label: 'Company Type',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_IDENTITY,
  }),
  field({
    id: '00000000-0000-4000-9002-000000000004',
    key: 'industry',
    label: 'Industry',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_IDENTITY,
  }),
  field({
    id: '00000000-0000-4000-9002-000000000005',
    key: 'companyWebsite',
    label: 'Company Website',
    type: 'text',
    validationType: 'url',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_IDENTITY,
  }),
  field({
    id: '00000000-0000-4000-9002-000000000006',
    key: 'companyRegistrationNo',
    label: 'Company Registration No.',
    type: 'text',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_IDENTITY,
  }),
  field({
    id: SECTION_LOCATION,
    key: 'section_location',
    label: 'Location',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9003-000000000001',
    key: 'country',
    label: 'Country',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_LOCATION,
  }),
  field({
    id: '00000000-0000-4000-9003-000000000002',
    key: 'state',
    label: 'State',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_LOCATION,
  }),
  field({
    id: '00000000-0000-4000-9003-000000000003',
    key: 'city',
    label: 'City',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_LOCATION,
  }),
  field({
    id: '00000000-0000-4000-9003-000000000004',
    key: 'address',
    label: 'Address',
    type: 'textarea',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_LOCATION,
  }),
  field({
    id: '00000000-0000-4000-9003-000000000005',
    key: 'pincode',
    label: 'Pincode',
    type: 'text',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_LOCATION,
  }),
  field({
    id: SECTION_BUSINESS_PROFILE,
    key: 'section_business_profile',
    label: 'Business Profile',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000001',
    key: 'companySize',
    label: 'Company Size',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000002',
    key: 'annualTurnover',
    label: 'Annual Turnover',
    type: 'number',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000003',
    key: 'yearEstablished',
    label: 'Year Established',
    type: 'number',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000004',
    key: 'businessModel',
    label: 'Business Model',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000005',
    key: 'productsServices',
    label: 'Products / Services',
    type: 'textarea',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000006',
    key: 'numberOfBranches',
    label: 'Number of Branches',
    type: 'number',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9004-000000000007',
    key: 'geographicPresence',
    label: 'Geographic Presence',
    type: 'textarea',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_BUSINESS_PROFILE,
  }),
  field({
    id: SECTION_INSURANCE_PROFILE,
    key: 'section_insurance_profile',
    label: 'Insurance Profile',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9005-000000000001',
    key: 'insuranceBusinessType',
    label: 'Insurance Business Type',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_INSURANCE_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9005-000000000002',
    key: 'insuranceLicenseType',
    label: 'Insurance License Type',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_INSURANCE_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9005-000000000003',
    key: 'irdaiRegistrationNo',
    label: 'IRDAI Registration No.',
    type: 'text',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_INSURANCE_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9005-000000000004',
    key: 'insurerPartnerships',
    label: 'Insurer Partnerships',
    type: 'textarea',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_INSURANCE_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9005-000000000005',
    key: 'numberOfInsurerIntegrations',
    label: 'Number of Insurer Integrations',
    type: 'number',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_INSURANCE_PROFILE,
  }),
  field({
    id: '00000000-0000-4000-9005-000000000006',
    key: 'approxPolicyVolume',
    label: 'Approx. Policy Volume',
    type: 'number',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_INSURANCE_PROFILE,
  }),
  field({
    id: SECTION_TECHNOLOGY,
    key: 'section_technology',
    label: 'Technology',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9006-000000000001',
    key: 'currentPlatform',
    label: 'Current Platform',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_TECHNOLOGY,
  }),
  field({
    id: '00000000-0000-4000-9006-000000000002',
    key: 'crm',
    label: 'CRM',
    type: 'text',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_TECHNOLOGY,
  }),
  field({
    id: '00000000-0000-4000-9006-000000000003',
    key: 'erpBackend',
    label: 'ERP / Backend',
    type: 'text',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_TECHNOLOGY,
  }),
  field({
    id: '00000000-0000-4000-9006-000000000004',
    key: 'apiCapability',
    label: 'API Capability',
    type: 'text',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_TECHNOLOGY,
  }),
  field({
    id: '00000000-0000-4000-9006-000000000005',
    key: 'existingIntegrations',
    label: 'Existing Integrations',
    type: 'textarea',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_TECHNOLOGY,
  }),
  field({
    id: SECTION_RELATIONSHIP,
    key: 'section_relationship',
    label: 'Relationship',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9007-000000000001',
    key: 'accountOwner',
    label: 'Account Owner',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_RELATIONSHIP,
  }),
  field({
    id: '00000000-0000-4000-9007-000000000002',
    key: 'customerStatus',
    label: 'Customer Status',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_RELATIONSHIP,
  }),
  field({
    id: '00000000-0000-4000-9007-000000000003',
    key: 'existingProductsUsed',
    label: 'Existing Products Used',
    type: 'textarea',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_RELATIONSHIP,
  }),
  field({
    id: '00000000-0000-4000-9007-000000000004',
    key: 'customerSince',
    label: 'Customer Since',
    type: 'date',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_RELATIONSHIP,
  }),
  field({
    id: SECTION_CLASSIFICATION,
    key: 'section_classification',
    label: 'Classification',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9008-000000000001',
    key: 'leadAccountSegment',
    label: 'Lead/Account Segment',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_CLASSIFICATION,
  }),
  field({
    id: '00000000-0000-4000-9008-000000000002',
    key: 'priorityTier',
    label: 'Priority / Tier',
    type: 'select',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    options: PLACEHOLDER_SELECT_OPTIONS,
    sectionId: SECTION_CLASSIFICATION,
  }),
  field({
    id: '00000000-0000-4000-9008-000000000003',
    key: 'tags',
    label: 'Tags',
    type: 'textarea',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_CLASSIFICATION,
  }),
  field({
    id: SECTION_SYSTEM,
    key: 'section_system',
    label: 'System',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-9009-000000000001',
    key: 'companyId',
    label: 'Company ID',
    type: 'text',
    showInTable: false,
    showInForm: true,
    editableOnDetail: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-9009-000000000002',
    key: 'createdDate',
    label: 'Created Date',
    type: 'date',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-9009-000000000003',
    key: 'lastUpdated',
    label: 'Last Updated',
    type: 'date',
    showInTable: false,
    showInForm: false,
    editableOnDetail: false,
    sectionId: SECTION_SYSTEM,
  }),
];

export const DEFAULT_COMPANY_FIELD_SCHEMA: CompanyFieldSchema = {
  fields: DEFAULT_COMPANY_FIELDS_UNSORTED.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  })),
};
