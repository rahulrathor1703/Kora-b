import type { FormFieldOption } from './types/form-schema.types';

export function normalizePipelineStageOptionColor(
  color: string | undefined,
): string | undefined {
  return color?.trim() || undefined;
}

export function platformPipelineStageValues(
  platformOptions: FormFieldOption[] | undefined,
): Set<string> {
  return new Set((platformOptions ?? []).map((option) => option.value));
}

function stripOptionSource(option: FormFieldOption): FormFieldOption {
  return {
    value: option.value,
    label: option.label,
    color: option.color,
  };
}

/** Merge published platform stages with org overlay; tags each option for API responses. */
export function mergePipelineStageOptions(
  platformOptions: FormFieldOption[] | undefined,
  overlayOptions: FormFieldOption[] | undefined,
): FormFieldOption[] {
  const platform = platformOptions ?? [];

  if (!overlayOptions?.length) {
    return platform.map((option) => ({
      ...option,
      source: 'platform' as const,
    }));
  }

  const overlayByValue = new Map(
    overlayOptions.map((option) => [option.value, stripOptionSource(option)]),
  );
  const baselineValues = platformPipelineStageValues(platform);

  const merged: FormFieldOption[] = platform.map((platformOption) => {
    const overlay = overlayByValue.get(platformOption.value);

    if (!overlay) {
      return { ...platformOption, source: 'platform' as const };
    }

    return {
      value: platformOption.value,
      label: overlay.label.trim() || platformOption.label,
      color:
        normalizePipelineStageOptionColor(overlay.color) ??
        normalizePipelineStageOptionColor(platformOption.color),
      source: 'platform' as const,
    };
  });

  for (const overlay of overlayOptions) {
    const value = overlay.value.trim();
    if (baselineValues.has(value)) {
      continue;
    }

    merged.push({
      value,
      label: overlay.label.trim(),
      color: normalizePipelineStageOptionColor(overlay.color),
      source: 'org' as const,
    });
  }

  return merged;
}

/** Persist only org-added stages and platform label/color overrides. */
export function buildMinimalPipelineStageOverlay(
  submittedOptions: FormFieldOption[] | undefined,
  platformOptions: FormFieldOption[] | undefined,
): FormFieldOption[] {
  const platform = platformOptions ?? [];
  const submitted = submittedOptions ?? [];

  if (submitted.length === 0) {
    return [];
  }

  const platformByValue = new Map(
    platform.map((option) => [option.value, option]),
  );
  const minimal: FormFieldOption[] = [];

  for (const option of submitted) {
    const value = option.value.trim();
    const label = option.label.trim();
    const color = normalizePipelineStageOptionColor(option.color);
    const platformOption = platformByValue.get(value);

    if (!platformOption) {
      minimal.push({ value, label, color });
      continue;
    }

    const platformLabel = platformOption.label;
    const platformColor = normalizePipelineStageOptionColor(
      platformOption.color,
    );
    const labelChanged = label !== platformLabel;
    const colorChanged = color !== platformColor;

    if (labelChanged || colorChanged) {
      minimal.push({
        value,
        label,
        color,
      });
    }
  }

  return minimal;
}

export function pipelineStageOverlayIsEmpty(
  submittedOptions: FormFieldOption[] | undefined,
  platformOptions: FormFieldOption[] | undefined,
): boolean {
  return (
    buildMinimalPipelineStageOverlay(submittedOptions, platformOptions)
      .length === 0
  );
}
