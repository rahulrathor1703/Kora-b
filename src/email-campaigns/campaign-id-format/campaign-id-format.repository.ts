import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationCampaignIdSettingsEntity } from './entities/organization-campaign-id-settings.entity';

@Injectable()
export class CampaignIdFormatRepository {
  constructor(
    @InjectRepository(OrganizationCampaignIdSettingsEntity)
    private readonly settingsRepository: Repository<OrganizationCampaignIdSettingsEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationCampaignIdSettingsEntity | null> {
    return this.settingsRepository.findOne({ where: { organizationId } });
  }

  create(
    organizationId: string,
    format: string,
  ): OrganizationCampaignIdSettingsEntity {
    return this.settingsRepository.create({ organizationId, format });
  }

  save(
    entity: OrganizationCampaignIdSettingsEntity,
  ): Promise<OrganizationCampaignIdSettingsEntity> {
    return this.settingsRepository.save(entity);
  }
}
