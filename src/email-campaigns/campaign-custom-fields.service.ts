import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { CampaignCustomFieldsRepository } from './campaign-custom-fields.repository';
import type {
  CreateCampaignCustomFieldDefinitionDto,
  CreateCampaignCustomFieldOptionDto,
  UpdateCampaignCustomFieldDefinitionDto,
} from './dto/campaign-custom-field.dto';
import type { EmailCampaignCustomFieldDefinitionEntity } from './entities/email-campaign-custom-field-definition.entity';
import {
  CampaignCustomFieldMapper,
  type CampaignCustomFieldDefinitionResponse,
  type CampaignCustomFieldOptionResponse,
} from './mappers/campaign-custom-field.mapper';

const MAX_DEFINITIONS = 20;
const MAX_OPTIONS_PER_FIELD = 50;
const MAX_TEXT_VALUE_LENGTH = 500;
const MAX_VALUE_LENGTH = 64;

function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_VALUE_LENGTH);
}

@Injectable()
export class CampaignCustomFieldsService {
  constructor(
    private readonly campaignCustomFieldsRepository: CampaignCustomFieldsRepository,
    private readonly campaignCustomFieldMapper: CampaignCustomFieldMapper,
  ) {}

  async findAll(
    organizationId: string | null,
  ): Promise<CampaignCustomFieldDefinitionResponse[]> {
    const definitions =
      await this.campaignCustomFieldsRepository.findActiveDefinitionsByOrganizationId(
        requireOrganizationId(organizationId),
      );

    return definitions.map((definition) =>
      this.campaignCustomFieldMapper.toDefinitionResponse(definition),
    );
  }

  async createDefinition(
    dto: CreateCampaignCustomFieldDefinitionDto,
    organizationId: string | null,
  ): Promise<CampaignCustomFieldDefinitionResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const label = dto.label.trim();

    const activeCount =
      await this.campaignCustomFieldsRepository.countActiveDefinitionsByOrganizationId(
        resolvedOrganizationId,
      );

    if (activeCount >= MAX_DEFINITIONS) {
      throw new BadRequestException(
        `Cannot create more than ${MAX_DEFINITIONS} custom fields`,
      );
    }

    const key = await this.resolveUniqueKey(resolvedOrganizationId, label);

    const definition = this.campaignCustomFieldsRepository.createDefinition({
      organizationId: resolvedOrganizationId,
      label,
      key,
      type: dto.type,
      isActive: true,
      sortOrder: activeCount,
    });

    const saved =
      await this.campaignCustomFieldsRepository.saveDefinition(definition);
    saved.options = [];

    return this.campaignCustomFieldMapper.toDefinitionResponse(saved);
  }

  async updateDefinition(
    id: string,
    dto: UpdateCampaignCustomFieldDefinitionDto,
    organizationId: string | null,
  ): Promise<CampaignCustomFieldDefinitionResponse> {
    const definition = await this.requireDefinition(id, organizationId);

    if (dto.label !== undefined) {
      definition.label = dto.label.trim();
    }

    if (dto.type !== undefined) {
      definition.type = dto.type;
    }

    if (dto.isActive !== undefined) {
      definition.isActive = dto.isActive;
    }

    const saved =
      await this.campaignCustomFieldsRepository.saveDefinition(definition);

    return this.campaignCustomFieldMapper.toDefinitionResponse(saved);
  }

  async createOption(
    fieldDefinitionId: string,
    dto: CreateCampaignCustomFieldOptionDto,
    organizationId: string | null,
  ): Promise<CampaignCustomFieldOptionResponse> {
    const definition = await this.requireDefinition(
      fieldDefinitionId,
      organizationId,
    );

    if (definition.type !== 'select') {
      throw new BadRequestException(
        'Options can only be added to select-type custom fields',
      );
    }

    const optionCount =
      await this.campaignCustomFieldsRepository.countOptionsByFieldDefinitionId(
        definition.id,
      );

    if (optionCount >= MAX_OPTIONS_PER_FIELD) {
      throw new BadRequestException(
        `Cannot create more than ${MAX_OPTIONS_PER_FIELD} options for this field`,
      );
    }

    const label = dto.label.trim();
    const value = this.resolveValue(label, dto.value);

    const existing =
      await this.campaignCustomFieldsRepository.findOptionByFieldDefinitionAndValue(
        definition.id,
        value,
      );

    if (existing) {
      throw new ConflictException(
        'An option with this value already exists for this field',
      );
    }

    const option = this.campaignCustomFieldsRepository.createOption({
      fieldDefinitionId: definition.id,
      label,
      value,
      isActive: true,
      sortOrder: optionCount,
    });

    const saved = await this.campaignCustomFieldsRepository.saveOption(option);
    return this.campaignCustomFieldMapper.toOptionResponse(saved);
  }

  async validateAndNormalizeCustomFieldValues(
    customFieldValues: Record<string, string> | undefined,
    organizationId: string,
  ): Promise<Record<string, string>> {
    if (!customFieldValues || Object.keys(customFieldValues).length === 0) {
      return {};
    }

    const definitions =
      await this.campaignCustomFieldsRepository.findActiveDefinitionsByOrganizationId(
        organizationId,
      );
    const definitionById = new Map(definitions.map((def) => [def.id, def]));
    const normalized: Record<string, string> = {};

    for (const [fieldId, rawValue] of Object.entries(customFieldValues)) {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        continue;
      }

      const definition = definitionById.get(fieldId);
      if (!definition) {
        throw new BadRequestException(
          `Unknown or inactive custom field: ${fieldId}`,
        );
      }

      if (definition.type === 'select') {
        const option = (definition.options ?? []).find(
          (item) => item.id === trimmed && item.isActive,
        );

        if (!option) {
          throw new BadRequestException(
            `Invalid option for custom field "${definition.label}"`,
          );
        }

        normalized[fieldId] = option.id;
        continue;
      }

      if (trimmed.length > MAX_TEXT_VALUE_LENGTH) {
        throw new BadRequestException(
          `Custom field "${definition.label}" exceeds ${MAX_TEXT_VALUE_LENGTH} characters`,
        );
      }

      normalized[fieldId] = trimmed;
    }

    return normalized;
  }

  private async requireDefinition(
    id: string,
    organizationId: string | null,
  ): Promise<EmailCampaignCustomFieldDefinitionEntity> {
    const definition =
      await this.campaignCustomFieldsRepository.findDefinitionByIdAndOrganizationId(
        id,
        requireOrganizationId(organizationId),
      );

    if (!definition) {
      throw new NotFoundException('Campaign custom field not found');
    }

    return definition;
  }

  private async resolveUniqueKey(
    organizationId: string,
    label: string,
  ): Promise<string> {
    const baseKey = slugifyLabel(label);

    if (!baseKey) {
      throw new BadRequestException(
        'Unable to generate a key slug from the label',
      );
    }

    let candidate = baseKey;
    let suffix = 2;

    while (
      await this.campaignCustomFieldsRepository.findDefinitionByOrganizationAndKey(
        organizationId,
        candidate,
      )
    ) {
      const suffixText = `-${suffix}`;
      candidate = `${baseKey.slice(0, MAX_VALUE_LENGTH - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    return candidate;
  }

  private resolveValue(label: string, value?: string): string {
    const trimmed = value?.trim() ?? '';
    if (trimmed) {
      return trimmed;
    }

    const slug = slugifyLabel(label);
    if (!slug) {
      throw new BadRequestException(
        'Unable to generate a value slug from the label',
      );
    }

    return slug;
  }
}
