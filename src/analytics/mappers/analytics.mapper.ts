import { Injectable } from '@nestjs/common';
import type {
  AnalyticsDashboardEntity,
  AnalyticsWidgetEntity,
} from '../entities/analytics.entities';
import type { AnalyticsFilters } from '../types/analytics.types';

export interface AnalyticsWidgetResponse {
  id: string;
  dashboardId: string;
  name: string;
  metric: string;
  groupBy: string;
  chartType: string;
  filters: AnalyticsFilters;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsDashboardResponse {
  id: string;
  organizationId: string;
  createdByUserId: string;
  name: string;
  visibility: string;
  globalFilters: AnalyticsFilters;
  sortOrder: number;
  widgets: AnalyticsWidgetResponse[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AnalyticsMapper {
  toWidgetResponse(entity: AnalyticsWidgetEntity): AnalyticsWidgetResponse {
    return {
      id: entity.id,
      dashboardId: entity.dashboardId,
      name: entity.name,
      metric: entity.metric,
      groupBy: entity.groupBy,
      chartType: entity.chartType,
      filters: entity.filters ?? {},
      sortOrder: entity.sortOrder,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toDashboardResponse(
    entity: AnalyticsDashboardEntity,
  ): AnalyticsDashboardResponse {
    const widgets = [...(entity.widgets ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((widget) => this.toWidgetResponse(widget));

    return {
      id: entity.id,
      organizationId: entity.organizationId,
      createdByUserId: entity.createdByUserId,
      name: entity.name,
      visibility: entity.visibility,
      globalFilters: entity.globalFilters ?? {},
      sortOrder: entity.sortOrder,
      widgets,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
