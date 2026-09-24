import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AnalyticsDashboardEntity } from './entities/analytics.entities';

@Injectable()
export class AnalyticsDashboardsRepository {
  constructor(
    @InjectRepository(AnalyticsDashboardEntity)
    private readonly repository: Repository<AnalyticsDashboardEntity>,
  ) {}

  findVisibleForUser(
    organizationId: string,
    userId: string,
  ): Promise<AnalyticsDashboardEntity[]> {
    return this.repository
      .createQueryBuilder('dashboard')
      .leftJoinAndSelect('dashboard.widgets', 'widget')
      .where('dashboard.organizationId = :organizationId', { organizationId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('dashboard.visibility = :orgVisibility', {
            orgVisibility: 'org',
          }).orWhere('dashboard.createdByUserId = :userId', { userId });
        }),
      )
      .orderBy('dashboard.sortOrder', 'ASC')
      .addOrderBy('dashboard.createdAt', 'ASC')
      .addOrderBy('widget.sortOrder', 'ASC')
      .getMany();
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<AnalyticsDashboardEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { widgets: true },
      order: { widgets: { sortOrder: 'ASC' } },
    });
  }

  countByOrganizationId(organizationId: string): Promise<number> {
    return this.repository.count({ where: { organizationId } });
  }

  getNextSortOrder(organizationId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('dashboard')
      .select('COALESCE(MAX(dashboard.sortOrder), -1)', 'maxOrder')
      .where('dashboard.organizationId = :organizationId', { organizationId })
      .getRawOne<{ maxOrder: string }>()
      .then((result) => Number(result?.maxOrder ?? -1) + 1);
  }

  create(data: Partial<AnalyticsDashboardEntity>): AnalyticsDashboardEntity {
    return this.repository.create(data);
  }

  save(entity: AnalyticsDashboardEntity): Promise<AnalyticsDashboardEntity> {
    return this.repository.save(entity);
  }

  remove(entity: AnalyticsDashboardEntity): Promise<AnalyticsDashboardEntity> {
    return this.repository.remove(entity);
  }
}
