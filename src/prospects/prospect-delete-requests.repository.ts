import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ProspectDeleteRequestEntity,
  type ProspectDeleteRequestStatus,
} from './entities/prospect-delete-request.entity';
import { ProspectEntity } from './entities/prospect.entity';

export interface ProspectDeleteRequestsQuery {
  status?: ProspectDeleteRequestStatus;
  prospectId?: string;
  requestedByUserId?: string;
}

@Injectable()
export class ProspectDeleteRequestsRepository {
  constructor(
    @InjectRepository(ProspectDeleteRequestEntity)
    private readonly repository: Repository<ProspectDeleteRequestEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findByOrganizationId(
    organizationId: string,
    query: ProspectDeleteRequestsQuery = {},
  ): Promise<ProspectDeleteRequestEntity[]> {
    const qb = this.repository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.prospect', 'prospect')
      .leftJoinAndSelect('request.requestedBy', 'requestedBy')
      .leftJoinAndSelect('request.reviewedBy', 'reviewedBy')
      .where('request.organizationId = :organizationId', { organizationId })
      .orderBy('request.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (query.prospectId) {
      qb.andWhere('request.prospectId = :prospectId', {
        prospectId: query.prospectId,
      });
    }

    if (query.requestedByUserId) {
      qb.andWhere('request.requestedByUserId = :requestedByUserId', {
        requestedByUserId: query.requestedByUserId,
      });
    }

    return qb.getMany();
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<ProspectDeleteRequestEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { prospect: true, requestedBy: true, reviewedBy: true },
    });
  }

  findPendingByProspectId(
    prospectId: string,
    organizationId: string,
  ): Promise<ProspectDeleteRequestEntity | null> {
    return this.repository.findOne({
      where: { prospectId, organizationId, status: 'pending' },
      relations: { requestedBy: true, prospect: true },
    });
  }

  create(
    data: Partial<ProspectDeleteRequestEntity>,
  ): ProspectDeleteRequestEntity {
    return this.repository.create(data);
  }

  save(
    entity: ProspectDeleteRequestEntity,
  ): Promise<ProspectDeleteRequestEntity> {
    return this.repository.save(entity);
  }

  async cancelPendingByProspectId(
    prospectId: string,
    organizationId: string,
  ): Promise<void> {
    await this.repository.update(
      { prospectId, organizationId, status: 'pending' },
      { status: 'cancelled' },
    );
  }

  countPendingByOrganizationId(organizationId: string): Promise<number> {
    return this.repository.count({
      where: { organizationId, status: 'pending' },
    });
  }

  countRaisedByUserId(
    organizationId: string,
    requestedByUserId: string,
    status?: ProspectDeleteRequestStatus,
  ): Promise<number> {
    return this.repository.count({
      where: {
        organizationId,
        requestedByUserId,
        ...(status ? { status } : {}),
      },
    });
  }

  async approveAndDeleteProspect(
    requestId: string,
    prospectId: string,
    organizationId: string,
    reviewedByUserId: string,
  ): Promise<ProspectDeleteRequestEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(ProspectDeleteRequestEntity);
      const request = await requestRepo.findOne({
        where: { id: requestId, organizationId, status: 'pending' },
        relations: { prospect: true, requestedBy: true, reviewedBy: true },
      });

      if (!request) {
        return null;
      }

      request.status = 'approved';
      request.reviewedByUserId = reviewedByUserId;
      request.reviewedAt = new Date();

      if (request.prospect) {
        request.prospectFullName = request.prospect.fullName;
        request.prospectEmail = request.prospect.email;
      }

      await requestRepo.save(request);

      const deleteResult = await manager
        .getRepository(ProspectEntity)
        .delete({ id: prospectId, organizationId });

      if (!deleteResult.affected) {
        throw new Error('Prospect delete failed after approval update');
      }

      return requestRepo.findOne({
        where: { id: requestId, organizationId },
        relations: { prospect: true, requestedBy: true, reviewedBy: true },
      });
    });
  }
}
