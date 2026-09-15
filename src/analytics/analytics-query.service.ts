import { Injectable } from '@nestjs/common';
import { computeEngagementRate } from '../email-campaigns/campaign-tracking.util';
import {
  AnalyticsQueryRepository,
  type RawGroupAggregateRow,
} from './analytics-query.repository';
import type {
  AnalyticsFilters,
  AnalyticsGroupBy,
  AnalyticsMetric,
  AnalyticsQueryResult,
} from './types/analytics.types';
import { RATE_METRICS } from './types/analytics.types';

@Injectable()
export class AnalyticsQueryService {
  constructor(
    private readonly analyticsQueryRepository: AnalyticsQueryRepository,
  ) {}

  mergeFilters(
    globalFilters: AnalyticsFilters = {},
    widgetFilters: AnalyticsFilters = {},
  ): AnalyticsFilters {
    return {
      brandId: widgetFilters.brandId ?? globalFilters.brandId ?? null,
      regionId: widgetFilters.regionId ?? globalFilters.regionId ?? null,
      campaignTypeId:
        widgetFilters.campaignTypeId ?? globalFilters.campaignTypeId ?? null,
      status: widgetFilters.status ?? globalFilters.status ?? null,
      dateFrom: widgetFilters.dateFrom ?? globalFilters.dateFrom ?? null,
      dateTo: widgetFilters.dateTo ?? globalFilters.dateTo ?? null,
    };
  }

  async query(
    organizationId: string,
    metric: AnalyticsMetric,
    groupBy: AnalyticsGroupBy,
    filters: AnalyticsFilters = {},
  ): Promise<AnalyticsQueryResult> {
    const rows = await this.analyticsQueryRepository.aggregateByGroup(
      organizationId,
      groupBy,
      filters,
    );

    const isRate = RATE_METRICS.includes(metric);
    const points = rows.map((row) => ({
      label: row.label || 'Unknown',
      value: this.computeMetricValue(metric, row),
    }));

    if (isRate) {
      const totals = this.sumRows(rows);
      const total = this.computeMetricValue(metric, totals);

      return {
        points,
        total,
        format: 'percent',
      };
    }

    const total = points.reduce((sum, point) => sum + point.value, 0);

    return {
      points,
      total,
      format: 'count',
    };
  }

  countCampaigns(
    organizationId: string,
    filters: AnalyticsFilters = {},
  ): Promise<number> {
    return this.analyticsQueryRepository.countCampaigns(
      organizationId,
      filters,
    );
  }

  getFilterOptions(organizationId: string) {
    return this.analyticsQueryRepository.getFilterOptions(organizationId);
  }

  private sumRows(rows: RawGroupAggregateRow[]): RawGroupAggregateRow {
    return rows.reduce(
      (acc, row) => ({
        label: 'Total',
        sent: String(Number(acc.sent) + Number(row.sent)),
        opened: String(Number(acc.opened) + Number(row.opened)),
        clicked: String(Number(acc.clicked) + Number(row.clicked)),
        bounced: String(Number(acc.bounced) + Number(row.bounced)),
        replied: String(Number(acc.replied) + Number(row.replied)),
        followUpsSent: String(
          Number(acc.followUpsSent) + Number(row.followUpsSent),
        ),
      }),
      {
        label: 'Total',
        sent: '0',
        opened: '0',
        clicked: '0',
        bounced: '0',
        replied: '0',
        followUpsSent: '0',
      },
    );
  }

  private computeMetricValue(
    metric: AnalyticsMetric,
    row: RawGroupAggregateRow,
  ): number {
    const sent = Number(row.sent);
    const opened = Number(row.opened);
    const clicked = Number(row.clicked);
    const bounced = Number(row.bounced);
    const replied = Number(row.replied);
    const followUpsSent = Number(row.followUpsSent);

    switch (metric) {
      case 'total_sent':
        return sent;
      case 'total_opened':
        return opened;
      case 'open_rate':
        return computeEngagementRate(opened, sent);
      case 'total_replied':
        return replied;
      case 'reply_rate':
        return computeEngagementRate(replied, sent);
      case 'total_clicks':
        return clicked;
      case 'ctr':
        return computeEngagementRate(clicked, sent);
      case 'total_bounced':
        return bounced;
      case 'bounce_rate':
        return computeEngagementRate(bounced, sent);
      case 'follow_ups_sent':
        return followUpsSent;
      case 'deliverability':
        return computeEngagementRate(Math.max(sent - bounced, 0), sent);
      default:
        return 0;
    }
  }
}
