import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationGoogleConnectionEntity } from '../entities/organization-google-connection.entity';

export interface OrganizationGoogleConnectionSummary {
  id: string;
  oauthAppId: string;
  email: string;
  connectedAt: Date;
  connectedByUserId: string | null;
  propertyCount: number;
}

@Injectable()
export class OrganizationGoogleConnectionRepository {
  constructor(
    @InjectRepository(OrganizationGoogleConnectionEntity)
    private readonly repository: Repository<OrganizationGoogleConnectionEntity>,
  ) {}

  findById(id: string): Promise<OrganizationGoogleConnectionEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<OrganizationGoogleConnectionEntity | null> {
    return this.repository.findOne({ where: { id, organizationId } });
  }

  findByOrganizationId(
    organizationId: string,
    oauthAppId?: string,
  ): Promise<OrganizationGoogleConnectionEntity[]> {
    return this.repository.find({
      where: oauthAppId ? { organizationId, oauthAppId } : { organizationId },
      order: { connectedAt: 'DESC' },
    });
  }

  findByOAuthAppIdAndEmail(
    oauthAppId: string,
    email: string,
  ): Promise<OrganizationGoogleConnectionEntity | null> {
    return this.repository.findOne({
      where: { oauthAppId, email: email.toLowerCase() },
    });
  }

  async findSummariesByOrganizationId(
    organizationId: string,
    oauthAppId?: string,
  ): Promise<OrganizationGoogleConnectionSummary[]> {
    const connections = await this.findByOrganizationId(
      organizationId,
      oauthAppId,
    );

    return Promise.all(
      connections.map(async (connection) => ({
        id: connection.id,
        oauthAppId: connection.oauthAppId,
        email: connection.email,
        connectedAt: connection.connectedAt,
        connectedByUserId: connection.connectedByUserId,
        propertyCount: await this.countPropertiesUsingConnection(connection.id),
      })),
    );
  }

  create(
    data: Partial<OrganizationGoogleConnectionEntity>,
  ): OrganizationGoogleConnectionEntity {
    return this.repository.create(data);
  }

  save(
    entity: OrganizationGoogleConnectionEntity,
  ): Promise<OrganizationGoogleConnectionEntity> {
    return this.repository.save(entity);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  countPropertiesUsingConnection(connectionId: string): Promise<number> {
    return this.repository.manager
      .createQueryBuilder()
      .from('website_properties', 'property')
      .where('property.google_connection_id = :connectionId', { connectionId })
      .getCount();
  }
}
