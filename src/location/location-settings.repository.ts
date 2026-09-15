import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationLocationSettingsEntity } from './entities/organization-location-settings.entity';

@Injectable()
export class LocationSettingsRepository {
  constructor(
    @InjectRepository(OrganizationLocationSettingsEntity)
    private readonly repository: Repository<OrganizationLocationSettingsEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationLocationSettingsEntity | null> {
    return this.repository.findOne({ where: { organizationId } });
  }

  save(
    entity: OrganizationLocationSettingsEntity,
  ): Promise<OrganizationLocationSettingsEntity> {
    return this.repository.save(entity);
  }

  create(organizationId: string): OrganizationLocationSettingsEntity {
    return this.repository.create({ organizationId, provider: 'geonames' });
  }
}
