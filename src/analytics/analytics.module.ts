import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsDashboardsRepository } from './analytics-dashboards.repository';
import { AnalyticsDashboardsService } from './analytics-dashboards.service';
import { AnalyticsQueryRepository } from './analytics-query.repository';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsWidgetsRepository } from './analytics-widgets.repository';
import {
  AnalyticsDashboardEntity,
  AnalyticsWidgetEntity,
} from './entities/analytics.entities';
import { AnalyticsMapper } from './mappers/analytics.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsDashboardEntity, AnalyticsWidgetEntity]),
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsDashboardsRepository,
    AnalyticsWidgetsRepository,
    AnalyticsQueryRepository,
    AnalyticsDashboardsService,
    AnalyticsQueryService,
    AnalyticsMapper,
  ],
  exports: [AnalyticsDashboardsService, AnalyticsQueryService],
})
export class AnalyticsModule {}
