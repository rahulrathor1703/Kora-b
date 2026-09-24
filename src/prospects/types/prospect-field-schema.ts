import type { FieldStringValidationRules } from '../../common/field-schema/field-validation.types';
import type {
  LocationComponent,
  LocationInputMode,
} from '../../common/location/location-field.types';

export type ProspectFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'date'
  | 'location'
  | 'section';

export interface ProspectFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface ProspectFieldDefinition extends FieldStringValidationRules {
  id: string;
  key: string;
  label: string;
  type: ProspectFieldType;
  required?: boolean;
  sortOrder: number;
  showInTable: boolean;
  showInForm: boolean;
  filterable?: boolean;
  displayOptionsAsChips?: boolean;
  options?: ProspectFieldOption[];
  locationComponents?: LocationComponent[];
  locationInputMode?: LocationInputMode;
  sectionId?: string;
  system?: boolean;
  pipelineStage?: boolean;
  editableOnDetail?: boolean;
  formColSpan?: number;
}

export const LEAD_STATUS_FIELD_KEY = 'leadStatus';
/** @deprecated Use LEAD_STATUS_FIELD_KEY — pipeline board is keyed on lead status. */
export const PIPELINE_STAGE_FIELD_KEY = LEAD_STATUS_FIELD_KEY;
export const LEGACY_CRM_STATUS_FIELD_KEY = 'crmStatus';
export const PROTECTED_PIPELINE_STAGE_VALUE = 'new';

export interface ProspectFieldSchema {
  fields: ProspectFieldDefinition[];
}

const SECTION_BASIC = '00000000-0000-4000-8001-000000000001';
const SECTION_COMPANY = '00000000-0000-4000-8001-000000000002';
const SECTION_CONTACT = '00000000-0000-4000-8001-000000000003';
const SECTION_PRODUCT = '00000000-0000-4000-8001-000000000004';
const SECTION_QUALIFICATION = '00000000-0000-4000-8001-000000000005';
const SECTION_FOLLOWUP = '00000000-0000-4000-8001-000000000006';
const SECTION_DOCUMENTS = '00000000-0000-4000-8001-000000000007';
const SECTION_SYSTEM = '00000000-0000-4000-8001-000000000008';

const YES_NO_OPTIONS: ProspectFieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const LEAD_STATUS_OPTIONS: ProspectFieldOption[] = [
  { value: 'new', label: 'New', color: '#64748b' },
  { value: 'contacted', label: 'Contacted', color: '#3b82f6' },
  { value: 'qualified', label: 'Qualified', color: '#06b6d4' },
  { value: 'converted', label: 'Converted', color: '#22c55e' },
  { value: 'lost', label: 'Lost', color: '#ef4444' },
  { value: 'nurture', label: 'Nurture', color: '#f59e0b' },
];

function field(
  partial: Omit<ProspectFieldDefinition, 'sortOrder'>,
): Omit<ProspectFieldDefinition, 'sortOrder'> {
  return partial;
}

function selectOptions(
  entries: Array<{ value: string; label: string }>,
): ProspectFieldOption[] {
  return entries.map((entry) => ({ ...entry }));
}

const DEFAULT_PROSPECT_FIELDS_UNSORTED: Omit<
  ProspectFieldDefinition,
  'sortOrder'
