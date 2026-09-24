export type AnalyticsDashboardVisibility = 'private' | 'org';

export type AnalyticsMetric =
  | 'total_sent'
  | 'total_opened'
  | 'open_rate'
  | 'total_replied'
  | 'reply_rate'
  | 'total_clicks'
  | 'ctr'
  | 'total_bounced'
  | 'bounce_rate'
  | 'follow_ups_sent'
  | 'deliverability';

export type AnalyticsGroupBy =
  'campaign' | 'brand' | 'region' | 'sender' | 'type' | 'month' | 'status';

export type AnalyticsChartType =
  'bar' | 'line' | 'donut' | 'stat_card' | 'table';

export interface AnalyticsFilters {
  brandId?: string | null;
  regionId?: string | null;
  campaignTypeId?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface AnalyticsQueryPoint {
  label: string;
  value: number;
}

export interface AnalyticsQueryResult {
  points: AnalyticsQueryPoint[];
  total?: number;
  format: 'count' | 'percent';
}

export const MAX_WIDGETS_PER_DASHBOARD = 12;

export const ANALYTICS_METRICS: AnalyticsMetric[] = [
  'total_sent',
  'total_opened',
  'open_rate',
  'total_replied',
  'reply_rate',
  'total_clicks',
  'ctr',
  'total_bounced',
  'bounce_rate',
  'follow_ups_sent',
  'deliverability',
];

export const RATE_METRICS: AnalyticsMetric[] = [
  'open_rate',
  'reply_rate',
  'ctr',
  'bounce_rate',
  'deliverability',
];
