import { Injectable } from '@nestjs/common';
import { buildUnsubscribeTrackingUrl } from './campaign-tracking.util';
import type { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';

export interface CampaignMergeTagTrackingContext {
  baseUrl: string;
  token: string;
}

@Injectable()
export class CampaignMergeTagService {
  render(
    content: string,
    mergeFields: Record<string, string>,
    sender: EmailCampaignMailboxSenderEntity,
    tracking?: CampaignMergeTagTrackingContext,
  ): string {
    const unsubscribeUrl = tracking
      ? buildUnsubscribeTrackingUrl(tracking.baseUrl, tracking.token)
      : '[Unsubscribe link]';

    const values: Record<string, string> = {
      ...mergeFields,
      sender_name: sender.senderName,
      email: mergeFields.email ?? '',
      first_name: mergeFields.first_name ?? mergeFields.firstName ?? '',
      last_name: mergeFields.last_name ?? mergeFields.lastName ?? '',
      full_name: this.buildFullName(mergeFields),
      company: mergeFields.company ?? '',
      role: mergeFields.role ?? '',
      city: mergeFields.city ?? '',
      country: mergeFields.country ?? '',
      unsubscribe: unsubscribeUrl,
    };

    return content.replace(/\{\{(\w+)\}\}/g, (match, token: string) => {
      return values[token] ?? match;
    });
  }

  private buildFullName(mergeFields: Record<string, string>): string {
    const firstName = mergeFields.first_name ?? mergeFields.firstName ?? '';
    const lastName = mergeFields.last_name ?? mergeFields.lastName ?? '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim();
    }

    return firstName || lastName;
  }
}
