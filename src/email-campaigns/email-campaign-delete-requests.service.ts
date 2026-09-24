import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { hasPermission } from '../auth/auth-access.utils';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type {
  CreateEmailCampaignDeleteRequestDto,
  EmailCampaignDeleteRequestsQueryDto,
  RejectEmailCampaignDeleteRequestDto,
} from './dto/email-campaign-delete-request.dto';
import { EmailCampaignDeleteRequestEntity } from './entities/email-campaign-delete-request.entity';
import type { EmailCampaignDeleteRequestResponse } from './mappers/email-campaign-delete-request.mapper';
import { EmailCampaignDeleteRequestMapper } from './mappers/email-campaign-delete-request.mapper';
import { EmailCampaignDeleteRequestsRepository } from './email-campaign-delete-requests.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';

@Injectable()
export class EmailCampaignDeleteRequestsService {
  constructor(
    private readonly deleteRequestsRepository: EmailCampaignDeleteRequestsRepository,
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly deleteRequestMapper: EmailCampaignDeleteRequestMapper,
  ) {}

  async create(
    dto: CreateEmailCampaignDeleteRequestDto,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<EmailCampaignDeleteRequestResponse> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        dto.campaignId,
        resolvedOrganizationId,
      );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const existingPending =
      await this.deleteRequestsRepository.findPendingByCampaignId(
        dto.campaignId,
        resolvedOrganizationId,
      );

    if (existingPending) {
      throw new ConflictException(
        'A pending delete request already exists for this campaign',
      );
    }

    const request = this.deleteRequestsRepository.create({
      organizationId: resolvedOrganizationId,
      campaignId: dto.campaignId,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      reason: dto.reason.trim(),
      status: 'pending',
      requestedByUserId: user.id,
    });

    const saved = await this.deleteRequestsRepository.save(request);
    const loaded =
      await this.deleteRequestsRepository.findByIdAndOrganizationId(
        saved.id,
        resolvedOrganizationId,
      );

    if (!loaded) {
      throw new NotFoundException('Delete request not found');
    }

    return this.deleteRequestMapper.toResponse(loaded);
  }

  async findAll(
    query: EmailCampaignDeleteRequestsQueryDto,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<EmailCampaignDeleteRequestResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const canApprove = hasPermission(user, 'email-campaigns:approve-delete');

    const requests = await this.deleteRequestsRepository.findByOrganizationId(
      resolvedOrganizationId,
      {
        status: query.status,
        campaignId: query.campaignId,
        requestedByUserId: canApprove ? undefined : user.id,
      },
    );

    return this.deleteRequestMapper.toResponseList(requests);
  }

  async approve(
    id: string,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<EmailCampaignDeleteRequestResponse> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const request = await this.requirePendingRequest(
      id,
      resolvedOrganizationId,
    );

    if (!request.campaignId) {
      throw new BadRequestException(
        'Delete request is not linked to a campaign',
      );
    }

    let approved: EmailCampaignDeleteRequestEntity | null;

    try {
      approved = await this.deleteRequestsRepository.approveAndDeleteCampaign(
        request.id,
        request.campaignId,
        resolvedOrganizationId,
        user.id,
      );
    } catch {
      throw new NotFoundException('Campaign not found');
    }

    if (!approved) {
      throw new NotFoundException('Delete request not found');
    }

    return this.deleteRequestMapper.toResponse(approved);
  }

  async reject(
    id: string,
    dto: RejectEmailCampaignDeleteRequestDto,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<EmailCampaignDeleteRequestResponse> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const request = await this.requirePendingRequest(
      id,
      resolvedOrganizationId,
    );

    request.status = 'rejected';
    request.reviewedByUserId = user.id;
    request.reviewedAt = new Date();
    request.reviewNote = dto.reviewNote?.trim() || null;

    const saved = await this.deleteRequestsRepository.save(request);
    return this.deleteRequestMapper.toResponse(saved);
  }

  async cancel(
    id: string,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<EmailCampaignDeleteRequestResponse> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const request = await this.requirePendingRequest(
      id,
      resolvedOrganizationId,
    );

    if (request.requestedByUserId !== user.id) {
      throw new ForbiddenException(
        'Only the requester can cancel this delete request',
      );
    }

    request.status = 'cancelled';
    const saved = await this.deleteRequestsRepository.save(request);
    return this.deleteRequestMapper.toResponse(saved);
  }

  async cancelPendingForCampaign(
    campaignId: string,
    organizationId: string,
  ): Promise<void> {
    await this.deleteRequestsRepository.cancelPendingByCampaignId(
      campaignId,
      organizationId,
    );
  }

  async countPending(
    user: AuthUser,
    organizationId: string | null,
  ): Promise<number> {
    const summary = await this.getSummaryCounts(user, organizationId);
    return summary.pendingReviewCount;
  }

  async getSummaryCounts(
    user: AuthUser,
    organizationId: string | null,
  ): Promise<{
    pendingReviewCount: number;
    myRaisedCount: number;
    myRaisedPendingCount: number;
  }> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const canApprove = hasPermission(user, 'email-campaigns:approve-delete');
    const canRequest = hasPermission(user, 'email-campaigns:request-delete');

    const [pendingReviewCount, myRaisedCount, myRaisedPendingCount] =
      await Promise.all([
        canApprove
          ? this.deleteRequestsRepository.countPendingByOrganizationId(
              resolvedOrganizationId,
            )
          : Promise.resolve(0),
        canRequest
          ? this.deleteRequestsRepository.countRaisedByUserId(
              resolvedOrganizationId,
              user.id,
            )
          : Promise.resolve(0),
        canRequest
          ? this.deleteRequestsRepository.countRaisedByUserId(
              resolvedOrganizationId,
              user.id,
              'pending',
            )
          : Promise.resolve(0),
      ]);

    return {
      pendingReviewCount,
      myRaisedCount,
      myRaisedPendingCount,
    };
  }

  private async requirePendingRequest(id: string, organizationId: string) {
    const request =
      await this.deleteRequestsRepository.findByIdAndOrganizationId(
        id,
        organizationId,
      );

    if (!request) {
      throw new NotFoundException('Delete request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Delete request is not pending');
    }

    return request;
  }
}
