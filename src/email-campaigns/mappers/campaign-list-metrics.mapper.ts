import { Injectable } from '@nestjs/common';
import { computeDaysRunning } from '../campaign-progress.util';
import { computeEngagementRate } from '../campaign-tracking.util';
import type { RawCampaignListMetricsRow } from '../campaign-list-metrics.repository';

export interface EmailCampaignListMetricsResponse {
  campaignId: string;
  totalSent: number;
  deliverability: number;
  openRate: number;
  ctr: number;
  replyRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  sendingPace: number | null;
}

@Injectable()
export class CampaignListMetricsMapper {
  toResponse(
    row: RawCampaignListMetricsRow,
    now: Date = new Date(),
  ): EmailCampaignListMetricsResponse {
    const sent = Number(row.sent);
    const opened = Number(row.opened);
    const clicked = Number(row.clicked);
    const bounced = Number(row.bounced);
    const replied = Number(row.replied);
    const unsubscribed = Number(row.unsubscribed);
    const attempted = sent + bounced;
    const daysRunning = computeDaysRunning(row.launchAt, now);
    const sendingPace =
      daysRunning > 0 && sent > 0 ? Math.round(sent / daysRunning) : null;

    return {
      campaignId: row.campaignId,
      totalSent: sent,
      deliverability: computeEngagementRate(sent, attempted),
      openRate: computeEngagementRate(opened, sent),
      ctr: computeEngagementRate(clicked, sent),
      replyRate: computeEngagementRate(replied, sent),
      bounceRate: computeEngagementRate(bounced, attempted),
      unsubscribeRate: computeEngagementRate(unsubscribed, sent),
      sendingPace,
    };
  }
}
