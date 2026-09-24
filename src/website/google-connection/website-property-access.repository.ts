import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebsitePropertyEntity } from '../../on-page-seo/entities/website-property.entity';

@Injectable()
export class WebsitePropertyAccessRepository {
  constructor(
    @InjectRepository(WebsitePropertyEntity)
    private readonly repository: Repository<WebsitePropertyEntity>,
  ) {}

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<WebsitePropertyEntity | null> {
    return this.repository.findOne({ where: { id, organizationId } });
  }

  async requireByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<WebsitePropertyEntity> {
    const property = await this.findByIdAndOrganizationId(id, organizationId);

    if (!property) {
      throw new NotFoundException('Website property not found');
    }

    return property;
  }

  findOrganizationIdByPropertyId(
    websitePropertyId: string,
  ): Promise<string | null> {
    return this.repository
      .findOne({
        where: { id: websitePropertyId },
        select: { organizationId: true },
      })
      .then((property) => property?.organizationId ?? null);
  }

  async setGoogleConnectionId(
    websitePropertyId: string,
    organizationId: string,
    googleConnectionId: string | null,
  ): Promise<WebsitePropertyEntity> {
    const property = await this.requireByIdAndOrganizationId(
      websitePropertyId,
      organizationId,
    );

    property.googleConnectionId = googleConnectionId;
    return this.repository.save(property);
  }

  findByGoogleConnectionId(
    googleConnectionId: string,
  ): Promise<WebsitePropertyEntity[]> {
    return this.repository.find({ where: { googleConnectionId } });
  }
}
