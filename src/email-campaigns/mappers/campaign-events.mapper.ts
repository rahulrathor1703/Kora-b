import { Injectable } from '@nestjs/common';
import type { EmailCampaignEventEntity } from '../entities/email-campaign-event.entity';

export interface CampaignEventResponse {
  id: string;
  eventType: string;
  occurredAt: string;
  recipientId: string;
  recipientEmail: string;
  messageId: string | null;
  stepOrder: number | null;
  metadata: Record<string, unknown>;
}

export interface PaginatedCampaignEventsResponse {
  items: CampaignEventResponse[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CampaignEventsMapper {
  toResponse(event: EmailCampaignEventEntity): CampaignEventResponse {
    return {
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      recipientId: event.recipientId,
      recipientEmail: event.recipient?.email ?? '',
      messageId: event.messageId,
      stepOrder: event.message?.stepOrder ?? event.metadata.stepOrder ?? null,
      metadata: event.metadata,
    };
  }
}
