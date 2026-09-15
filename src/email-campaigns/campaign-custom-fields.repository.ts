import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmailCampaignCustomFieldDefinitionEntity } from './entities/email-campaign-custom-field-definition.entity';
import { EmailCampaignCustomFieldOptionEntity } from './entities/email-campaign-custom-field-option.entity';

@Injectable()
export class CampaignCustomFieldsRepository {
  constructor(
    @InjectRepository(EmailCampaignCustomFieldDefinitionEntity)
    private readonly definitionRepository: Repository<EmailCampaignCustomFieldDefinitionEntity>,
    @InjectRepository(EmailCampaignCustomFieldOptionEntity)
    private readonly optionRepository: Repository<EmailCampaignCustomFieldOptionEntity>,
  ) {}

  async findActiveDefinitionsByOrganizationId(
    organizationId: string,
  ): Promise<EmailCampaignCustomFieldDefinitionEntity[]> {
    const definitions = await this.definitionRepository.find({
      where: { organizationId, isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });

    return this.attachOptions(definitions);
  }

  async findAllDefinitionsByOrganizationId(
    organizationId: string,
  ): Promise<EmailCampaignCustomFieldDefinitionEntity[]> {
    const definitions = await this.definitionRepository.find({
      where: { organizationId },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });

    return this.attachOptions(definitions);
  }

  countActiveDefinitionsByOrganizationId(
    organizationId: string,
  ): Promise<number> {
    return this.definitionRepository.count({
      where: { organizationId, isActive: true },
    });
  }

  async findDefinitionByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<EmailCampaignCustomFieldDefinitionEntity | null> {
    const definition = await this.definitionRepository.findOne({
      where: { id, organizationId },
    });

    if (!definition) {
      return null;
    }

    const [withOptions] = await this.attachOptions([definition]);
    return withOptions;
  }

  findDefinitionByOrganizationAndKey(
    organizationId: string,
    key: string,
  ): Promise<EmailCampaignCustomFieldDefinitionEntity | null> {
    return this.definitionRepository.findOne({
      where: { organizationId, key },
    });
  }

  createDefinition(
    data: Partial<EmailCampaignCustomFieldDefinitionEntity>,
  ): EmailCampaignCustomFieldDefinitionEntity {
    return this.definitionRepository.create(data);
  }

  saveDefinition(
    entity: EmailCampaignCustomFieldDefinitionEntity,
  ): Promise<EmailCampaignCustomFieldDefinitionEntity> {
    return this.definitionRepository.save(entity);
  }

  countOptionsByFieldDefinitionId(fieldDefinitionId: string): Promise<number> {
    return this.optionRepository.count({
      where: { fieldDefinitionId, isActive: true },
    });
  }

  findOptionByIdAndFieldDefinitionId(
    id: string,
    fieldDefinitionId: string,
  ): Promise<EmailCampaignCustomFieldOptionEntity | null> {
    return this.optionRepository.findOne({
      where: { id, fieldDefinitionId },
    });
  }

  findOptionByFieldDefinitionAndValue(
    fieldDefinitionId: string,
    value: string,
  ): Promise<EmailCampaignCustomFieldOptionEntity | null> {
    return this.optionRepository.findOne({
      where: { fieldDefinitionId, value },
    });
  }

  createOption(
    data: Partial<EmailCampaignCustomFieldOptionEntity>,
  ): EmailCampaignCustomFieldOptionEntity {
    return this.optionRepository.create(data);
  }

  saveOption(
    entity: EmailCampaignCustomFieldOptionEntity,
  ): Promise<EmailCampaignCustomFieldOptionEntity> {
    return this.optionRepository.save(entity);
  }

  private async attachOptions(
    definitions: EmailCampaignCustomFieldDefinitionEntity[],
  ): Promise<EmailCampaignCustomFieldDefinitionEntity[]> {
    if (definitions.length === 0) {
      return definitions;
    }

    const definitionIds = definitions.map((definition) => definition.id);
    const options = await this.optionRepository.find({
      where: { fieldDefinitionId: In(definitionIds) },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });

    const optionsByDefinitionId = new Map<
      string,
      EmailCampaignCustomFieldOptionEntity[]
    >();

    for (const option of options) {
      const existing =
        optionsByDefinitionId.get(option.fieldDefinitionId) ?? [];
      existing.push(option);
      optionsByDefinitionId.set(option.fieldDefinitionId, existing);
    }

    return definitions.map((definition) => {
      definition.options = optionsByDefinitionId.get(definition.id) ?? [];
      return definition;
    });
  }
}
