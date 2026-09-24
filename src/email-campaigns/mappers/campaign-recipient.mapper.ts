import { Injectable } from '@nestjs/common';
import type { EmailCampaignMessageEntity } from '../entities/email-campaign-message.entity';
import type { EmailCampaignRecipientEntity } from '../entities/email-campaign-recipient.entity';

export type CampaignRecipientEngagementStatus =
  'pending' | 'sent' | 'opened' | 'clicked' | 'bounced' | 'replied';

export interface CampaignRecipientMessageResponse {
  stepOrder: number;
  deliveryStatus: string;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  bouncedAt: string | null;
  bounceReason: string | null;
}

export interface CampaignRecipientEngagementResponse {
  status: CampaignRecipientEngagementStatus;
  latestDeliveryStatus: 'pending' | 'sent' | 'bounced' | 'failed';
  opened: boolean;
  openedAt: string | null;
  openCount: number;
  clicked: boolean;
  clickedAt: string | null;
  clickCount: number;
  bounced: boolean;
  bouncedAt: string | null;
  bounceReason: string | null;
}

export interface CampaignRecipientResponse {
  id: string;
  email: string;
  status: string;
  currentStepOrder: number;
  lastSentAt: string | null;
  replyCategory: string | null;
  repliedAt: string | null;
  contactDisposition: string;
  pausedUntil: string | null;
  allowSendDespiteReply: boolean;
  globallyExcluded: boolean;
  engagement: CampaignRecipientEngagementResponse;
  messages: CampaignRecipientMessageResponse[];
}

export interface PaginatedCampaignRecipientsResponse {
  items: CampaignRecipientResponse[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class CampaignRecipientMapper {
  toResponse(
    recipient: EmailCampaignRecipientEntity,
    messages: EmailCampaignMessageEntity[],
    globallyExcluded = false,
  ): CampaignRecipientResponse {
    const sortedMessages = [...messages].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    const engagement = this.buildEngagement(recipient, sortedMessages);

    return {
      id: recipient.id,
      email: recipient.email,
      status: recipient.status,
      currentStepOrder: recipient.currentStepOrder,
      lastSentAt: recipient.lastSentAt?.toISOString() ?? null,
      replyCategory: recipient.replyCategory,
      repliedAt: recipient.repliedAt?.toISOString() ?? null,
      contactDisposition: recipient.contactDisposition,
      pausedUntil: recipient.pausedUntil?.toISOString() ?? null,
      allowSendDespiteReply: recipient.allowSendDespiteReply,
      globallyExcluded,
      engagement,
      messages: sortedMessages.map((message) =>
        this.toMessageResponse(message),
      ),
    };
  }

  private toMessageResponse(
    message: EmailCampaignMessageEntity,
  ): CampaignRecipientMessageResponse {
    return {
      stepOrder: message.stepOrder,
      deliveryStatus: message.deliveryStatus,
      sentAt: message.sentAt?.toISOString() ?? null,
      openedAt: message.openedAt?.toISOString() ?? null,
      openCount: message.openCount,
      clickedAt: message.clickedAt?.toISOString() ?? null,
      clickCount: message.clickCount,
      bouncedAt: message.bouncedAt?.toISOString() ?? null,
      bounceReason: message.bounceReason,
    };
  }

  private buildEngagement(
    recipient: EmailCampaignRecipientEntity,
    messages: EmailCampaignMessageEntity[],
  ): CampaignRecipientEngagementResponse {
    const confirmedBouncedMessage = messages.find(
      (message) =>
        (message.deliveryStatus === 'bounced' ||
          message.deliveryStatus === 'failed') &&
        message.openCount === 0 &&
        message.clickCount === 0,
    );
    const latestMessage =
      messages.length > 0 ? messages[messages.length - 1] : null;

    const totalOpenCount = messages.reduce(
      (sum, message) => sum + message.openCount,
      0,
    );
    const totalClickCount = messages.reduce(
      (sum, message) => sum + message.clickCount,
      0,
    );
    const firstOpenedAt =
      messages.find((message) => message.openedAt)?.openedAt ?? null;
    const firstClickedAt =
      messages.find((message) => message.clickedAt)?.clickedAt ?? null;

    const status = this.resolveEngagementStatus(
      recipient,
      messages,
      confirmedBouncedMessage,
      totalOpenCount,
      totalClickCount,
    );

    return {
      status,
      latestDeliveryStatus: confirmedBouncedMessage
        ? confirmedBouncedMessage.deliveryStatus === 'failed'
          ? 'failed'
          : 'bounced'
        : latestMessage
          ? latestMessage.deliveryStatus === 'sent' ||
            latestMessage.openCount > 0 ||
            latestMessage.clickCount > 0
            ? 'sent'
            : latestMessage.deliveryStatus
          : 'pending',
      opened: totalOpenCount > 0,
      openedAt: firstOpenedAt?.toISOString() ?? null,
      openCount: totalOpenCount,
      clicked: totalClickCount > 0,
      clickedAt: firstClickedAt?.toISOString() ?? null,
      clickCount: totalClickCount,
      bounced: Boolean(confirmedBouncedMessage),
      bouncedAt: confirmedBouncedMessage?.bouncedAt?.toISOString() ?? null,
      bounceReason: confirmedBouncedMessage?.bounceReason ?? null,
    };
  }

  resolveEngagementStatus(
    recipient: EmailCampaignRecipientEntity,
    messages: EmailCampaignMessageEntity[],
    bouncedMessage?: EmailCampaignMessageEntity,
    totalOpenCount = messages.reduce((sum, m) => sum + m.openCount, 0),
    totalClickCount = messages.reduce((sum, m) => sum + m.clickCount, 0),
  ): CampaignRecipientEngagementStatus {
    if (recipient.replyCategory || recipient.repliedAt) {
      return 'replied';
    }

    if (totalClickCount > 0) {
      return 'clicked';
    }

    if (totalOpenCount > 0) {
      return 'opened';
    }

    const bounced =
      bouncedMessage ??
      messages.find(
        (message) =>
          (message.deliveryStatus === 'bounced' ||
            message.deliveryStatus === 'failed') &&
          message.openCount === 0 &&
          message.clickCount === 0,
      );

    if (bounced) {
      return 'bounced';
    }

    if (messages.some((message) => message.deliveryStatus === 'sent')) {
      return 'sent';
    }

    return 'pending';
  }
}
