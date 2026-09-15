import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface RawCampaignListMetricsRow {
  campaignId: string;
  launchAt: Date | null;
  sent: string;
  opened: string;
  clicked: string;
  bounced: string;
  replied: string;
  unsubscribed: string;
}

@Injectable()
export class CampaignListMetricsRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<RawCampaignListMetricsRow[]> {
    return this.dataSource.query<RawCampaignListMetricsRow[]>(
      `
        SELECT
          c.id AS "campaignId",
          c.launch_at AS "launchAt",
          COALESCE(msg.sent, 0)::text AS sent,
          COALESCE(msg.opened, 0)::text AS opened,
          COALESCE(msg.clicked, 0)::text AS clicked,
          COALESCE(msg.bounced, 0)::text AS bounced,
          COALESCE(rec.replied, 0)::text AS replied,
          COALESCE(rec.unsubscribed, 0)::text AS unsubscribed
        FROM email_campaigns c
        LEFT JOIN (
          SELECT
            m.campaign_id,
            COUNT(*) FILTER (WHERE m.delivery_status = 'sent') AS sent,
            COUNT(*) FILTER (WHERE m.open_count > 0) AS opened,
            COUNT(*) FILTER (WHERE m.click_count > 0) AS clicked,
            COUNT(*) FILTER (
              WHERE m.delivery_status IN ('bounced', 'failed')
                AND m.open_count = 0
                AND m.click_count = 0
            ) AS bounced
          FROM email_campaign_messages m
          GROUP BY m.campaign_id
        ) msg ON msg.campaign_id = c.id
        LEFT JOIN (
          SELECT
            r.campaign_id,
            COUNT(*) FILTER (
              WHERE r.reply_category IS NOT NULL OR r.replied_at IS NOT NULL
            ) AS replied,
            COUNT(*) FILTER (WHERE r.contact_disposition = 'unsubscribed') AS unsubscribed
          FROM email_campaign_recipients r
          GROUP BY r.campaign_id
        ) rec ON rec.campaign_id = c.id
        WHERE c.organization_id = $1
        ORDER BY c.created_at DESC
      `,
      [organizationId],
    );
  }
}
