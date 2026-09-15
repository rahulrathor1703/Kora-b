import type {
  BantCriterion,
  BantResponses,
  BantSettingsConfig,
  BantTierThreshold,
} from '../types/bant-settings.types';

export function computeWeightedBantScore(
  config: BantSettingsConfig,
  responses: BantResponses,
): number | null {
  const activeCriteria = config.criteria
    .filter((criterion) => criterion.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let weightedSum = 0;
  let totalWeight = 0;
  let answeredCount = 0;

  for (const criterion of activeCriteria) {
    const selectedValue = responses[criterion.key]?.trim();
    if (!selectedValue) {
      continue;
    }

    const selectedOption = criterion.options.find(
      (option) =>
        option.isActive &&
        (option.value === selectedValue || option.id === selectedValue),
    );

    if (!selectedOption) {
      continue;
    }

    weightedSum += criterion.weight * selectedOption.points;
    totalWeight += criterion.weight;
    answeredCount += 1;
  }

  if (answeredCount === 0 || totalWeight === 0) {
    return null;
  }

  return Math.round(weightedSum / totalWeight);
}

export function resolveBantTier(
  score: number | null,
  tiers: BantTierThreshold[],
): string | null {
  if (score === null) {
    return null;
  }

  const sortedTiers = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const tier of sortedTiers) {
    if (score >= tier.minScore && score <= tier.maxScore) {
      return tier.value;
    }
  }

  return null;
}

export function getActiveCriteria(criteria: BantCriterion[]): BantCriterion[] {
  return criteria
    .filter((criterion) => criterion.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
