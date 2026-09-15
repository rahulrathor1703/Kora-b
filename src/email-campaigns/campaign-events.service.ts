import { Injectable, NotFoundException } from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { EmailCampaignEventsRepository } from './email-campaign-events.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { CampaignEventsMapper } from './mappers/campaign-events.mapper';
import type { PaginatedCampaignEventsResponse } from './mappers/campaign-events.mapper';
import type { CampaignEventsQueryDto } from './dto/campaign-events-query.dto';

@Injectable()
export class CampaignEventsService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly eventsRepository: EmailCampaignEventsRepository,
    private readonly campaignEventsMapper: CampaignEventsMapper,
  ) {}

  async listCampaignEvents(
    campaignId: string,
    organizationId: string | null,
    query: CampaignEventsQueryDto,
  ): Promise<PaginatedCampaignEventsResponse> {
    await this.requireCampaign(campaignId, organizationId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const { items, total } = await this.eventsRepository.listByCampaign({
      campaignId,
      eventType: query.eventType,
      recipientId: query.recipientId,
      stepOrder: query.stepOrder,
      search: query.search,
      page,
      limit,
    });

    return {
      items: items.map((event) => this.campaignEventsMapper.toResponse(event)),
      total,
      page,
      limit,
    };
  }

  async listRecipientEvents(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
    page = 1,
    limit = 100,
  ): Promise<PaginatedCampaignEventsResponse> {
    await this.requireCampaign(campaignId, organizationId);

    const { items, total } = await this.eventsRepository.listByRecipient(
      campaignId,
      recipientId,
      page,
      limit,
    );

    return {
      items: items.map((event) => this.campaignEventsMapper.toResponse(event)),
      total,
      page,
      limit,
    };
  }

  async listDailyEvents(campaignId: string, organizationId: string | null) {
    await this.requireCampaign(campaignId, organizationId);

    const points =
      await this.eventsRepository.aggregateDailyByCampaign(campaignId);

    return { points };
  }

  private async requireCampaign(
    campaignId: string,
    organizationId: string | null,
  ) {
    const orgId = requireOrganizationId(organizationId);
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        campaignId,
        orgId,
      );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }
}
