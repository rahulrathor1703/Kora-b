import { Injectable } from '@nestjs/common';
import { normalizeMessageId } from './bounce-monitor/bounce-parser.util';
import { extractTrackingTokenFromText } from './campaign-correlation.util';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import type { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';

export type InboxCorrelationMethod =
  'imap_token' | 'imap_message_id' | 'imap_fallback';

export interface InboxMessageMatchResult {
  message: EmailCampaignMessageEntity;
  method: InboxCorrelationMethod;
}

@Injectable()
export class CampaignMessageCorrelationService {
  constructor(
    private readonly messagesRepository: EmailCampaignMessagesRepository,
  ) {}

  async matchBounceMessage(input: {
    organizationId: string;
    mailboxId: string;
    rawText: string;
    providerMessageIds: string[];
    failedRecipientEmail?: string;
    subject?: string;
    since: Date;
  }): Promise<InboxMessageMatchResult | null> {
    const tokenMatch = await this.matchByToken(input.rawText);

    if (tokenMatch) {
      return tokenMatch;
    }

    const messageIdMatch = await this.matchByProviderMessageIds(
      input.providerMessageIds,
    );

    if (messageIdMatch) {
      return messageIdMatch;
    }

    if (!input.failedRecipientEmail) {
      return null;
    }

    const scoped = await this.messagesRepository.findScopedSentMessages(
      input.organizationId,
      input.failedRecipientEmail,
      input.mailboxId,
      input.subject ?? '',
      input.since,
      'exact',
    );

    if (scoped.length > 0) {
      return { message: scoped[0], method: 'imap_fallback' };
    }

    return null;
  }

  async matchReplyMessage(input: {
    organizationId: string;
    mailboxId: string;
    rawText: string;
    providerMessageIds: string[];
    senderEmail: string;
    subject?: string;
    since: Date;
  }): Promise<InboxMessageMatchResult | null> {
    const tokenMatch = await this.matchByToken(input.rawText);

    if (tokenMatch) {
      return tokenMatch;
    }

    const messageIdMatch = await this.matchByProviderMessageIds(
      input.providerMessageIds,
    );

    if (messageIdMatch) {
      return messageIdMatch;
    }

    const scoped = await this.messagesRepository.findScopedSentMessages(
      input.organizationId,
      input.senderEmail,
      input.mailboxId,
      input.subject ?? '',
      input.since,
      'reply_subject',
    );

    if (scoped.length > 0) {
      return { message: scoped[0], method: 'imap_fallback' };
    }

    const recent =
      await this.messagesRepository.findRecentSentByRecipientEmailInOrganization(
        input.organizationId,
        input.senderEmail,
        input.since,
      );

    const fallbackMessage = this.pickReplyFallbackMessage(
      recent,
      input.mailboxId,
      input.subject ?? '',
    );

    if (fallbackMessage) {
      return { message: fallbackMessage, method: 'imap_fallback' };
    }

    return null;
  }

  private pickReplyFallbackMessage(
    messages: EmailCampaignMessageEntity[],
    mailboxId: string,
    replySubject: string,
  ): EmailCampaignMessageEntity | null {
    if (messages.length === 0) {
      return null;
    }

    const mailboxMatches = messages.filter(
      (message) =>
        message.mailboxId === mailboxId || message.mailboxId === null,
    );
    const candidates = mailboxMatches.length > 0 ? mailboxMatches : messages;
    const normalizedReplySubject = replySubject.trim().toLowerCase();

    if (normalizedReplySubject.length === 0) {
      return candidates[0];
    }

    const subjectMatches = candidates.filter((message) => {
      const sentSubject = message.sentSubject?.trim().toLowerCase();

      if (!sentSubject) {
        return true;
      }

      return normalizedReplySubject.includes(sentSubject);
    });

    return subjectMatches[0] ?? candidates[0];
  }

  private async matchByToken(
    rawText: string,
  ): Promise<InboxMessageMatchResult | null> {
    const token = extractTrackingTokenFromText(rawText);

    if (!token) {
      return null;
    }

    const message = await this.messagesRepository.findByTrackingToken(token);

    if (!message || message.deliveryStatus !== 'sent') {
      return null;
    }

    return { message, method: 'imap_token' };
  }

  private async matchByProviderMessageIds(
    providerMessageIds: string[],
  ): Promise<InboxMessageMatchResult | null> {
    for (const messageId of providerMessageIds) {
      const message = await this.messagesRepository.findByProviderMessageId(
        normalizeMessageId(messageId),
      );

      if (message && message.deliveryStatus === 'sent') {
        return { message, method: 'imap_message_id' };
      }
    }

    return null;
  }
}
