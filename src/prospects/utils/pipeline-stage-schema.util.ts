import { BadRequestException } from '@nestjs/common';
import { platformPipelineStageValues } from '../../forms/pipeline-stage-options.util';
import type { FormFieldOption } from '../../forms/types/form-schema.types';
import {
  PROTECTED_PIPELINE_STAGE_VALUE,
  type ProspectFieldDefinition,
} from '../types/prospect-field-schema';
import { findPipelineStageField } from './prospect-identity.util';

export function assertPipelineStageSchemaChangeAllowed(
  platformBaselineOptions: FormFieldOption[],
  nextFields: ProspectFieldDefinition[],
): void {
  const nextStageField = findPipelineStageField(nextFields);
  if (!nextStageField?.options?.length) {
    throw new BadRequestException(
      'Schema must include Lead Status as the pipeline stage field',
    );
  }

  const baselineValues = platformPipelineStageValues(platformBaselineOptions);
  const nextValues = new Set(
    nextStageField.options.map((option) => option.value),
  );

  if (!nextValues.has(PROTECTED_PIPELINE_STAGE_VALUE)) {
    throw new BadRequestException(
      'Pipeline must always include the New lead status stage',
    );
  }

  for (const baselineValue of baselineValues) {
    if (nextValues.has(baselineValue)) {
      continue;
    }

    const label =
      platformBaselineOptions.find((option) => option.value === baselineValue)
        ?.label ?? baselineValue;

    throw new BadRequestException(
      `Platform pipeline stage "${label}" cannot be deleted`,
    );
  }
}

export function isPlatformPipelineStageValue(
  value: string,
  platformBaselineOptions: FormFieldOption[],
): boolean {
  return platformPipelineStageValues(platformBaselineOptions).has(value);
}
