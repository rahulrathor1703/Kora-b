import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import type { AuthUser } from '../auth/auth.types';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { AnalyticsDashboardsService } from './analytics-dashboards.service';
import { AnalyticsQueryService } from './analytics-query.service';
import {
  AnalyticsCampaignCountQueryDto,
  AnalyticsQueryDto,
  CreateAnalyticsDashboardDto,
  CreateAnalyticsWidgetDto,
  UpdateAnalyticsDashboardDto,
  UpdateAnalyticsWidgetDto,
} from './dto/analytics.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly dashboardsService: AnalyticsDashboardsService,
    private readonly queryService: AnalyticsQueryService,
  ) {}

  @Get('dashboards')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:read')
  findAllDashboards(
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.findAll(
      organizationId,
      this.requireUser(req),
    );
  }

  @Post('dashboards')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:manage')
  createDashboard(
    @Body() dto: CreateAnalyticsDashboardDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.create(
      dto,
      organizationId,
      this.requireUser(req),
    );
  }

  @Patch('dashboards/:id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:manage')
  updateDashboard(
    @Param('id') id: string,
    @Body() dto: UpdateAnalyticsDashboardDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.update(
      id,
      dto,
      organizationId,
      this.requireUser(req),
    );
  }

  @Delete('dashboards/:id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:manage')
  removeDashboard(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.remove(
      id,
      organizationId,
      this.requireUser(req),
    );
  }

  @Post('dashboards/:id/widgets')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:manage')
  addWidget(
    @Param('id') dashboardId: string,
    @Body() dto: CreateAnalyticsWidgetDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.addWidget(
      dashboardId,
      dto,
      organizationId,
      this.requireUser(req),
    );
  }

  @Patch('dashboards/:id/widgets/:widgetId')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:manage')
  updateWidget(
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateAnalyticsWidgetDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.updateWidget(
      dashboardId,
      widgetId,
      dto,
      organizationId,
      this.requireUser(req),
    );
  }

  @Delete('dashboards/:id/widgets/:widgetId')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:manage')
  removeWidget(
    @Param('id') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.dashboardsService.removeWidget(
      dashboardId,
      widgetId,
      organizationId,
      this.requireUser(req),
    );
  }

  @Post('query')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:read')
  queryMetrics(
    @Body() dto: AnalyticsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const filters = this.queryService.mergeFilters(
      dto.globalFilters ?? {},
      dto.filters ?? {},
    );

    return this.queryService.query(
      resolvedOrganizationId,
      dto.metric,
      dto.groupBy,
      filters,
    );
  }

  @Get('filter-options')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:read')
  getFilterOptions(@CurrentOrganizationId() organizationId: string | null) {
    return this.queryService.getFilterOptions(
      requireOrganizationId(organizationId),
    );
  }

  @Get('campaign-count')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('analytics:read')
  async getCampaignCount(
    @Query() query: AnalyticsCampaignCountQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const count = await this.queryService.countCampaigns(
      requireOrganizationId(organizationId),
      query,
    );

    return { count };
  }

  private requireUser(req: AuthenticatedRequest): AuthUser {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }
}
