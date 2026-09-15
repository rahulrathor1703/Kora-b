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

export interface ProspectFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: ProspectFieldType;
  required?: boolean;
  sortOrder: number;
  showInTable: boolean;
  showInForm: boolean;
  filterable?: boolean;
  options?: ProspectFieldOption[];
  locationComponents?: LocationComponent[];
  locationInputMode?: LocationInputMode;
  sectionId?: string;
  system?: boolean;
  pipelineStage?: boolean;
  editableOnDetail?: boolean;
  formColSpan?: number;
}

export const PIPELINE_STAGE_FIELD_KEY = 'crmStatus';
export const PROTECTED_PIPELINE_STAGE_VALUE = 'prospect';

export interface ProspectFieldSchema {
  fields: ProspectFieldDefinition[];
}

function field(partial: ProspectFieldDefinition): ProspectFieldDefinition {
  return partial;
}

export const DEFAULT_PROSPECT_FIELD_SCHEMA: ProspectFieldSchema = {
  fields: [
    field({
      id: '00000000-0000-4000-8000-000000000001',
      key: 'fullName',
      label: 'Name',
      type: 'text',
      required: true,
      sortOrder: 0,
      showInTable: true,
      showInForm: true,
      system: true,
    }),
    field({
      id: '00000000-0000-4000-8000-000000000002',
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      sortOrder: 1,
      showInTable: true,
      showInForm: true,
      system: true,
    }),
    field({
      id: '00000000-0000-4000-8000-000000000003',
      key: 'designation',
      label: 'Designation',
      type: 'text',
      sortOrder: 2,
      showInTable: true,
      showInForm: true,
    }),
    field({
      id: '00000000-0000-4000-8000-000000000004',
      key: 'phone',
      label: 'Phone',
      type: 'phone',
      sortOrder: 3,
      showInTable: false,
      showInForm: true,
    }),
    field({
      id: '00000000-0000-4000-8000-000000000005',
      key: 'product',
      label: 'Product',
      type: 'multiselect',
      sortOrder: 4,
      showInTable: true,
      showInForm: true,
      filterable: true,
      options: [
        { value: 'insureops', label: 'InsureOps', color: '#ef4444' },
        { value: 'benefit-care', label: 'Benefit.care', color: '#a855f7' },
      ],
    }),
    field({
      id: '00000000-0000-4000-8000-000000000007',
      key: PIPELINE_STAGE_FIELD_KEY,
      label: 'CRM Status',
      type: 'select',
      sortOrder: 5,
      showInTable: true,
      showInForm: false,
      filterable: true,
      editableOnDetail: true,
      pipelineStage: true,
      options: [
        { value: 'prospect', label: 'Prospect', color: '#64748b' },
        { value: 'cold-lead', label: 'Cold Lead', color: '#3b82f6' },
        { value: 'warm-lead', label: 'Warm Lead', color: '#3b82f6' },
        {
          value: 'meeting-scheduled',
          label: 'Meeting Scheduled',
          color: '#3b82f6',
        },
        {
          value: 'product-demo-given',
          label: 'Product Demo Given',
          color: '#06b6d4',
        },
        {
          value: 'in-negotiations',
          label: 'In Negotiations',
          color: '#3b82f6',
        },
        { value: 'won', label: 'Won', color: '#22c55e' },
        { value: 'lost', label: 'Lost', color: '#ef4444' },
      ],
    }),
    field({
      id: '00000000-0000-4000-8000-000000000008',
      key: 'emailStatus',
      label: 'Email Status',
      type: 'select',
      sortOrder: 6,
      showInTable: true,
      showInForm: false,
      filterable: true,
      options: [
        { value: 'eligible', label: 'eligible', color: '#f59e0b' },
        { value: 'done', label: 'Done', color: '#3b82f6' },
        { value: 'paused', label: 'Paused', color: '#64748b' },
      ],
    }),
    field({
      id: '00000000-0000-4000-8000-000000000009',
      key: 'score',
      label: 'Score',
      type: 'number',
      sortOrder: 7,
      showInTable: true,
      showInForm: false,
    }),
    field({
      id: '00000000-0000-4000-8000-00000000000a',
      key: 'bantTier',
      label: 'BANT Tier',
      type: 'select',
      sortOrder: 8,
      showInTable: true,
      showInForm: false,
      filterable: true,
      options: [
        { value: 'hot', label: 'Hot' },
        { value: 'warm', label: 'Warm' },
        { value: 'cold', label: 'Cold' },
        { value: 'disqualified', label: 'Disqualified' },
      ],
    }),
    field({
      id: '00000000-0000-4000-8000-00000000000b',
      key: 'source',
      label: 'Source',
      type: 'select',
      sortOrder: 9,
      showInTable: true,
      showInForm: true,
      filterable: true,
      options: [
        { value: 'website', label: 'Website' },
        { value: 'referral', label: 'Referral' },
        { value: 'direct-enquiry', label: 'Direct enquiry' },
        { value: 'apollo', label: 'Apollo' },
        { value: 'linkedin', label: 'LinkedIn' },
      ],
    }),
    field({
      id: '00000000-0000-4000-8000-00000000000c',
      key: 'followUpDue',
      label: 'Follow-up Due',
      type: 'date',
      sortOrder: 10,
      showInTable: true,
      showInForm: true,
      editableOnDetail: true,
    }),
    field({
      id: '00000000-0000-4000-8000-00000000000d',
      key: 'remarks',
      label: 'Remarks',
      type: 'textarea',
      sortOrder: 11,
      showInTable: false,
      showInForm: true,
      editableOnDetail: true,
    }),
  ],
};
