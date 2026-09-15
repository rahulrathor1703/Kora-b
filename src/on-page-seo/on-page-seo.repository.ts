import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnPageAuditRunEntity } from './entities/on-page-audit-run.entity';
import { OnPagePageResultEntity } from './entities/on-page-page-result.entity';
import { WebsitePropertyEntity } from './entities/website-property.entity';

@Injectable()
export class WebsitePropertiesRepository {
  constructor(
    @InjectRepository(WebsitePropertyEntity)
    private readonly repository: Repository<WebsitePropertyEntity>,
  ) {}

  findByOrganizationId(
    organizationId: string,
  ): Promise<WebsitePropertyEntity[]> {
    return this.repository.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  findActiveByOrganizationId(
    organizationId: string,
  ): Promise<WebsitePropertyEntity[]> {
    return this.repository.find({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  findAllActive(): Promise<WebsitePropertyEntity[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { organizationId: 'ASC', name: 'ASC' },
    });
  }

  findById(
    id: string,
    organizationId: string,
  ): Promise<WebsitePropertyEntity | null> {
    return this.repository.findOne({ where: { id, organizationId } });
  }

  findByDomain(
    domain: string,
    organizationId: string,
  ): Promise<WebsitePropertyEntity | null> {
    return this.repository.findOne({ where: { domain, organizationId } });
  }

  create(data: Partial<WebsitePropertyEntity>): WebsitePropertyEntity {
    return this.repository.create(data);
  }

  save(entity: WebsitePropertyEntity): Promise<WebsitePropertyEntity> {
    return this.repository.save(entity);
  }

  async deleteById(id: string, organizationId: string): Promise<boolean> {
    const result = await this.repository.delete({ id, organizationId });
    return (result.affected ?? 0) > 0;
  }
}

export interface AuditRunsQuery {
  websitePropertyId?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedAuditRuns {
  items: OnPageAuditRunEntity[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class OnPageAuditRunsRepository {
  constructor(
    @InjectRepository(OnPageAuditRunEntity)
    private readonly repository: Repository<OnPageAuditRunEntity>,
  ) {}

  findById(
    id: string,
    organizationId: string,
  ): Promise<OnPageAuditRunEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { websiteProperty: true },
    });
  }

  findLatestCompletedByPropertyId(
    websitePropertyId: string,
    organizationId: string,
    excludeRunId?: string,
  ): Promise<OnPageAuditRunEntity | null> {
    const qb = this.repository
      .createQueryBuilder('run')
      .where('run.websitePropertyId = :websitePropertyId', {
        websitePropertyId,
      })
      .andWhere('run.organizationId = :organizationId', { organizationId })
      .andWhere("run.status = 'completed'")
      .orderBy('run.completedAt', 'DESC')
      .take(1);

    if (excludeRunId) {
      qb.andWhere('run.id != :excludeRunId', { excludeRunId });
    }

    return qb.getOne();
  }

  async findPaginated(
    organizationId: string,
    query: AuditRunsQuery,
  ): Promise<PaginatedAuditRuns> {
    const qb = this.repository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.websiteProperty', 'property')
      .where('run.organizationId = :organizationId', { organizationId });

    if (query.websitePropertyId) {
      qb.andWhere('run.websitePropertyId = :websitePropertyId', {
        websitePropertyId: query.websitePropertyId,
      });
    }

    qb.orderBy('run.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  create(data: Partial<OnPageAuditRunEntity>): OnPageAuditRunEntity {
    return this.repository.create(data);
  }

  save(entity: OnPageAuditRunEntity): Promise<OnPageAuditRunEntity> {
    return this.repository.save(entity);
  }
}

export interface PageResultsQuery {
  page: number;
  pageSize: number;
  hasIssuesOnly?: boolean;
  thinContentOnly?: boolean;
  minScore?: number;
  maxScore?: number;
}

export interface PaginatedPageResults {
  items: OnPagePageResultEntity[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class OnPagePageResultsRepository {
  constructor(
    @InjectRepository(OnPagePageResultEntity)
    private readonly repository: Repository<OnPagePageResultEntity>,
  ) {}

  async findPaginatedByAuditRunId(
    auditRunId: string,
    query: PageResultsQuery,
  ): Promise<PaginatedPageResults> {
    const qb = this.repository
      .createQueryBuilder('result')
      .where('result.auditRunId = :auditRunId', { auditRunId });

    if (query.hasIssuesOnly) {
      qb.andWhere('result.issueCount > 0');
    }

    if (query.thinContentOnly) {
      qb.andWhere('result.isThinContent = true');
    }

    if (query.minScore !== undefined) {
      qb.andWhere('result.seoScore >= :minScore', { minScore: query.minScore });
    }

    if (query.maxScore !== undefined) {
      qb.andWhere('result.seoScore <= :maxScore', { maxScore: query.maxScore });
    }

    qb.orderBy('result.seoScore', 'ASC').addOrderBy('result.url', 'ASC');

    const total = await qb.getCount();
    const items = await qb
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  create(data: Partial<OnPagePageResultEntity>): OnPagePageResultEntity {
    return this.repository.create(data);
  }

  save(entity: OnPagePageResultEntity): Promise<OnPagePageResultEntity> {
    return this.repository.save(entity);
  }

  saveMany(
    entities: OnPagePageResultEntity[],
  ): Promise<OnPagePageResultEntity[]> {
    return this.repository.save(entities);
  }
}
