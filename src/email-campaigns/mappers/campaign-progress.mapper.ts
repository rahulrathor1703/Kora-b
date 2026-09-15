import { Injectable } from '@nestjs/common';
import type { EmailCampaignEntity } from '../entities/email-campaign.entity';
import {
  buildFunnelStepLabel,
  computeDaysRunning,
  computePercentComplete,
  computePercentOfTotal,
  computeTodayPercent,
  DISPOSITION_SUMMARY_DEFINITIONS,
  REPLY_BREAKDOWN_DEFINITIONS,
} from '../campaign-progress.util';
import { computeEngagementRate } from '../campaign-tracking.util';
import type { CampaignRecipientEngagementStatus } from './campaign-recipient.mapper';

export interface EmailCampaignProgressRecipientStatusResponse {
  status: CampaignRecipientEngagementStatus;
  label: string;
  count: number;
  percent: number;
}

export interface EmailCampaignProgressTimelineResponse {
  launchAt: string | null;
  estimatedEndAt: string | null;
  daysRunning: number;
  contactsLeft: number;
  totalContacts: number;
  sentCount: number;
  completedCount: number;
  percentComplete: number;
  isComplete: boolean;
  todayPercent: number | null;
}

export interface EmailCampaignProgressFunnelStepResponse {
  stepOrder: number;
  label: string;
  count: number;
  percent: number;
}

export interface EmailCampaignProgressReplyBreakdownResponse {
  category: string;
  label: string;
  count: number;
  percent: number;
}

export interface EmailCampaignProgressDispositionResponse {
  disposition: string;
  label: string;
  description: string;
  count: number;
}

export interface EmailCampaignProgressEngagementResponse {
  sent: number;
  opened: number;
  openRate: number;
  clicked: number;
  ctr: number;
  replied: number;
  replyRate: number;
  bounced: number;
  bounceRate: number;
  unsubscribed: number;
  unsubscribeRate: number;
  spamReports: number;
}

export interface EmailCampaignProgressResponse {
  timeline: EmailCampaignProgressTimelineResponse;
  sequenceFunnel: EmailCampaignProgressFunnelStepResponse[];
  replyBreakdown: EmailCampaignProgressReplyBreakdownResponse[];
  dispositionSummary: EmailCampaignProgressDispositionResponse[];
  engagement: EmailCampaignProgressEngagementResponse;
  recipientStatusBreakdown: EmailCampaignProgressRecipientStatusResponse[];
}

export interface CampaignProgressAggregateInput {
  campaign: EmailCampaignEntity;
  totalContacts: number;
  contactsLeft: number;
  sentCount: number;
  completedCount: number;
  funnelCounts: number[];
  replyCounts: Record<string, number>;
  noReplyYetCount: number;
  dispositionCounts: Record<string, number>;
  engagementSent: number;
  engagementOpened: number;
  engagementClicked: number;
  engagementReplied: number;
  engagementBounced: number;
  recipientStatusBreakdown: Record<CampaignRecipientEngagementStatus, number>;
  now?: Date;
}

const RECIPIENT_STATUS_LABELS: Record<
  CampaignRecipientEngagementStatus,
  string
> = {
  pending: 'Pending',
  sent: 'Sent',
  opened: 'Opened',
  clicked: 'Clicked',
  bounced: 'Bounced',
  replied: 'Replied',
};

const RECIPIENT_STATUS_ORDER: CampaignRecipientEngagementStatus[] = [
  'pending',
  'sent',
  'opened',
  'clicked',
  'bounced',
  'replied',
];

@Injectable()
export class CampaignProgressMapper {
  toResponse(
    input: CampaignProgressAggregateInput,
  ): EmailCampaignProgressResponse {
    const now = input.now ?? new Date();
    const steps = [...(input.campaign.steps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    const totalContacts = input.totalContacts;
    const percentComplete = computePercentComplete(
      input.completedCount,
      totalContacts,
    );
    const isComplete =
      input.campaign.status === 'sent' ||
      (totalContacts > 0 && input.completedCount >= totalContacts);

    const timeline: EmailCampaignProgressTimelineResponse = {
      launchAt: input.campaign.launchAt?.toISOString() ?? null,
      estimatedEndAt: input.campaign.estimatedEndAt?.toISOString() ?? null,
      daysRunning: computeDaysRunning(input.campaign.launchAt, now),
      contactsLeft: input.contactsLeft,
      totalContacts,
      sentCount: input.engagementSent,
      completedCount: input.completedCount,
      percentComplete,
      isComplete,
      todayPercent: computeTodayPercent(
        input.campaign.launchAt,
        input.campaign.estimatedEndAt,
        now,
      ),
    };

    const sequenceFunnel: EmailCampaignProgressFunnelStepResponse[] =
      steps.length > 0
        ? steps.map((step, index) => ({
            stepOrder: step.stepOrder,
            label: buildFunnelStepLabel(step.stepOrder),
            count: input.funnelCounts[index] ?? 0,
            percent: computePercentOfTotal(
              input.funnelCounts[index] ?? 0,
              totalContacts,
            ),
          }))
        : [];

    const replyBreakdown: EmailCampaignProgressReplyBreakdownResponse[] =
      REPLY_BREAKDOWN_DEFINITIONS.map((definition) => {
        const count =
          definition.category === 'no_reply_yet'
            ? input.noReplyYetCount
            : (input.replyCounts[definition.category] ?? 0);

        return {
          category: definition.category,
          label: definition.label,
          count,
          percent: computePercentOfTotal(count, totalContacts),
        };
      });

    const dispositionSummary: EmailCampaignProgressDispositionResponse[] =
      DISPOSITION_SUMMARY_DEFINITIONS.map((definition) => ({
        disposition: definition.disposition,
        label: definition.label,
        description: definition.description,
        count: input.dispositionCounts[definition.disposition] ?? 0,
      }));

    const engagement: EmailCampaignProgressEngagementResponse = {
      sent: input.engagementSent,
      opened: input.engagementOpened,
      openRate: computeEngagementRate(
        input.engagementOpened,
        input.engagementSent,
      ),
      clicked: input.engagementClicked,
      ctr: computeEngagementRate(input.engagementClicked, input.engagementSent),
      replied: input.engagementReplied,
      replyRate: computeEngagementRate(
        input.engagementReplied,
        input.engagementSent,
      ),
      bounced: input.engagementBounced,
      bounceRate: computeEngagementRate(
        input.engagementBounced,
        input.engagementSent + input.engagementBounced,
      ),
      unsubscribed: input.dispositionCounts.unsubscribed ?? 0,
      unsubscribeRate: computeEngagementRate(
        input.dispositionCounts.unsubscribed ?? 0,
        input.engagementSent,
      ),
      spamReports: 0,
    };

    const recipientStatusBreakdown: EmailCampaignProgressRecipientStatusResponse[] =
      RECIPIENT_STATUS_ORDER.map((status) => {
        const count = input.recipientStatusBreakdown[status] ?? 0;

        return {
          status,
          label: RECIPIENT_STATUS_LABELS[status],
          count,
          percent: computePercentOfTotal(count, totalContacts),
        };
      });

    return {
      timeline,
      sequenceFunnel,
      replyBreakdown,
      dispositionSummary,
      engagement,
      recipientStatusBreakdown,
    };
  }
}
