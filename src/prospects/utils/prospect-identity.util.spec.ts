import {
  applyDefaultProspectPipelineStage,
  resolveProspectEmail,
  resolveProspectFullName,
} from './prospect-identity.util';
import {
  LEAD_STATUS_FIELD_KEY,
  PROTECTED_PIPELINE_STAGE_VALUE,
  type ProspectFieldDefinition,
} from '../types/prospect-field-schema';

function field(
  partial: Partial<ProspectFieldDefinition> &
    Pick<ProspectFieldDefinition, 'key'>,
): ProspectFieldDefinition {
  return {
    id: partial.id ?? '00000000-0000-4000-8000-000000000099',
    label: partial.label ?? partial.key,
    type: partial.type ?? 'text',
    sortOrder: partial.sortOrder ?? 0,
    showInTable: partial.showInTable ?? true,
    showInForm: partial.showInForm ?? true,
    ...partial,
  };
}

describe('prospect identity utils', () => {
  it('resolves full name from first and last name fields', () => {
    const fields = [
      field({ key: 'first_name', label: 'First Name' }),
      field({ key: 'last_name', label: 'Last Name' }),
    ];

    expect(
      resolveProspectFullName(fields, {
        first_name: 'Param',
        last_name: 'Thakur',
      }),
    ).toBe('Param Thakur');
  });

  it('resolves email from validationType email fields', () => {
    const fields = [
      field({
        key: 'email_3',
        label: 'Email',
        validationType: 'email',
      }),
    ];

    expect(resolveProspectEmail(fields, { email_3: 'Param@Example.com' })).toBe(
      'param@example.com',
    );
  });

  it('sets default pipeline stage on the pipeline stage field only', () => {
    const fields = [
      field({
        key: LEAD_STATUS_FIELD_KEY,
        type: 'select',
        pipelineStage: true,
        options: [{ value: 'new', label: 'New' }],
      }),
    ];
    const values: Record<string, string> = {};

    applyDefaultProspectPipelineStage(fields, values);

    expect(values[LEAD_STATUS_FIELD_KEY]).toBe(PROTECTED_PIPELINE_STAGE_VALUE);
  });
});
