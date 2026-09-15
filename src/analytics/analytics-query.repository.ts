import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  AnalyticsFilters,
  AnalyticsGroupBy,
} from './types/analytics.types';

export interface RawGroupAggregateRow {
  label: string;
  sent: string;
  opened: string;
  clicked: string;
  bounced: string;
  replied: string;
  followUpsSent: string;
}

interface FilterParams {
  conditions: string[];
  params: unknown[];
}

@Injectable()
export class AnalyticsQueryRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async countCampaigns(
    organizationId: string,
    filters: AnalyticsFilters,
  ): Promise<number> {
    const { conditions, params } = this.buildFilterConditions(filters, 2);
    const whereClause =
      conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    const result = await this.dataSource.query<{ count: string }[]>(
      `
        SELECT COUNT(*)::text AS count
        FROM email_campaigns c
        WHERE c.organization_id = $1
        ${whereClause}
      `,
      [organizationId, ...params],
    );

    return Number(result[0]?.count ?? 0);
  }

  async aggregateByGroup(
    organizationId: string,
    groupBy: AnalyticsGroupBy,
    filters: AnalyticsFilters,
  ): Promise<RawGroupAggregateRow[]> {
    const { conditions, params } = this.buildFilterConditions(filters, 2);
    const whereClause =
      conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    const groupExpression = this.buildGroupExpression(groupBy);
    const joins = this.buildGroupJoins(groupBy);

    return this.dataSource.query<RawGroupAggregateRow[]>(
      `
        SELECT
          ${groupExpression} AS label,
          COUNT(m.id) FILTER (WHERE m.sent_at IS NOT NULL)::text AS sent,
          COUNT(m.id) FILTER (
            WHERE m.opened_at IS NOT NULL OR m.open_count > 0
          )::text AS opened,
          COUNT(m.id) FILTER (
            WHERE m.clicked_at IS NOT NULL OR m.click_count > 0
          )::text AS clicked,
          COUNT(m.id) FILTER (
            WHERE m.bounced_at IS NOT NULL OR m.delivery_status = 'bounced'
          )::text AS bounced,
          COUNT(DISTINCT r.id) FILTER (WHERE r.replied_at IS NOT NULL)::text AS replied,
          COUNT(m.id) FILTER (
            WHERE m.step_order > 1 AND m.sent_at IS NOT NULL
          )::text AS "followUpsSent"
        FROM email_campaigns c
        ${joins}
        LEFT JOIN email_campaign_messages m ON m.campaign_id = c.id
        LEFT JOIN email_campaign_recipients r ON r.campaign_id = c.id
        WHERE c.organization_id = $1
        ${whereClause}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [organizationId, ...params],
    );
  }

  async getFilterOptions(organizationId: string): Promise<{
    brands: { id: string; label: string }[];
    regions: { id: string; label: string }[];
    types: { id: string; label: string }[];
    statuses: { value: string; label: string }[];
  }> {
    const [brands, regions, types, statuses] = await Promise.all([
      this.dataSource.query<{ id: string; label: string }[]>(
        `
          SELECT id, label
          FROM email_config_options
          WHERE organization_id = $1
            AND category = 'brand'
            AND is_active = true
          ORDER BY sort_order ASC, label ASC
        `,
        [organizationId],
      ),
      this.dataSource.query<{ id: string; label: string }[]>(
        `
          SELECT id, label
          FROM email_config_options
          WHERE organization_id = $1
            AND category = 'region'
            AND is_active = true
          ORDER BY sort_order ASC, label ASC
        `,
        [organizationId],
      ),
      this.dataSource.query<{ id: string; label: string }[]>(
        `
          SELECT id, label
          FROM email_config_options
          WHERE organization_id = $1
            AND category = 'campaign-type'
            AND is_active = true
          ORDER BY sort_order ASC, label ASC
        `,
        [organizationId],
      ),
      this.dataSource.query<{ value: string; label: string }[]>(
        `
          SELECT DISTINCT status AS value,
            INITCAP(status) AS label
          FROM email_campaigns
          WHERE organization_id = $1
          ORDER BY label ASC
        `,
        [organizationId],
      ),
    ]);

    return { brands, regions, types, statuses };
  }

  private buildFilterConditions(
    filters: AnalyticsFilters,
    startIndex: number,
  ): FilterParams {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let index = startIndex;

    if (filters.brandId) {
      conditions.push(`c.brand_id = $${index}`);
      params.push(filters.brandId);
      index += 1;
    }

    if (filters.regionId) {
      conditions.push(`c.region_id = $${index}`);
      params.push(filters.regionId);
      index += 1;
    }

    if (filters.campaignTypeId) {
      conditions.push(`c.campaign_type_id = $${index}`);
      params.push(filters.campaignTypeId);
      index += 1;
    }

    if (filters.status) {
      conditions.push(`c.status = $${index}`);
      params.push(filters.status);
      index += 1;
    }

    if (filters.dateFrom) {
      conditions.push(
        `COALESCE(c.launch_at, c.created_at) >= $${index}::timestamptz`,
      );
      params.push(filters.dateFrom);
      index += 1;
    }

    if (filters.dateTo) {
      conditions.push(
        `COALESCE(c.launch_at, c.created_at) <= $${index}::timestamptz`,
      );
      params.push(filters.dateTo);
      index += 1;
    }

    return { conditions, params };
  }

  private buildGroupExpression(groupBy: AnalyticsGroupBy): string {
    switch (groupBy) {
      case 'campaign':
        return 'c.name';
      case 'brand':
        return "COALESCE(brand_opt.label, 'Unassigned')";
      case 'region':
        return "COALESCE(region_opt.label, 'Unassigned')";
      case 'type':
        return "COALESCE(type_opt.label, 'Unassigned')";
      case 'sender':
        return "COALESCE(sender.sender_email, 'Unassigned')";
      case 'status':
        return 'INITCAP(c.status)';
      case 'month':
        return "TO_CHAR(DATE_TRUNC('month', COALESCE(c.launch_at, c.created_at)), 'Mon YYYY')";
      default:
        return 'c.name';
    }
  }

  private buildGroupJoins(groupBy: AnalyticsGroupBy): string {
    const joins: string[] = [];

    if (groupBy === 'brand') {
      joins.push(
        'LEFT JOIN email_config_options brand_opt ON brand_opt.id = c.brand_id',
      );
    }

    if (groupBy === 'region') {
      joins.push(
        'LEFT JOIN email_config_options region_opt ON region_opt.id = c.region_id',
      );
    }

    if (groupBy === 'type') {
      joins.push(
        'LEFT JOIN email_config_options type_opt ON type_opt.id = c.campaign_type_id',
      );
    }

    if (groupBy === 'sender') {
      joins.push(`
        LEFT JOIN LATERAL (
          SELECT sender_email
          FROM email_campaign_mailbox_senders
          WHERE campaign_id = c.id
          ORDER BY sender_email ASC
          LIMIT 1
        ) sender ON true
      `);
    }

    return joins.join('\n');
  }
}
