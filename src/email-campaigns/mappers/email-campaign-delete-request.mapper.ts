import { Injectable } from '@nestjs/common';
import { EmailCampaignDeleteRequestEntity } from '../entities/email-campaign-delete-request.entity';

export interface EmailCampaignDeleteRequestResponse {
  id: string;
  campaignId: string | null;
  campaignName: string;
  campaignStatus: string;
  reason: string;
  status: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByEmail: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EmailCampaignDeleteRequestMapper {
  toResponse(
    entity: EmailCampaignDeleteRequestEntity,
  ): EmailCampaignDeleteRequestResponse {
    return {
      id: entity.id,
      campaignId: entity.campaignId,
      campaignName: entity.campaignName || entity.campaign?.name || '',
      campaignStatus: entity.campaignStatus || entity.campaign?.status || '',
      reason: entity.reason,
      status: entity.status,
      requestedByUserId: entity.requestedByUserId,
      requestedByName: this.formatUserName(entity.requestedBy),
      requestedByEmail: entity.requestedBy?.email ?? '',
      reviewedByUserId: entity.reviewedByUserId,
      reviewedByName: entity.reviewedBy
        ? this.formatUserName(entity.reviewedBy)
        : null,
      reviewNote: entity.reviewNote,
      reviewedAt: entity.reviewedAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toResponseList(
    entities: EmailCampaignDeleteRequestEntity[],
  ): EmailCampaignDeleteRequestResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }

  private formatUserName(
    user?: { username: string | null; email: string } | null,
  ): string {
    if (!user) {
      return 'Unknown user';
    }

    if (user.username?.trim()) {
      return user.username.trim();
    }

    return user.email;
  }
}
