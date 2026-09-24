import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationWebsiteSettingsEntity } from '../entities/organization-website-settings.entity';

@Injectable()
export class WebsiteSettingsRepository {
  constructor(
    @InjectRepository(OrganizationWebsiteSettingsEntity)
    private readonly repository: Repository<OrganizationWebsiteSettingsEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationWebsiteSettingsEntity | null> {
    return this.repository.findOne({ where: { organizationId } });
  }

  create(organizationId: string): OrganizationWebsiteSettingsEntity {
    return this.repository.create({ organizationId });
  }

  save(
    entity: OrganizationWebsiteSettingsEntity,
  ): Promise<OrganizationWebsiteSettingsEntity> {
    return this.repository.save(entity);
  }
}
