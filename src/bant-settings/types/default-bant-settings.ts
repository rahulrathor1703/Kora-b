import { randomUUID } from 'crypto';
import type { BantSettingsConfig } from './bant-settings.types';

function option(
  label: string,
  value: string,
  points: number,
  sortOrder: number,
): BantSettingsConfig['criteria'][number]['options'][number] {
  return {
    id: randomUUID(),
    label,
    value,
    points,
    sortOrder,
    isActive: true,
  };
}

function criterion(
  key: string,
  label: string,
  weight: number,
  sortOrder: number,
  options: BantSettingsConfig['criteria'][number]['options'],
  description?: string,
): BantSettingsConfig['criteria'][number] {
  return {
    id: randomUUID(),
    key,
    label,
    description,
    weight,
    sortOrder,
    isActive: true,
    options,
  };
}

function tier(
  value: string,
  label: string,
  minScore: number,
  maxScore: number,
  color: string,
  sortOrder: number,
): BantSettingsConfig['tiers'][number] {
  return {
    id: randomUUID(),
    value,
    label,
    minScore,
    maxScore,
    color,
    sortOrder,
  };
}

export function createDefaultBantSettingsConfig(): BantSettingsConfig {
  return {
    criteria: [
      criterion(
        'budget',
        'Budget',
        25,
        0,
        [
          option('Confirmed budget', 'confirmed', 100, 0),
          option('Budget allocated', 'allocated', 75, 1),
          option('Budget under review', 'review', 40, 2),
          option('No budget', 'none', 0, 3),
        ],
        'Does the prospect have budget for this purchase?',
      ),
      criterion(
        'authority',
        'Authority',
        25,
        1,
        [
          option('Decision maker', 'decision_maker', 100, 0),
          option('Influencer', 'influencer', 65, 1),
          option('Gatekeeper', 'gatekeeper', 30, 2),
          option('Unknown', 'unknown', 0, 3),
        ],
        'Can this contact approve or strongly influence the purchase?',
      ),
      criterion(
        'need',
        'Need',
        25,
        2,
        [
          option('Critical need', 'critical', 100, 0),
          option('Clear need', 'clear', 75, 1),
          option('Exploring', 'exploring', 40, 2),
          option('No need', 'none', 0, 3),
        ],
        'How strong is the business need for your solution?',
      ),
      criterion(
        'timeline',
        'Timeline',
        25,
        3,
        [
          option('Immediate (0–30 days)', 'immediate', 100, 0),
          option('Near term (1–3 months)', 'near_term', 75, 1),
          option('Long term (3+ months)', 'long_term', 35, 2),
          option('No timeline', 'none', 0, 3),
        ],
        'When does the prospect expect to make a decision?',
      ),
    ],
    tiers: [
      tier('hot', 'Hot', 70, 100, '#16a34a', 0),
      tier('warm', 'Warm', 40, 69, '#d97706', 1),
      tier('cold', 'Cold', 1, 39, '#2563eb', 2),
      tier('disqualified', 'Disqualified', 0, 0, '#6b7280', 3),
    ],
  };
}
