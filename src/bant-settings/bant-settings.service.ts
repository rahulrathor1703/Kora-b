import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { FieldStoredValue } from '../common/location/location-field.types';
import { BantSettingsRepository } from './bant-settings.repository';
import type { UpdateBantSettingsDto } from './dto/bant-settings.dto';
import { createDefaultBantSettingsConfig } from './types/default-bant-settings';
import type {
  BantResponses,
  BantSettingsConfig,
  BantSettingsResponse,
  ProspectBantResponse,
} from './types/bant-settings.types';
import { BANT_RESPONSES_VALUE_KEY } from './types/bant-settings.types';
import {
  computeWeightedBantScore,
  resolveBantTier,
} from './utils/bant-scoring.utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractBantResponses(
  values: Record<string, FieldStoredValue>,
): BantResponses {
  const raw = values[BANT_RESPONSES_VALUE_KEY];
  if (!isRecord(raw)) {
    return {};
  }

  const responses: BantResponses = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) {
      responses[key] = value.trim();
    }
  }

  return responses;
}

@Injectable()
export class BantSettingsService {
  constructor(
    private readonly bantSettingsRepository: BantSettingsRepository,
  ) {}

  async getSettings(
    organizationId: string | null,
  ): Promise<BantSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const entity = await this.requireOrCreateSettings(resolvedOrganizationId);

    return {
      config: entity.config,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  async updateSettings(
    dto: UpdateBantSettingsDto,
    organizationId: string | null,
  ): Promise<BantSettingsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const config = this.normalizeConfig(dto);
    this.validateConfig(config);

    const existing = await this.bantSettingsRepository.findByOrganizationId(
      resolvedOrganizationId,
    );

    const entity =
      existing ??
      this.bantSettingsRepository.create(resolvedOrganizationId, config);
    entity.config = config;

    const saved = await this.bantSettingsRepository.save(entity);

    return {
      config: saved.config,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async getProspectBant(
    prospectId: string,
    organizationId: string | null,
  ): Promise<ProspectBantResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const entity = await this.requireOrCreateSettings(resolvedOrganizationId);
    const prospect = await this.requireProspect(
      prospectId,
      resolvedOrganizationId,
    );
    const responses = extractBantResponses(prospect.values);
    const computedScore = computeWeightedBantScore(entity.config, responses);
    const computedTier = resolveBantTier(computedScore, entity.config.tiers);

    return {
      config: entity.config,
      responses,
      computedScore,
      computedTier,
    };
  }

  async updateProspectBant(
    prospectId: string,
    responses: BantResponses,
    organizationId: string | null,
  ): Promise<ProspectBantResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const entity = await this.requireOrCreateSettings(resolvedOrganizationId);
    const prospect = await this.requireProspect(
      prospectId,
      resolvedOrganizationId,
    );
    const sanitizedResponses = this.validateResponses(entity.config, responses);
    const computedScore = computeWeightedBantScore(
      entity.config,
      sanitizedResponses,
    );
    const computedTier = resolveBantTier(computedScore, entity.config.tiers);

    const saved = await this.bantSettingsRepository.saveProspectValues(
      prospect.id,
      resolvedOrganizationId,
      {
        ...prospect.values,
        [BANT_RESPONSES_VALUE_KEY]: sanitizedResponses,
        score: computedScore,
        bantTier: computedTier,
      },
    );

    if (!saved) {
      throw new NotFoundException('Prospect not found');
    }

    return {
      config: entity.config,
      responses: sanitizedResponses,
      computedScore,
      computedTier,
    };
  }

  private async requireOrCreateSettings(organizationId: string) {
    const existing =
      await this.bantSettingsRepository.findByOrganizationId(organizationId);

    if (existing) {
      return existing;
    }

    const entity = this.bantSettingsRepository.create(
      organizationId,
      createDefaultBantSettingsConfig(),
    );

    return this.bantSettingsRepository.save(entity);
  }

  private async requireProspect(prospectId: string, organizationId: string) {
    const prospect = await this.bantSettingsRepository.findProspectById(
      prospectId,
      organizationId,
    );

    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    return prospect;
  }

  private normalizeConfig(dto: UpdateBantSettingsDto): BantSettingsConfig {
    return {
      criteria: dto.criteria.map((criterion) => ({
        ...criterion,
        key: criterion.key.trim(),
        label: criterion.label.trim(),
        description: criterion.description?.trim() || undefined,
        options: criterion.options.map((option) => ({
          ...option,
          label: option.label.trim(),
          value: option.value.trim(),
        })),
      })),
      tiers: dto.tiers.map((tier) => ({
        ...tier,
        value: tier.value.trim(),
        label: tier.label.trim(),
        color: tier.color?.trim() || undefined,
      })),
    };
  }

  private validateConfig(config: BantSettingsConfig): void {
    const criterionKeys = new Set<string>();

    for (const criterion of config.criteria) {
      if (criterionKeys.has(criterion.key)) {
        throw new BadRequestException(
          `Duplicate criterion key "${criterion.key}"`,
        );
      }
      criterionKeys.add(criterion.key);

      const optionValues = new Set<string>();
      for (const option of criterion.options) {
        if (optionValues.has(option.value)) {
          throw new BadRequestException(
            `Duplicate option value "${option.value}" in criterion "${criterion.label}"`,
          );
        }
        optionValues.add(option.value);
      }
    }

    const sortedTiers = [...config.tiers].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    for (const tier of sortedTiers) {
      if (tier.minScore > tier.maxScore) {
        throw new BadRequestException(
          `Tier "${tier.label}" has minScore greater than maxScore`,
        );
      }
    }

    for (let index = 0; index < sortedTiers.length; index += 1) {
      for (let inner = index + 1; inner < sortedTiers.length; inner += 1) {
        const left = sortedTiers[index];
        const right = sortedTiers[inner];
        const overlaps =
          left.minScore <= right.maxScore && right.minScore <= left.maxScore;

        if (overlaps) {
          throw new BadRequestException(
            `Tier ranges overlap between "${left.label}" and "${right.label}"`,
          );
        }
      }
    }

    const coveredScores = new Set<number>();
    for (const tier of sortedTiers) {
      for (let score = tier.minScore; score <= tier.maxScore; score += 1) {
        coveredScores.add(score);
      }
    }

    for (let score = 0; score <= 100; score += 1) {
      if (!coveredScores.has(score)) {
        throw new BadRequestException(
          'Tier thresholds must cover every score from 0 to 100 without gaps',
        );
      }
    }
  }

  private validateResponses(
    config: BantSettingsConfig,
    responses: BantResponses,
  ): BantResponses {
    const activeCriteria = config.criteria.filter(
      (criterion) => criterion.isActive,
    );
    const sanitized: BantResponses = {};

    for (const criterion of activeCriteria) {
      const rawValue = responses[criterion.key];
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        continue;
      }

      const value = String(rawValue).trim();
      const matchingOption = criterion.options.find(
        (option) =>
          option.isActive && (option.value === value || option.id === value),
      );

      if (!matchingOption) {
        throw new BadRequestException(
          `Invalid response for criterion "${criterion.label}"`,
        );
      }

      sanitized[criterion.key] = matchingOption.value;
    }

    for (const key of Object.keys(responses)) {
      if (!activeCriteria.some((criterion) => criterion.key === key)) {
        throw new BadRequestException(`Unknown BANT criterion "${key}"`);
      }
    }

    return sanitized;
  }
}
