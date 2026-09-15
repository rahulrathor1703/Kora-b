import { Injectable } from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { CampaignListMetricsRepository } from './campaign-list-metrics.repository';
import {
  CampaignListMetricsMapper,
  type EmailCampaignListMetricsResponse,
} from './mappers/campaign-list-metrics.mapper';

@Injectable()
export class CampaignListMetricsService {
  constructor(
    private readonly campaignListMetricsRepository: CampaignListMetricsRepository,
    private readonly campaignListMetricsMapper: CampaignListMetricsMapper,
  ) {}

  async findAllByOrganizationId(
    organizationId: string | null,
  ): Promise<EmailCampaignListMetricsResponse[]> {
    const rows = await this.campaignListMetricsRepository.findByOrganizationId(
      requireOrganizationId(organizationId),
    );

    return rows.map((row) => this.campaignListMetricsMapper.toResponse(row));
  }
}
