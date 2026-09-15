import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  AnalyticsChartType,
  AnalyticsDashboardVisibility,
  AnalyticsFilters,
  AnalyticsGroupBy,
  AnalyticsMetric,
} from '../types/analytics.types';
import {
  ANALYTICS_METRICS,
  MAX_WIDGETS_PER_DASHBOARD,
} from '../types/analytics.types';

export class AnalyticsFiltersDto implements AnalyticsFilters {
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @IsUUID()
  regionId?: string | null;

  @IsOptional()
  @IsUUID()
  campaignTypeId?: string | null;

  @IsOptional()
  @IsString()
  status?: string | null;

  @IsOptional()
  @IsString()
  dateFrom?: string | null;

  @IsOptional()
  @IsString()
  dateTo?: string | null;
}

export class CreateAnalyticsDashboardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(['private', 'org'])
  visibility!: AnalyticsDashboardVisibility;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  globalFilters?: AnalyticsFiltersDto;
}

export class UpdateAnalyticsDashboardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(['private', 'org'])
  visibility?: AnalyticsDashboardVisibility;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  globalFilters?: AnalyticsFiltersDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateAnalyticsWidgetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsIn(ANALYTICS_METRICS)
  metric!: AnalyticsMetric;

  @IsIn(['campaign', 'brand', 'region', 'sender', 'type', 'month', 'status'])
  groupBy!: AnalyticsGroupBy;

  @IsIn(['bar', 'line', 'donut', 'stat_card', 'table'])
  chartType!: AnalyticsChartType;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters?: AnalyticsFiltersDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateAnalyticsWidgetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(ANALYTICS_METRICS)
  metric?: AnalyticsMetric;

  @IsOptional()
  @IsIn(['campaign', 'brand', 'region', 'sender', 'type', 'month', 'status'])
  groupBy?: AnalyticsGroupBy;

  @IsOptional()
  @IsIn(['bar', 'line', 'donut', 'stat_card', 'table'])
  chartType?: AnalyticsChartType;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters?: AnalyticsFiltersDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AnalyticsQueryDto {
  @IsIn(ANALYTICS_METRICS)
  metric!: AnalyticsMetric;

  @IsIn(['campaign', 'brand', 'region', 'sender', 'type', 'month', 'status'])
  groupBy!: AnalyticsGroupBy;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  filters?: AnalyticsFiltersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsFiltersDto)
  globalFilters?: AnalyticsFiltersDto;
}

export class AnalyticsCampaignCountQueryDto extends AnalyticsFiltersDto {}

export { MAX_WIDGETS_PER_DASHBOARD };
