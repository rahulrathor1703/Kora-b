import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { AuthUser } from '../auth/auth.types';
import { hasPermission } from '../auth/auth-access.utils';
import { AnalyticsDashboardsRepository } from './analytics-dashboards.repository';
import { AnalyticsWidgetsRepository } from './analytics-widgets.repository';
import type {
  CreateAnalyticsDashboardDto,
  CreateAnalyticsWidgetDto,
  UpdateAnalyticsDashboardDto,
  UpdateAnalyticsWidgetDto,
} from './dto/analytics.dto';
import { MAX_WIDGETS_PER_DASHBOARD } from './dto/analytics.dto';
import type { AnalyticsDashboardEntity } from './entities/analytics.entities';
import {
  AnalyticsMapper,
  type AnalyticsDashboardResponse,
  type AnalyticsWidgetResponse,
} from './mappers/analytics.mapper';

@Injectable()
export class AnalyticsDashboardsService {
  constructor(
    private readonly dashboardsRepository: AnalyticsDashboardsRepository,
    private readonly widgetsRepository: AnalyticsWidgetsRepository,
    private readonly analyticsMapper: AnalyticsMapper,
  ) {}

  async findAll(
    organizationId: string | null,
    user: AuthUser,
  ): Promise<AnalyticsDashboardResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const dashboards = await this.dashboardsRepository.findVisibleForUser(
      resolvedOrganizationId,
      user.id,
    );

    return dashboards.map((dashboard) =>
      this.analyticsMapper.toDashboardResponse(dashboard),
    );
  }

  async create(
    dto: CreateAnalyticsDashboardDto,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<AnalyticsDashboardResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const sortOrder = await this.dashboardsRepository.getNextSortOrder(
      resolvedOrganizationId,
    );

    const dashboard = this.dashboardsRepository.create({
      organizationId: resolvedOrganizationId,
      createdByUserId: user.id,
      name: dto.name.trim(),
      visibility: dto.visibility,
      globalFilters: dto.globalFilters ?? {},
      sortOrder,
      widgets: [],
    });

    const saved = await this.dashboardsRepository.save(dashboard);
    return this.analyticsMapper.toDashboardResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateAnalyticsDashboardDto,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<AnalyticsDashboardResponse> {
    const dashboard = await this.requireManageableDashboard(
      id,
      organizationId,
      user,
    );

    if (dto.name !== undefined) {
      dashboard.name = dto.name.trim();
    }

    if (dto.visibility !== undefined) {
      dashboard.visibility = dto.visibility;
    }

    if (dto.globalFilters !== undefined) {
      dashboard.globalFilters = dto.globalFilters;
    }

    if (dto.sortOrder !== undefined) {
      dashboard.sortOrder = dto.sortOrder;
    }

    const saved = await this.dashboardsRepository.save(dashboard);
    return this.analyticsMapper.toDashboardResponse(saved);
  }

  async remove(
    id: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<void> {
    const dashboard = await this.requireManageableDashboard(
      id,
      organizationId,
      user,
    );

    await this.dashboardsRepository.remove(dashboard);
  }

  async addWidget(
    dashboardId: string,
    dto: CreateAnalyticsWidgetDto,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<AnalyticsWidgetResponse> {
    const dashboard = await this.requireManageableDashboard(
      dashboardId,
      organizationId,
      user,
    );

    const widgetCount = await this.widgetsRepository.countByDashboardId(
      dashboard.id,
    );

    if (widgetCount >= MAX_WIDGETS_PER_DASHBOARD) {
      throw new BadRequestException(
        `Dashboards can contain at most ${MAX_WIDGETS_PER_DASHBOARD} widgets`,
      );
    }

    const sortOrder =
      dto.sortOrder ??
      (await this.widgetsRepository.getNextSortOrder(dashboard.id));

    const widget = this.widgetsRepository.create({
      dashboardId: dashboard.id,
      name: dto.name.trim(),
      metric: dto.metric,
      groupBy: dto.groupBy,
      chartType: dto.chartType,
      filters: dto.filters ?? {},
      sortOrder,
    });

    const saved = await this.widgetsRepository.save(widget);
    return this.analyticsMapper.toWidgetResponse(saved);
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    dto: UpdateAnalyticsWidgetDto,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<AnalyticsWidgetResponse> {
    await this.requireManageableDashboard(dashboardId, organizationId, user);

    const widget = await this.widgetsRepository.findByIdAndDashboardId(
      widgetId,
      dashboardId,
    );

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    if (dto.name !== undefined) {
      widget.name = dto.name.trim();
    }

    if (dto.metric !== undefined) {
      widget.metric = dto.metric;
    }

    if (dto.groupBy !== undefined) {
      widget.groupBy = dto.groupBy;
    }

    if (dto.chartType !== undefined) {
      widget.chartType = dto.chartType;
    }

    if (dto.filters !== undefined) {
      widget.filters = dto.filters;
    }

    if (dto.sortOrder !== undefined) {
      widget.sortOrder = dto.sortOrder;
    }

    const saved = await this.widgetsRepository.save(widget);
    return this.analyticsMapper.toWidgetResponse(saved);
  }

  async removeWidget(
    dashboardId: string,
    widgetId: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<void> {
    await this.requireManageableDashboard(dashboardId, organizationId, user);

    const widget = await this.widgetsRepository.findByIdAndDashboardId(
      widgetId,
      dashboardId,
    );

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    await this.widgetsRepository.remove(widget);
  }

  private async requireManageableDashboard(
    id: string,
    organizationId: string | null,
    user: AuthUser,
  ): Promise<AnalyticsDashboardEntity> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const dashboard = await this.dashboardsRepository.findByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const canManageOrgDashboard =
      dashboard.visibility === 'org' && hasPermission(user, 'analytics:manage');
    const canManageOwnDashboard =
      dashboard.createdByUserId === user.id &&
      hasPermission(user, 'analytics:manage');

    if (!canManageOrgDashboard && !canManageOwnDashboard) {
      throw new ForbiddenException('You cannot modify this dashboard');
    }

    return dashboard;
  }
}
