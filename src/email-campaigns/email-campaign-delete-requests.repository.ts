import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  EmailCampaignDeleteRequestEntity,
  type EmailCampaignDeleteRequestStatus,
} from './entities/email-campaign-delete-request.entity';
import { EmailCampaignEntity } from './entities/email-campaign.entity';

export interface EmailCampaignDeleteRequestsQuery {
  status?: EmailCampaignDeleteRequestStatus;
  campaignId?: string;
  requestedByUserId?: string;
}

@Injectable()
export class EmailCampaignDeleteRequestsRepository {
  constructor(
    @InjectRepository(EmailCampaignDeleteRequestEntity)
    private readonly repository: Repository<EmailCampaignDeleteRequestEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findByOrganizationId(
    organizationId: string,
    query: EmailCampaignDeleteRequestsQuery = {},
  ): Promise<EmailCampaignDeleteRequestEntity[]> {
    const qb = this.repository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.campaign', 'campaign')
      .leftJoinAndSelect('request.requestedBy', 'requestedBy')
      .leftJoinAndSelect('request.reviewedBy', 'reviewedBy')
      .where('request.organizationId = :organizationId', { organizationId })
      .orderBy('request.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (query.campaignId) {
      qb.andWhere('request.campaignId = :campaignId', {
        campaignId: query.campaignId,
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
  ): Promise<EmailCampaignDeleteRequestEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { campaign: true, requestedBy: true, reviewedBy: true },
    });
  }

  findPendingByCampaignId(
    campaignId: string,
    organizationId: string,
  ): Promise<EmailCampaignDeleteRequestEntity | null> {
    return this.repository.findOne({
      where: { campaignId, organizationId, status: 'pending' },
      relations: { requestedBy: true, campaign: true },
    });
  }

  create(
    data: Partial<EmailCampaignDeleteRequestEntity>,
  ): EmailCampaignDeleteRequestEntity {
    return this.repository.create(data);
  }

  save(
    entity: EmailCampaignDeleteRequestEntity,
  ): Promise<EmailCampaignDeleteRequestEntity> {
    return this.repository.save(entity);
  }

  async cancelPendingByCampaignId(
    campaignId: string,
    organizationId: string,
  ): Promise<void> {
    await this.repository.update(
      { campaignId, organizationId, status: 'pending' },
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
    status?: EmailCampaignDeleteRequestStatus,
  ): Promise<number> {
    return this.repository.count({
      where: {
        organizationId,
        requestedByUserId,
        ...(status ? { status } : {}),
      },
    });
  }

  async approveAndDeleteCampaign(
    requestId: string,
    campaignId: string,
    organizationId: string,
    reviewedByUserId: string,
  ): Promise<EmailCampaignDeleteRequestEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(
        EmailCampaignDeleteRequestEntity,
      );
      const request = await requestRepo.findOne({
        where: { id: requestId, organizationId, status: 'pending' },
        relations: { campaign: true, requestedBy: true, reviewedBy: true },
      });

      if (!request) {
        return null;
      }

      request.status = 'approved';
      request.reviewedByUserId = reviewedByUserId;
      request.reviewedAt = new Date();

      if (request.campaign) {
        request.campaignName = request.campaign.name;
        request.campaignStatus = request.campaign.status;
      }

      await requestRepo.save(request);

      const deleteResult = await manager
        .getRepository(EmailCampaignEntity)
        .delete({ id: campaignId, organizationId });

      if (!deleteResult.affected) {
        throw new Error('Campaign delete failed after approval update');
      }

      return requestRepo.findOne({
        where: { id: requestId, organizationId },
        relations: { campaign: true, requestedBy: true, reviewedBy: true },
      });
    });
  }
}
