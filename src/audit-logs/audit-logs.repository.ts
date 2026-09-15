import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import type {
  AuditLogRecordInput,
  AuditLogsQuery,
  PaginatedAuditLogs,
} from './audit-log.types';
import { AuditLogEntity } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsRepository {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  create(data: AuditLogRecordInput): AuditLogEntity {
    return this.repository.create({
      organizationId: data.organizationId,
      actorUserId: data.actorUserId,
      actorName: data.actorName,
      actorEmail: data.actorEmail,
      module: data.module,
      action: data.action,
      httpMethod: data.httpMethod,
      requestPath: data.requestPath,
      statusCode: data.statusCode,
      message: data.message,
      resourceType: data.resourceType ?? null,
      resourceId: data.resourceId ?? null,
      metadata: data.metadata ?? {},
    });
  }

  save(entity: AuditLogEntity): Promise<AuditLogEntity> {
    return this.repository.save(entity);
  }

  async findPaginated(query: AuditLogsQuery): Promise<PaginatedAuditLogs> {
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.platformScope) {
      if (query.organizationId) {
        qb.andWhere('log.organizationId = :organizationId', {
          organizationId: query.organizationId,
        });
      } else {
        qb.andWhere('log.organizationId IS NULL');
      }
    } else if (query.organizationId) {
      qb.andWhere('log.organizationId = :organizationId', {
        organizationId: query.organizationId,
      });
    }

    if (query.module) {
      qb.andWhere('log.module = :module', { module: query.module });
    }

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.httpMethod) {
      qb.andWhere('UPPER(log.httpMethod) = UPPER(:httpMethod)', {
        httpMethod: query.httpMethod,
      });
    }

    if (query.actorUserId) {
      qb.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: query.actorUserId,
      });
    }

    if (query.from) {
      qb.andWhere('log.createdAt >= :from', { from: query.from });
    }

    if (query.to) {
      qb.andWhere('log.createdAt <= :to', { to: query.to });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('log.message ILIKE :term', { term })
            .orWhere('log.requestPath ILIKE :term', { term })
            .orWhere('log.actorName ILIKE :term', { term })
            .orWhere('log.actorEmail ILIKE :term', { term });
        }),
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => ({
        id: item.id,
        organizationId: item.organizationId,
        actorUserId: item.actorUserId,
        actorName: item.actorName,
        actorEmail: item.actorEmail,
        module: item.module,
        action: item.action,
        httpMethod: item.httpMethod,
        requestPath: item.requestPath,
        statusCode: item.statusCode,
        message: item.message,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        metadata: item.metadata ?? {},
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}
