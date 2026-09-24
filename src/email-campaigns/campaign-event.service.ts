import { Injectable } from '@nestjs/common';
import { EmailCampaignEventsRepository } from './email-campaign-events.repository';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailExcludedRepository } from './email-excluded.repository';
import type { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';
import type { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';

@Injectable()
export class CampaignEventService {
  constructor(
    private readonly eventsRepository: EmailCampaignEventsRepository,
    private readonly messagesRepository: EmailCampaignMessagesRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly excludedRepository: EmailExcludedRepository,
  ) {}

  async recordSent(
    message: EmailCampaignMessageEntity,
    providerMessageId?: string | null,
    occurredAt = new Date(),
  ): Promise<void> {
    message.sentAt = occurredAt;
    message.providerMessageId = providerMessageId ?? message.providerMessageId;
    message.deliveryStatus = 'sent';
    await this.messagesRepository.save(message);

    await this.eventsRepository.insert({
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      messageId: message.id,
      eventType: 'sent',
      occurredAt,
      metadata: {
        stepOrder: message.stepOrder,
        providerMessageId: providerMessageId ?? null,
      },
    });
  }

  async recordSendFailed(
    message: EmailCampaignMessageEntity,
    reason: string,
    occurredAt = new Date(),
  ): Promise<void> {
    message.deliveryStatus = 'failed';
    message.bouncedAt = occurredAt;
    message.bounceReason = reason;
    await this.messagesRepository.save(message);

    await this.eventsRepository.insert({
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      messageId: message.id,
      eventType: 'send_failed',
      occurredAt,
      metadata: {
        reason,
        source: 'smtp',
        stepOrder: message.stepOrder,
      },
    });
  }

  async recordOpen(
    message: EmailCampaignMessageEntity,
    occurredAt = new Date(),
    options?: {
      metadata?: Record<string, unknown>;
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<void> {
    const isUnique = await this.isUniqueOpen(
      message.id,
      options?.userAgent,
      options?.ipAddress,
      occurredAt,
    );

    if (isUnique) {
      message.openCount += 1;

      if (!message.openedAt) {
        message.openedAt = occurredAt;
      }

      await this.messagesRepository.save(message);
    }

    await this.eventsRepository.insert({
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      messageId: message.id,
      eventType: 'open',
      occurredAt,
      metadata: {
        stepOrder: message.stepOrder,
        isUnique,
        correlationMethod:
          options?.metadata?.source === 'inferred_from_reply'
            ? undefined
            : 'pixel',
        ...options?.metadata,
      },
    });
  }

  async recordClick(
    message: EmailCampaignMessageEntity,
    context: {
      url: string;
      linkIndex?: number;
      linkLabel?: string;
      userAgent?: string;
      ipAddress?: string;
    },
    occurredAt = new Date(),
  ): Promise<void> {
    message.clickCount += 1;

    if (!message.clickedAt) {
      message.clickedAt = occurredAt;
    }

    await this.messagesRepository.save(message);

    await this.eventsRepository.insert({
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      messageId: message.id,
      eventType: 'click',
      occurredAt,
      metadata: {
        url: context.url,
        linkIndex: context.linkIndex,
        linkLabel: context.linkLabel,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        stepOrder: message.stepOrder,
        correlationMethod: 'click_redirect',
      },
    });
  }

  async recordBounce(
    message: EmailCampaignMessageEntity,
    reason: string,
    source: 'imap' | 'smtp',
    occurredAt = new Date(),
    options?: {
      correlationMethod?: 'imap_token' | 'imap_message_id' | 'imap_fallback';
    },
  ): Promise<void> {
    if (message.openCount > 0 || message.clickCount > 0) {
      return;
    }

    await this.messagesRepository.markMessageBounced(
      message,
      reason,
      occurredAt,
    );

    await this.eventsRepository.insert({
      campaignId: message.campaignId,
      recipientId: message.recipientId,
      messageId: message.id,
      eventType: 'bounce',
      occurredAt,
      metadata: {
        reason,
        source,
        stepOrder: message.stepOrder,
        correlationMethod: options?.correlationMethod,
      },
    });
  }

  async recordReply(
    recipient: EmailCampaignRecipientEntity,
    message?: EmailCampaignMessageEntity | null,
    occurredAt = new Date(),
    options?: {
      subject?: string;
      correlationMethod?: 'imap_token' | 'imap_message_id' | 'imap_fallback';
    },
  ): Promise<void> {
    const replySubject = options?.subject?.trim().slice(0, 998) ?? null;
    let shouldSaveRecipient = false;

    if (!recipient.repliedAt) {
      recipient.repliedAt = occurredAt;
      recipient.nextSendAt = null;
      recipient.contactDisposition = 'paused';
      shouldSaveRecipient = true;
    }

    if (replySubject && !recipient.replySubject) {
      recipient.replySubject = replySubject;
      shouldSaveRecipient = true;
    }

    if (shouldSaveRecipient) {
      await this.recipientsRepository.save(recipient);
    }

    await this.eventsRepository.insert({
      campaignId: recipient.campaignId,
      recipientId: recipient.id,
      messageId: message?.id ?? null,
      eventType: 'reply',
      occurredAt,
      metadata: {
        source: 'imap',
        stepOrder: message?.stepOrder,
        subject: replySubject,
        correlationMethod: options?.correlationMethod,
      },
    });
  }

  async recordUnsubscribe(
    message: EmailCampaignMessageEntity,
    occurredAt = new Date(),
  ): Promise<void> {
    const recipient = await this.recipientsRepository.findByIdAndCampaignId(
      message.recipientId,
      message.campaignId,
    );

    if (!recipient) {
      return;
    }

    if (recipient.contactDisposition !== 'unsubscribed') {
      recipient.contactDisposition = 'unsubscribed';
      recipient.status = 'failed';
      recipient.nextSendAt = null;
      await this.recipientsRepository.save(recipient);
    }

    const campaign = await this.emailCampaignsRepository.findById(
      message.campaignId,
    );

    if (campaign) {
      await this.excludedRepository.upsertExcludedAddress({
        organizationId: campaign.organizationId,
        email: recipient.email,
        reason: 'Unsubscribed from campaign',
        sourceCampaignId: message.campaignId,
      });
    }

    const alreadyUnsubscribed =
      await this.eventsRepository.existsByRecipientIdAndEventType(
        recipient.id,
        'unsubscribe',
      );

    if (!alreadyUnsubscribed) {
      await this.eventsRepository.insert({
        campaignId: message.campaignId,
        recipientId: recipient.id,
        messageId: message.id,
        eventType: 'unsubscribe',
        occurredAt,
        metadata: { stepOrder: message.stepOrder },
      });
    }
  }

  async wasBounceMatchedByFallback(messageId: string): Promise<boolean> {
    return this.eventsRepository.wasBounceMatchedByFallback(messageId);
  }

  private async isUniqueOpen(
    messageId: string,
    userAgent?: string,
    ipAddress?: string,
    occurredAt = new Date(),
  ): Promise<boolean> {
    if (!userAgent && !ipAddress) {
      return true;
    }

    const hasDuplicate = await this.eventsRepository.hasRecentOpenFingerprint(
      messageId,
      userAgent,
      ipAddress,
      occurredAt,
      5 * 60 * 1000,
    );

    return !hasDuplicate;
  }
}
