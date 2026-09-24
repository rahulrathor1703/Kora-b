import { BROKER_NAME_FIELD_KEY } from '../../companies/types/company-field-schema';
import type {
  FormFieldDefinition,
  FormTableColumnDefinition,
} from '../types/form-schema.types';

/** Single Identity section layout (Platform → Company fields) for local QA baseline. */
const SECTION_IDENTITY = '00000000-0000-4000-9001-000000000001';

const STATUS_OPTIONS = [
  { value: 'not_contacted', label: 'Not Contacted' },
  { value: 'outreach', label: 'outreach' },
  { value: 'intox', label: 'Intox' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'client', label: 'Client' },
  { value: 'not_relevant', label: 'Not relevant' },
] as const;

const INDUSTRY_OPTIONS = [
  { value: 'it', label: 'IT' },
  { value: 'manufactuting', label: 'Manufactuting' },
  { value: 'construction', label: 'Construction' },
] as const;

const ASSIGNED_TO_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'param', label: 'Param' },
  { value: 'rahul', label: 'Rahul' },
] as const;

function field(
  partial: Omit<FormFieldDefinition, 'sortOrder'>,
): Omit<FormFieldDefinition, 'sortOrder'> {
  return partial;
}

const BASELINE_UNSORTED: Omit<FormFieldDefinition, 'sortOrder'>[] = [
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
    placeholder: 'Enter company name',
  }),
  field({
    id: '00000000-0000-4000-9002-000000000010',
    key: 'status',
    label: 'Status',
    type: 'select',
    showInTable: true,
    showInForm: true,
    filterable: true,
    displayOptionsAsChips: true,
    options: [...STATUS_OPTIONS],
    sectionId: SECTION_IDENTITY,
    placeholder: 'Select status',
  }),
  field({
    id: '00000000-0000-4000-9002-000000000004',
    key: 'industry',
    label: 'Industry',
    type: 'select',
    showInTable: true,
    showInForm: true,
    filterable: true,
    options: [...INDUSTRY_OPTIONS],
    sectionId: SECTION_IDENTITY,
    placeholder: 'Select industry',
  }),
  field({
    id: '00000000-0000-4000-9002-000000000005',
    key: 'companyWebsite',
    label: 'Company Website',
    type: 'text',
    validationType: 'url',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_IDENTITY,
    placeholder: 'Enter company website',
  }),
  field({
    id: '00000000-0000-4000-9002-000000000011',
    key: 'contact',
    label: 'Contact',
    type: 'text',
    showInTable: false,
    showInForm: true,
    sectionId: SECTION_IDENTITY,
    placeholder: 'Enter contact',
  }),
  field({
    id: '00000000-0000-4000-9002-000000000012',
    key: 'assignedTo',
    label: 'Assigned to',
    type: 'select',
    showInTable: true,
    showInForm: true,
    filterable: true,
    options: [...ASSIGNED_TO_OPTIONS],
    sectionId: SECTION_IDENTITY,
    placeholder: 'Select assigned to',
  }),
  field({
    id: '00000000-0000-4000-9003-000000000004',
    key: 'address',
    label: 'Address',
    type: 'textarea',
    showInTable: true,
    showInForm: true,
    formColSpan: 2,
    sectionId: SECTION_IDENTITY,
    placeholder: 'Enter address',
  }),
];

export const COMPANY_CREATE_PLATFORM_BASELINE_FIELDS: FormFieldDefinition[] =
  BASELINE_UNSORTED.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  }));

export function buildCompanyCreatePlatformTableColumns(
  fields: FormFieldDefinition[],
): FormTableColumnDefinition[] {
  return fields
    .filter(
      (field) =>
        field.type !== 'section' &&
        field.showInTable !== false &&
        Boolean(field.key),
    )
    .map((field, index) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      type:
        field.type === 'email'
          ? 'email'
          : field.type === 'phone'
            ? 'phone'
            : field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : 'text',
      required: Boolean(field.required),
      sortOrder: index,
      system: Boolean(field.system),
    }));
}
