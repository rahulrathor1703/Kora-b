import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationNotionConnectionEntity } from './entities/organization-notion-connection.entity';

@Injectable()
export class NotionIntegrationsRepository {
  constructor(
    @InjectRepository(OrganizationNotionConnectionEntity)
    private readonly repository: Repository<OrganizationNotionConnectionEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationNotionConnectionEntity | null> {
    return this.repository.findOne({ where: { organizationId } });
  }

  create(organizationId: string): OrganizationNotionConnectionEntity {
    return this.repository.create({ organizationId });
  }

  save(
    entity: OrganizationNotionConnectionEntity,
  ): Promise<OrganizationNotionConnectionEntity> {
    return this.repository.save(entity);
  }

  async deleteByOrganizationId(organizationId: string): Promise<void> {
    await this.repository.delete({ organizationId });
  }
}
