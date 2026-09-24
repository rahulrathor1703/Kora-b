import { BadRequestException } from '@nestjs/common';
import {
  buildMinimalPipelineStageOverlay,
  mergePipelineStageOptions,
  pipelineStageOverlayIsEmpty,
} from './pipeline-stage-options.util';
import type {
  FormFieldDefinition,
  FormFieldOption,
} from './types/form-schema.types';

function fieldOptionsStructureEqual(
  left: FormFieldDefinition['options'],
  right: FormFieldDefinition['options'],
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((option, index) => {
    const other = right[index];
    return option.value === other.value && option.label === other.label;
  });
}

function fieldOptionsColorsEqual(
  left: FormFieldDefinition['options'],
  right: FormFieldDefinition['options'],
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((option, index) => {
    const other = right[index];
    return (option.color ?? '') === (other.color ?? '');
  });
}

export function applyOptionColorOverlay(
  platformOptions: FormFieldOption[] | undefined,
  overlayOptions: FormFieldOption[] | undefined,
): FormFieldOption[] | undefined {
  if (!platformOptions?.length) {
    return platformOptions;
  }

  if (!overlayOptions?.length) {
    return platformOptions;
  }

  const colorByValue = new Map(
    overlayOptions.map((option) => [option.value, option.color]),
  );

  return platformOptions.map((option) => {
    if (!colorByValue.has(option.value)) {
      return option;
    }

    const overlayColor = colorByValue.get(option.value);
    return {
      ...option,
      color: overlayColor?.trim() || undefined,
    };
  });
}

function buildPlatformFieldOptionOverlay(
  platform: FormFieldDefinition,
  overlayOptions: FormFieldOption[],
): FormFieldDefinition {
  return {
    id: platform.id,
    key: platform.key,
    label: platform.label,
    type: platform.type,
    sortOrder: platform.sortOrder,
    options: overlayOptions,
    pipelineStage: platform.pipelineStage,
    displayOptionsAsChips: platform.displayOptionsAsChips,
    source: 'org',
  };
}

function buildChipFieldColorOverlay(
  submitted: FormFieldDefinition,
  platform: FormFieldDefinition,
): FormFieldDefinition {
  const mergedOptions = applyOptionColorOverlay(
    platform.options,
    submitted.options,
  );

  return {
    id: platform.id,
    key: platform.key,
    label: platform.label,
    type: platform.type,
    sortOrder: platform.sortOrder,
    options: mergedOptions,
    displayOptionsAsChips: platform.displayOptionsAsChips,
    source: 'org',
  };
}

function resolvePlatformFieldOverlay(
  submitted: FormFieldDefinition,
  platform: FormFieldDefinition,
): FormFieldDefinition | null {
  const structureMatches = fieldOptionsStructureEqual(
    submitted.options,
    platform.options,
  );
  const colorsMatch = fieldOptionsColorsEqual(
    submitted.options,
    platform.options,
  );

  if (structureMatches && colorsMatch) {
    return null;
  }

  if (platform.pipelineStage) {
    if (pipelineStageOverlayIsEmpty(submitted.options, platform.options)) {
      return null;
    }

    const minimalOptions = buildMinimalPipelineStageOverlay(
      submitted.options,
      platform.options,
    );

    return buildPlatformFieldOptionOverlay(platform, minimalOptions);
  }

  if (!structureMatches) {
    throw new BadRequestException(
      `Platform field "${platform.key}" cannot be modified by organization`,
    );
  }

  if (!platform.displayOptionsAsChips) {
    throw new BadRequestException(
      `Platform field "${platform.key}" cannot be modified by organization`,
    );
  }

  return buildChipFieldColorOverlay(submitted, platform);
}

export function isStructuralPlatformFieldChange(
  submitted: FormFieldDefinition,
  platform: FormFieldDefinition,
): boolean {
  return (
    submitted.label !== platform.label ||
    submitted.type !== platform.type ||
    submitted.required !== platform.required ||
    submitted.showInTable !== platform.showInTable ||
    submitted.filterable !== platform.filterable ||
    submitted.minLength !== platform.minLength ||
    submitted.maxLength !== platform.maxLength ||
    submitted.validationType !== platform.validationType ||
    !fieldOptionsStructureEqual(submitted.options, platform.options)
  );
}

export function extractOrgExtensionFields(
  submittedFields: FormFieldDefinition[],
  platformFields: FormFieldDefinition[],
): FormFieldDefinition[] {
  const platformKeys = new Set(platformFields.map((field) => field.key));
  const platformByKey = new Map(
    platformFields.map((field) => [field.key, field]),
  );
  const orgFields: FormFieldDefinition[] = [];

  for (const field of submittedFields) {
    if (!platformKeys.has(field.key)) {
      orgFields.push(field);
      continue;
    }

    const platformField = platformByKey.get(field.key)!;

    const nonOptionStructural =
      field.label !== platformField.label ||
      field.type !== platformField.type ||
      field.required !== platformField.required ||
      field.showInTable !== platformField.showInTable ||
      field.filterable !== platformField.filterable ||
      field.minLength !== platformField.minLength ||
      field.maxLength !== platformField.maxLength ||
      field.validationType !== platformField.validationType;

    if (nonOptionStructural) {
      throw new BadRequestException(
        `Platform field "${field.key}" cannot be modified by organization`,
      );
    }

    const overlay = resolvePlatformFieldOverlay(field, platformField);
    if (overlay) {
      orgFields.push(overlay);
    }
  }

  const deletedPlatformKeys = platformFields.filter(
    (platformField) =>
      !submittedFields.some((field) => field.key === platformField.key),
  );

  if (deletedPlatformKeys.length > 0) {
    throw new BadRequestException(
      `Platform fields cannot be removed: ${deletedPlatformKeys.map((f) => f.key).join(', ')}`,
    );
  }

  return orgFields;
}

export function mergePlatformFieldWithOrgOverlay(
  platformField: FormFieldDefinition,
  overlay: FormFieldDefinition | undefined,
): FormFieldDefinition {
  const merged = mergePlatformFieldForOrg(platformField);

  if (!overlay?.options?.length) {
    return merged;
  }

  if (overlay.pipelineStage || platformField.pipelineStage) {
    return {
      ...merged,
      options: mergePipelineStageOptions(
        platformField.options,
        overlay.options,
      ),
    };
  }

  if (platformField.displayOptionsAsChips) {
    return {
      ...merged,
      options: applyOptionColorOverlay(platformField.options, overlay.options),
    };
  }

  return merged;
}

export function mergePlatformFieldForOrg(
  platformField: FormFieldDefinition,
): FormFieldDefinition {
  return { ...platformField, source: 'platform' as const };
}
