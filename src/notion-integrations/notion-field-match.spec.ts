import { buildNotionFieldPlan } from './notion-field-match';
import { DEFAULT_COMPANY_FIELD_SCHEMA } from '../companies/types/company-field-schema';
import { DEFAULT_PROSPECT_FIELD_SCHEMA } from '../prospects/types/prospect-field-schema';

describe('notion-field-match', () => {
  it('maps matching prospect fields and creates unmatched ones', () => {
    const plan = buildNotionFieldPlan({
      destination: 'prospect',
      fields: DEFAULT_PROSPECT_FIELD_SCHEMA.fields,
      properties: [
        {
          id: 'title',
          name: 'Name',
          notionType: 'title',
          supported: true,
          suggestedFieldType: 'text',
        },
        {
          id: 'email',
          name: 'Email',
          notionType: 'email',
          supported: true,
          suggestedFieldType: 'email',
        },
        {
          id: 'region',
          name: 'Sales Region',
          notionType: 'select',
          supported: true,
          suggestedFieldType: 'select',
          options: [{ value: 'north', label: 'North' }],
        },
      ],
      excludedPropertyIds: [],
    });

    expect(plan.fieldMapping).toEqual({
      fullName: 'Name',
      email: 'Email',
      sales_region: 'Sales Region',
    });
    expect(plan.fieldsToCreate).toEqual([
      expect.objectContaining({
        key: 'sales_region',
        label: 'Sales Region',
        type: 'select',
      }),
    ]);
    expect(plan.missingRequiredLabels).toEqual([]);
  });

  it('skips excluded and unsupported properties', () => {
    const plan = buildNotionFieldPlan({
      destination: 'company',
      fields: DEFAULT_COMPANY_FIELD_SCHEMA.fields,
      properties: [
        {
          id: 'title',
          name: 'Company Name',
          notionType: 'title',
          supported: true,
          suggestedFieldType: 'text',
        },
        {
          id: 'notes',
          name: 'Internal notes',
          notionType: 'rich_text',
          supported: true,
          suggestedFieldType: 'text',
        },
        {
          id: 'rel',
          name: 'Related',
          notionType: 'relation',
          supported: false,
          suggestedFieldType: null,
        },
      ],
      excludedPropertyIds: ['notes'],
    });

    expect(plan.fieldMapping).toEqual({
      brokerName: 'Company Name',
    });
    expect(plan.fieldsToCreate).toEqual([]);
    expect(plan.missingRequiredLabels).toEqual([]);
  });

  it('reports missing required company fields', () => {
    const plan = buildNotionFieldPlan({
      destination: 'company',
      fields: DEFAULT_COMPANY_FIELD_SCHEMA.fields,
      properties: [
        {
          id: 'remarks',
          name: 'Remarks',
          notionType: 'rich_text',
          supported: true,
          suggestedFieldType: 'text',
        },
      ],
      excludedPropertyIds: [],
    });

    expect(plan.missingRequiredLabels).toEqual(['Company Name']);
  });
});
