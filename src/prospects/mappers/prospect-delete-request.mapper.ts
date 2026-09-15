import { Injectable } from '@nestjs/common';
import { ProspectDeleteRequestEntity } from '../entities/prospect-delete-request.entity';

export interface ProspectDeleteRequestResponse {
  id: string;
  prospectId: string | null;
  prospectFullName: string;
  prospectEmail: string;
  reason: string;
  status: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByEmail: string;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProspectDeleteRequestMapper {
  toResponse(
    entity: ProspectDeleteRequestEntity,
  ): ProspectDeleteRequestResponse {
    return {
      id: entity.id,
      prospectId: entity.prospectId,
      prospectFullName:
        entity.prospectFullName || entity.prospect?.fullName || '',
      prospectEmail: entity.prospectEmail || entity.prospect?.email || '',
      reason: entity.reason,
      status: entity.status,
      requestedByUserId: entity.requestedByUserId,
      requestedByName: this.formatUserName(entity.requestedBy),
      requestedByEmail: entity.requestedBy?.email ?? '',
      reviewedByUserId: entity.reviewedByUserId,
      reviewedByName: entity.reviewedBy
        ? this.formatUserName(entity.reviewedBy)
        : null,
      reviewNote: entity.reviewNote,
      reviewedAt: entity.reviewedAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toResponseList(
    entities: ProspectDeleteRequestEntity[],
  ): ProspectDeleteRequestResponse[] {
    return entities.map((entity) => this.toResponse(entity));
  }

  private formatUserName(
    user?: { username: string | null; email: string } | null,
  ): string {
    if (!user) {
      return 'Unknown user';
    }

    if (user.username?.trim()) {
      return user.username.trim();
    }

    return user.email;
  }
}
