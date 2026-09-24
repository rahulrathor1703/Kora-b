import { BadRequestException } from '@nestjs/common';
import { assertPipelineStageSchemaChangeAllowed } from './pipeline-stage-schema.util';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

const platformBaseline = [
  { value: 'new', label: 'New', color: '#64748b' },
  { value: 'contacted', label: 'Contacted', color: '#3b82f6' },
];

function stageField(
  options: ProspectFieldDefinition['options'],
): ProspectFieldDefinition {
  return {
    id: 'stage',
    key: 'leadStatus',
    label: 'Lead Status',
    type: 'select',
    sortOrder: 0,
    pipelineStage: true,
    options,
  };
}

describe('assertPipelineStageSchemaChangeAllowed', () => {
  it('allows org-added stages when platform baseline remains', () => {
    expect(() =>
      assertPipelineStageSchemaChangeAllowed(platformBaseline, [
        stageField([...platformBaseline, { value: 'eqweq', label: 'Custom' }]),
      ]),
    ).not.toThrow();
  });

  it('rejects removing a platform stage', () => {
    expect(() =>
      assertPipelineStageSchemaChangeAllowed(platformBaseline, [
        stageField([platformBaseline[0]]),
      ]),
    ).toThrow(BadRequestException);
  });
});
