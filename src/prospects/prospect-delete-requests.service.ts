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
  CreateProspectDeleteRequestDto,
  ProspectDeleteRequestsQueryDto,
  RejectProspectDeleteRequestDto,
} from './dto/prospect-delete-request.dto';
import { ProspectDeleteRequestEntity } from './entities/prospect-delete-request.entity';
import type { ProspectDeleteRequestResponse } from './mappers/prospect-delete-request.mapper';
import { ProspectDeleteRequestMapper } from './mappers/prospect-delete-request.mapper';
import { ProspectDeleteRequestsRepository } from './prospect-delete-requests.repository';
import { ProspectsRepository } from './prospects.repository';

@Injectable()
export class ProspectDeleteRequestsService {
  constructor(
    private readonly deleteRequestsRepository: ProspectDeleteRequestsRepository,
    private readonly prospectsRepository: ProspectsRepository,
    private readonly deleteRequestMapper: ProspectDeleteRequestMapper,
  ) {}

  async create(
    dto: CreateProspectDeleteRequestDto,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<ProspectDeleteRequestResponse> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const prospect = await this.prospectsRepository.findProspectById(
      dto.prospectId,
      resolvedOrganizationId,
    );

    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    const existingPending =
      await this.deleteRequestsRepository.findPendingByProspectId(
        dto.prospectId,
        resolvedOrganizationId,
      );

    if (existingPending) {
      throw new ConflictException(
        'A pending delete request already exists for this prospect',
      );
    }

    const request = this.deleteRequestsRepository.create({
      organizationId: resolvedOrganizationId,
      prospectId: dto.prospectId,
      prospectFullName: prospect.fullName,
      prospectEmail: prospect.email,
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
    query: ProspectDeleteRequestsQueryDto,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<ProspectDeleteRequestResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const canApprove = hasPermission(user, 'prospects:approve-delete');

    const requests = await this.deleteRequestsRepository.findByOrganizationId(
      resolvedOrganizationId,
      {
        status: query.status,
        prospectId: query.prospectId,
        requestedByUserId: canApprove ? undefined : user.id,
      },
    );

    return this.deleteRequestMapper.toResponseList(requests);
  }

  async approve(
    id: string,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<ProspectDeleteRequestResponse> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? user.organizationId,
    );

    const request = await this.requirePendingRequest(
      id,
      resolvedOrganizationId,
    );

    if (!request.prospectId) {
      throw new BadRequestException(
        'Delete request is not linked to a prospect',
      );
    }

    let approved: ProspectDeleteRequestEntity | null;

    try {
      approved = await this.deleteRequestsRepository.approveAndDeleteProspect(
        request.id,
        request.prospectId,
        resolvedOrganizationId,
        user.id,
      );
    } catch {
      throw new NotFoundException('Prospect not found');
    }

    if (!approved) {
      throw new NotFoundException('Delete request not found');
    }

    return this.deleteRequestMapper.toResponse(approved);
  }

  async reject(
    id: string,
    dto: RejectProspectDeleteRequestDto,
    user: AuthUser,
    organizationId: string | null,
  ): Promise<ProspectDeleteRequestResponse> {
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
  ): Promise<ProspectDeleteRequestResponse> {
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

  async cancelPendingForProspect(
    prospectId: string,
    organizationId: string,
  ): Promise<void> {
    await this.deleteRequestsRepository.cancelPendingByProspectId(
      prospectId,
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

    const canApprove = hasPermission(user, 'prospects:approve-delete');
    const canRequest = hasPermission(user, 'prospects:request-delete');

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
