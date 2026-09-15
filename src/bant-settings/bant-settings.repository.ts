import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FieldStoredValue } from '../common/location/location-field.types';
import { ProspectEntity } from '../prospects/entities/prospect.entity';
import { OrganizationBantSettingsEntity } from './entities/organization-bant-settings.entity';
import type { BantSettingsConfig } from './types/bant-settings.types';

@Injectable()
export class BantSettingsRepository {
  constructor(
    @InjectRepository(OrganizationBantSettingsEntity)
    private readonly repository: Repository<OrganizationBantSettingsEntity>,
    @InjectRepository(ProspectEntity)
    private readonly prospectRepository: Repository<ProspectEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationBantSettingsEntity | null> {
    return this.repository.findOne({
      where: { organizationId },
    });
  }

  create(
    organizationId: string,
    config: BantSettingsConfig,
  ): OrganizationBantSettingsEntity {
    return this.repository.create({ organizationId, config });
  }

  save(
    entity: OrganizationBantSettingsEntity,
  ): Promise<OrganizationBantSettingsEntity> {
    return this.repository.save(entity);
  }

  findProspectById(
    prospectId: string,
    organizationId: string,
  ): Promise<ProspectEntity | null> {
    return this.prospectRepository.findOne({
      where: { id: prospectId, organizationId },
    });
  }

  saveProspectValues(
    prospectId: string,
    organizationId: string,
    values: Record<string, FieldStoredValue>,
  ): Promise<ProspectEntity | null> {
    return this.prospectRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ProspectEntity);
      const prospect = await repository.findOne({
        where: { id: prospectId, organizationId },
      });

      if (!prospect) {
        return null;
      }

      prospect.values = values;
      return repository.save(prospect);
    });
  }
}
