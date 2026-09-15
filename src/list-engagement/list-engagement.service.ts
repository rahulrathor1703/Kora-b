import { Injectable } from '@nestjs/common';
import type {
  AudienceListType,
  EmailCampaignEntity,
} from '../email-campaigns/entities/email-campaign.entity';
import { EmailCampaignRecipientsRepository } from '../email-campaigns/email-campaign-recipients.repository';
import { EmailCampaignsRepository } from '../email-campaigns/email-campaigns.repository';

import type {
  LinkedCampaignSummary,
  ListEmailStatus,
  ListEngagementStats,
} from './list-engagement.types';

interface RecipientEngagementRow {
  email: string;
  lastSentAt: Date | null;
  replyCategory: string | null;
  repliedAt: Date | null;
  status: string;
}

@Injectable()
export class ListEngagementService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
  ) {}

  async getStats(
    listType: AudienceListType,
    listId: string,
    organizationId: string,
    totalContacts: number,
  ): Promise<ListEngagementStats> {
    const campaigns = await this.emailCampaignsRepository.findByAudienceList(
      organizationId,
      listType,
      listId,
    );

    if (campaigns.length === 0) {
      return {
        totalContacts,
        eligible: totalContacts,
        sent: 0,
        replied: 0,
      };
    }

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const [sent, replied, uniqueEmailsSent] = await Promise.all([
      this.recipientsRepository.countSentByCampaignIds(campaignIds),
      this.recipientsRepository.countRepliedByCampaignIds(campaignIds),
      this.recipientsRepository.countDistinctSentEmailsByCampaignIds(
        campaignIds,
      ),
    ]);

    return {
      totalContacts,
      eligible: Math.max(0, totalContacts - uniqueEmailsSent),
      sent,
      replied,
    };
  }

  async getLinkedCampaigns(
    listType: AudienceListType,
    listId: string,
    organizationId: string,
  ): Promise<LinkedCampaignSummary[]> {
    const campaigns = await this.emailCampaignsRepository.findByAudienceList(
      organizationId,
      listType,
      listId,
    );

    return campaigns.map((campaign) => this.toLinkedCampaignSummary(campaign));
  }

  async getEmailStatusMap(
    listType: AudienceListType,
    listId: string,
    organizationId: string,
    emails: string[],
  ): Promise<Map<string, ListEmailStatus>> {
    const normalizedEmails = [
      ...new Set(emails.map((email) => email.trim().toLowerCase())),
    ];

    if (normalizedEmails.length === 0) {
      return new Map();
    }

    const campaigns = await this.emailCampaignsRepository.findByAudienceList(
      organizationId,
      listType,
      listId,
    );

    if (campaigns.length === 0) {
      return new Map(
        normalizedEmails.map((email) => [email, 'not_contacted' as const]),
      );
    }

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const rows =
      await this.recipientsRepository.findEngagementByCampaignIdsAndEmails(
        campaignIds,
        normalizedEmails,
      );

    const statusMap = new Map<string, ListEmailStatus>();

    for (const email of normalizedEmails) {
      statusMap.set(
        email,
        this.resolveEmailStatus(rows.filter((row) => row.email === email)),
      );
    }

    return statusMap;
  }

  private resolveEmailStatus(rows: RecipientEngagementRow[]): ListEmailStatus {
    if (rows.length === 0) {
      return 'not_contacted';
    }

    const sorted = [...rows].sort((a, b) => {
      const aTime = a.lastSentAt?.getTime() ?? 0;
      const bTime = b.lastSentAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    const latest = sorted[0];

    if (latest.replyCategory || latest.repliedAt) {
      return 'replied';
    }

    if (latest.status === 'failed') {
      return 'bounced';
    }

    if (latest.lastSentAt) {
      return 'sent';
    }

    return 'not_contacted';
  }

  private toLinkedCampaignSummary(
    campaign: EmailCampaignEntity,
  ): LinkedCampaignSummary {
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      audienceCount: campaign.audienceCount,
      createdAt: campaign.createdAt.toISOString(),
    };
  }
}