>[] = [
  field({
    id: '00000000-0000-4000-8000-000000000001',
    key: 'fullName',
    label: 'Name',
    type: 'text',
    required: true,
    showInTable: true,
    showInForm: false,
    system: true,
  }),
  field({
    id: '00000000-0000-4000-8000-000000000002',
    key: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    showInTable: true,
    showInForm: false,
    system: true,
  }),
  field({
    id: '00000000-0000-4000-8000-000000000008',
    key: 'emailStatus',
    label: 'Email Status',
    type: 'select',
    showInTable: true,
    showInForm: false,
    filterable: false,
    options: [
      { value: 'eligible', label: 'eligible', color: '#f59e0b' },
      { value: 'done', label: 'Done', color: '#3b82f6' },
      { value: 'paused', label: 'Paused', color: '#64748b' },
    ],
  }),
  field({
    id: '00000000-0000-4000-8000-000000000009',
    key: 'score',
    label: 'Lead Score',
    type: 'number',
    showInTable: true,
    showInForm: false,
    editableOnDetail: false,
  }),
  field({
    id: '00000000-0000-4000-8000-00000000000a',
    key: 'bantTier',
    label: 'BANT Tier',
    type: 'select',
    showInTable: true,
    showInForm: false,
    editableOnDetail: false,
    filterable: true,
    options: [
      { value: 'hot', label: 'Hot' },
      { value: 'warm', label: 'Warm' },
      { value: 'cold', label: 'Cold' },
      { value: 'disqualified', label: 'Disqualified' },
    ],
  }),
  field({
    id: SECTION_BASIC,
    key: 'section_basic_details',
    label: 'Basic Details',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000001',
    key: 'leadType',
    label: 'Lead Type',
    type: 'select',
    required: true,
    showInTable: true,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'individual', label: 'Individual' },
      { value: 'company', label: 'Company' },
    ]),
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000002',
    key: 'firstName',
    label: 'First Name',
    type: 'text',
    required: true,
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000003',
    key: 'lastName',
    label: 'Last Name',
    type: 'text',
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000004',
    key: 'workEmail',
    label: 'Work Email',
    type: 'email',
    required: true,
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000005',
    key: 'phoneNumber',
    label: 'Phone Number',
    type: 'phone',
    required: true,
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000006',
    key: 'designation',
    label: 'Designation',
    type: 'text',
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000007',
    key: 'leadSource',
    label: 'Lead Source',
    type: 'select',
    required: true,
    showInTable: true,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'website', label: 'Website' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'referral', label: 'Referral' },
      { value: 'event', label: 'Event' },
      { value: 'outbound', label: 'Outbound' },
      { value: 'partner', label: 'Partner' },
      { value: 'other', label: 'Other' },
    ]),
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000008',
    key: 'leadSourceDetail',
    label: 'Lead Source Detail',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-000000000009',
    key: 'leadOwner',
    label: 'Lead Owner',
    type: 'text',
    required: true,
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: '00000000-0000-4000-8002-00000000000a',
    key: LEAD_STATUS_FIELD_KEY,
    label: 'Lead Status',
    type: 'select',
    required: true,
    showInTable: true,
    showInForm: true,
    filterable: true,
    editableOnDetail: true,
    pipelineStage: true,
    displayOptionsAsChips: true,
    options: LEAD_STATUS_OPTIONS,
    sectionId: SECTION_BASIC,
  }),
  field({
    id: SECTION_COMPANY,
    key: 'section_company_details',
    label: 'Company Details',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000001',
    key: 'company',
    label: 'Company',
    type: 'text',
    required: true,
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000002',
    key: 'companyType',
    label: 'Company Type',
    type: 'select',
    required: true,
    showInTable: false,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'broker', label: 'Broker' },
      { value: 'corporate-agent', label: 'Corporate Agent' },
      { value: 'bank', label: 'Bank' },
      { value: 'nbfc', label: 'NBFC' },
      { value: 'tpa', label: 'TPA' },
      { value: 'insurtech', label: 'InsurTech' },
      { value: 'other', label: 'Other' },
    ]),
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000003',
    key: 'website',
    label: 'Website',
    type: 'text',
    validationType: 'url',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000004',
    key: 'industry',
    label: 'Industry',
    type: 'select',
    showInTable: false,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'pending', label: 'Pending configuration' },
    ]),
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000005',
    key: 'companySize',
    label: 'Company Size',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'pending', label: 'Pending configuration' },
    ]),
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000006',
    key: 'country',
    label: 'Country',
    type: 'select',
    required: true,
    showInTable: false,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'india', label: 'India' },
      { value: 'pending', label: 'Pending configuration' },
    ]),
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000007',
    key: 'state',
    label: 'State',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'pending', label: 'Pending configuration' },
    ]),
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000008',
    key: 'city',
    label: 'City',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-000000000009',
    key: 'existingCustomer',
    label: 'Existing Customer',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: YES_NO_OPTIONS,
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: '00000000-0000-4000-8003-00000000000a',
    key: 'accountOwner',
    label: 'Account Owner',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_COMPANY,
  }),
  field({
    id: SECTION_CONTACT,
    key: 'section_contact_details',
    label: 'Contact Details',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8004-000000000001',
    key: 'department',
    label: 'Department',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'sales', label: 'Sales' },
      { value: 'operations', label: 'Operations' },
      { value: 'it', label: 'IT' },
      { value: 'finance', label: 'Finance' },
      { value: 'management', label: 'Management' },
      { value: 'other', label: 'Other' },
    ]),
    sectionId: SECTION_CONTACT,
  }),
  field({
    id: '00000000-0000-4000-8004-000000000002',
    key: 'contactType',
    label: 'Contact Type',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'decision-maker', label: 'Decision Maker' },
      { value: 'influencer', label: 'Influencer' },
      { value: 'user', label: 'User' },
      { value: 'technical', label: 'Technical' },
      { value: 'procurement', label: 'Procurement' },
    ]),
    sectionId: SECTION_CONTACT,
  }),
  field({
    id: '00000000-0000-4000-8004-000000000003',
    key: 'decisionMakingRole',
    label: 'Decision-Making Role',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'decision-maker', label: 'Decision Maker' },
      { value: 'influencer', label: 'Influencer' },
      { value: 'unknown', label: 'Unknown' },
    ]),
    sectionId: SECTION_CONTACT,
  }),
  field({
    id: '00000000-0000-4000-8004-000000000004',
    key: 'reportingTo',
    label: 'Reporting To',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_CONTACT,
  }),
  field({
    id: SECTION_PRODUCT,
    key: 'section_product_requirements',
    label: 'Product Requirements',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000001',
    key: 'productInterestedIn',
    label: 'Product Interested In',
    type: 'multiselect',
    required: true,
    showInTable: true,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'insureops', label: 'InsureOps' },
      { value: 'insureone', label: 'InsureOne' },
      { value: 'insurepos', label: 'InsurePOS' },
      { value: 'insuresell', label: 'InsureSell' },
      { value: 'benefit-care', label: 'Benfit.care' },
      { value: 'custom', label: 'Custom' },
    ]),
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000002',
    key: 'requirementType',
    label: 'Requirement Type',
    type: 'multiselect',
    required: true,
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'new-platform', label: 'New Platform' },
      { value: 'replacement', label: 'Replacement' },
      { value: 'integration', label: 'Integration' },
      { value: 'automation', label: 'Automation' },
      { value: 'custom-development', label: 'Custom Development' },
    ]),
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000003',
    key: 'requirementDescription',
    label: 'Requirement Description',
    type: 'textarea',
    required: true,
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000004',
    key: 'currentSolution',
    label: 'Current Solution',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000005',
    key: 'numberOfUsers',
    label: 'Number of Users',
    type: 'number',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000006',
    key: 'numberOfBranches',
    label: 'Number of Branches',
    type: 'number',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000007',
    key: 'requiredIntegrations',
    label: 'Required Integrations',
    type: 'multiselect',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'insurers', label: 'Insurers' },
      { value: 'crm', label: 'CRM' },
      { value: 'payment', label: 'Payment' },
      { value: 'erp', label: 'ERP' },
      { value: 'hrms', label: 'HRMS' },
      { value: 'api', label: 'API' },
      { value: 'other', label: 'Other' },
    ]),
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000008',
    key: 'geography',
    label: 'Geography',
    type: 'multiselect',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'india', label: 'India' },
      { value: 'uae', label: 'UAE' },
      { value: 'gcc', label: 'GCC' },
      { value: 'mena', label: 'MENA' },
      { value: 'africa', label: 'Africa' },
      { value: 'other', label: 'Other' },
    ]),
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-000000000009',
    key: 'expectedGoLive',
    label: 'Expected Go-Live',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'immediate', label: 'Immediate' },
      { value: '1-3-months', label: '1–3 months' },
      { value: '3-6-months', label: '3–6 months' },
      { value: '6-plus-months', label: '6+ months' },
    ]),
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: '00000000-0000-4000-8005-00000000000a',
    key: 'budgetRange',
    label: 'Budget Range',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'pending', label: 'Pending configuration' },
    ]),
    sectionId: SECTION_PRODUCT,
  }),
  field({
    id: SECTION_QUALIFICATION,
    key: 'section_qualification',
    label: 'Qualification',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000001',
    key: 'qualificationStatus',
    label: 'Qualification Status',
    type: 'select',
    showInTable: true,
    showInForm: true,
    filterable: true,
    options: selectOptions([
      { value: 'unqualified', label: 'Unqualified' },
      { value: 'mql', label: 'MQL' },
      { value: 'sql', label: 'SQL' },
      { value: 'qualified', label: 'Qualified' },
    ]),
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000002',
    key: 'decisionMakerIdentified',
    label: 'Decision Maker Identified',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: YES_NO_OPTIONS,
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000003',
    key: 'budgetIdentified',
    label: 'Budget Identified',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: YES_NO_OPTIONS,
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000004',
    key: 'timelineIdentified',
    label: 'Timeline Identified',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: YES_NO_OPTIONS,
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000005',
    key: 'estimatedDealValue',
    label: 'Estimated Deal Value',
    type: 'number',
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000006',
    key: 'expectedCloseDate',
    label: 'Expected Close Date',
    type: 'date',
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: '00000000-0000-4000-8006-000000000007',
    key: 'probability',
    label: 'Probability',
    type: 'number',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_QUALIFICATION,
  }),
  field({
    id: SECTION_FOLLOWUP,
    key: 'section_follow_up',
    label: 'Follow-up',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8007-000000000001',
    key: 'nextAction',
    label: 'Next Action',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_FOLLOWUP,
  }),
  field({
    id: '00000000-0000-4000-8007-000000000002',
    key: 'nextFollowUpDate',
    label: 'Next Follow-up Date',
    type: 'date',
    showInTable: true,
    showInForm: true,
    sectionId: SECTION_FOLLOWUP,
  }),
  field({
    id: '00000000-0000-4000-8007-000000000003',
    key: 'preferredCommunication',
    label: 'Preferred Communication',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: selectOptions([
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'teams', label: 'Teams' },
    ]),
    sectionId: SECTION_FOLLOWUP,
  }),
  field({
    id: '00000000-0000-4000-8007-000000000004',
    key: 'meetingScheduled',
    label: 'Meeting Scheduled',
    type: 'select',
    showInTable: false,
    showInForm: true,
    options: YES_NO_OPTIONS,
    sectionId: SECTION_FOLLOWUP,
  }),
  field({
    id: SECTION_DOCUMENTS,
    key: 'section_documents',
    label: 'Documents',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8008-000000000001',
    key: 'requirementDocument',
    label: 'Requirement Document',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_DOCUMENTS,
  }),
  field({
    id: '00000000-0000-4000-8008-000000000002',
    key: 'rfpTender',
    label: 'RFP / Tender',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_DOCUMENTS,
  }),
  field({
    id: '00000000-0000-4000-8008-000000000003',
    key: 'companyProfile',
    label: 'Company Profile',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_DOCUMENTS,
  }),
  field({
    id: '00000000-0000-4000-8008-000000000004',
    key: 'otherDocuments',
    label: 'Other Documents',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_DOCUMENTS,
  }),
  field({
    id: SECTION_SYSTEM,
    key: 'section_internal_system',
    label: 'Internal / System',
    type: 'section',
    showInTable: false,
    showInForm: true,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000001',
    key: 'leadId',
    label: 'Lead ID',
    type: 'text',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000002',
    key: 'createdBy',
    label: 'Created By',
    type: 'text',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000003',
    key: 'createdDate',
    label: 'Created Date',
    type: 'date',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000004',
    key: 'modifiedDate',
    label: 'Modified Date',
    type: 'date',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000006',
    key: 'utmSource',
    label: 'UTM Source',
    type: 'text',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000007',
    key: 'utmCampaign',
    label: 'UTM Campaign',
    type: 'text',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000008',
    key: 'convertedAccount',
    label: 'Converted Account',
    type: 'text',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
  field({
    id: '00000000-0000-4000-8009-000000000009',
    key: 'convertedOpportunity',
    label: 'Converted Opportunity',
    type: 'text',
    showInTable: false,
    showInForm: false,
    sectionId: SECTION_SYSTEM,
  }),
];

export const DEFAULT_PROSPECT_FIELD_SCHEMA: ProspectFieldSchema = {
  fields: DEFAULT_PROSPECT_FIELDS_UNSORTED.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  })),
};
