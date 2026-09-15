import { Injectable } from '@nestjs/common';
import type { EmailCampaignRecipientEntity } from '../entities/email-campaign-recipient.entity';

export interface EmailInboxReplyResponse {
  recipientId: string;
  campaignId: string;
  campaignName: string;
  recipientEmail: string;
  recipientName: string | null;
  replySubject: string | null;
  repliedAt: string | null;
  replyCategory: string | null;
  replyReadAt: string | null;
  replyDoneReason: string | null;
  currentStepOrder: number;
  contactDisposition: string;
}

export interface PaginatedEmailInboxRepliesResponse {
  items: EmailInboxReplyResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface EmailInboxReplyRow {
  recipient: EmailCampaignRecipientEntity;
  campaignName: string;
}

@Injectable()
export class EmailInboxMapper {
  toResponse(row: EmailInboxReplyRow): EmailInboxReplyResponse {
    const { recipient, campaignName } = row;

    return {
      recipientId: recipient.id,
      campaignId: recipient.campaignId,
      campaignName,
      recipientEmail: recipient.email,
      recipientName: resolveRecipientName(recipient.mergeFields),
      replySubject: recipient.replySubject,
      repliedAt: recipient.repliedAt?.toISOString() ?? null,
      replyCategory: recipient.replyCategory,
      replyReadAt: recipient.replyReadAt?.toISOString() ?? null,
      replyDoneReason: recipient.replyDoneReason ?? null,
      currentStepOrder: recipient.currentStepOrder,
      contactDisposition: recipient.contactDisposition,
    };
  }
}

export function resolveRecipientName(
  mergeFields: Record<string, string>,
): string | null {
  const fullName =
    mergeFields.full_name?.trim() ||
    mergeFields.fullName?.trim() ||
    buildFullName(mergeFields);

  return fullName || null;
}

function buildFullName(mergeFields: Record<string, string>): string {
  const firstName =
    mergeFields.first_name?.trim() ?? mergeFields.firstName?.trim() ?? '';
  const lastName =
    mergeFields.last_name?.trim() ?? mergeFields.lastName?.trim() ?? '';

  if (firstName && lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return firstName || lastName;
}
