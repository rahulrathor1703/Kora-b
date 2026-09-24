import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsWidgetEntity } from './entities/analytics.entities';

@Injectable()
export class AnalyticsWidgetsRepository {
  constructor(
    @InjectRepository(AnalyticsWidgetEntity)
    private readonly repository: Repository<AnalyticsWidgetEntity>,
  ) {}

  countByDashboardId(dashboardId: string): Promise<number> {
    return this.repository.count({ where: { dashboardId } });
  }

  findByIdAndDashboardId(
    id: string,
    dashboardId: string,
  ): Promise<AnalyticsWidgetEntity | null> {
    return this.repository.findOne({ where: { id, dashboardId } });
  }

  getNextSortOrder(dashboardId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('widget')
      .select('COALESCE(MAX(widget.sortOrder), -1)', 'maxOrder')
      .where('widget.dashboardId = :dashboardId', { dashboardId })
      .getRawOne<{ maxOrder: string }>()
      .then((result) => Number(result?.maxOrder ?? -1) + 1);
  }

  create(data: Partial<AnalyticsWidgetEntity>): AnalyticsWidgetEntity {
    return this.repository.create(data);
  }

  save(entity: AnalyticsWidgetEntity): Promise<AnalyticsWidgetEntity> {
    return this.repository.save(entity);
  }

  remove(entity: AnalyticsWidgetEntity): Promise<AnalyticsWidgetEntity> {
    return this.repository.remove(entity);
  }
}
