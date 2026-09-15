import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationGoogleOAuthAppEntity } from '../entities/organization-google-oauth-app.entity';

export interface GoogleOAuthAppSummary {
  id: string;
  label: string;
  clientId: string;
  redirectBaseUrl: string;
  connectionCount: number;
  createdAt: Date;
}

@Injectable()
export class OrganizationGoogleOAuthAppRepository {
  constructor(
    @InjectRepository(OrganizationGoogleOAuthAppEntity)
    private readonly repository: Repository<OrganizationGoogleOAuthAppEntity>,
  ) {}

  findById(id: string): Promise<OrganizationGoogleOAuthAppEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<OrganizationGoogleOAuthAppEntity | null> {
    return this.repository.findOne({ where: { id, organizationId } });
  }

  findByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationGoogleOAuthAppEntity[]> {
    return this.repository.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
  }

  async findSummariesByOrganizationId(
    organizationId: string,
  ): Promise<GoogleOAuthAppSummary[]> {
    const rows = await this.repository
      .createQueryBuilder('app')
      .leftJoin(
        'organization_google_connections',
        'connection',
        'connection.oauth_app_id = app.id',
      )
      .select('app.id', 'id')
      .addSelect('app.label', 'label')
      .addSelect('app.googleOAuthClientId', 'clientId')
      .addSelect('app.googleOAuthCallbackBaseUrl', 'redirectBaseUrl')
      .addSelect('app.createdAt', 'createdAt')
      .addSelect('COUNT(connection.id)', 'connectionCount')
      .where('app.organizationId = :organizationId', { organizationId })
      .groupBy('app.id')
      .addGroupBy('app.label')
      .addGroupBy('app.googleOAuthClientId')
      .addGroupBy('app.googleOAuthCallbackBaseUrl')
      .addGroupBy('app.createdAt')
      .orderBy('app.createdAt', 'ASC')
      .getRawMany<{
        id: string;
        label: string;
        clientId: string;
        redirectBaseUrl: string;
        createdAt: Date;
        connectionCount: string;
      }>();

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      clientId: row.clientId,
      redirectBaseUrl: row.redirectBaseUrl,
      createdAt: row.createdAt,
      connectionCount: Number(row.connectionCount),
    }));
  }

  create(
    data: Partial<OrganizationGoogleOAuthAppEntity>,
  ): OrganizationGoogleOAuthAppEntity {
    return this.repository.create(data);
  }

  save(
    entity: OrganizationGoogleOAuthAppEntity,
  ): Promise<OrganizationGoogleOAuthAppEntity> {
    return this.repository.save(entity);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  countConnectionsUsingApp(oauthAppId: string): Promise<number> {
    return this.repository.manager
      .createQueryBuilder()
      .from('organization_google_connections', 'connection')
      .where('connection.oauth_app_id = :oauthAppId', { oauthAppId })
      .getCount();
  }

  hasAnyForOrganization(organizationId: string): Promise<boolean> {
    return this.repository
      .createQueryBuilder('app')
      .where('app.organizationId = :organizationId', { organizationId })
      .getExists();
  }
}
