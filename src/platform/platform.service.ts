import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUserProfile } from '../auth/auth.service';
import { hasPermission } from '../auth/auth-access.utils';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OrgEntitlementsService } from '../org-entitlements/org-entitlements.service';
import type { OrgEntitlementsSnapshot } from '../org-entitlements/types/org-entitlements.types';
import type { OrgLimitsMap } from '../org-entitlements/types/org-entitlements.types';
import type { OrgModule } from '../org-entitlements/org-entitlements.registry';
import {
  ORGANIZATIONS_REPOSITORY,
  type OrganizationsRepositoryPort,
} from '../organizations/organizations.repository.port';
import type {
  ImpersonateTenantResponseDto,
  TenantDetailResponseDto,
  TenantListItemDto,
} from './dto/tenant-list-item.dto';

@Injectable()
export class PlatformService {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly organizationsRepository: OrganizationsRepositoryPort,
    private readonly auditLogsService: AuditLogsService,
    private readonly orgEntitlementsService: OrgEntitlementsService,
  ) {}

  async listTenants(): Promise<TenantListItemDto[]> {
    const organizations =
      await this.organizationsRepository.findAllWithMemberCount();

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      memberCount: organization.memberCount,
    }));
  }

  async getTenantById(id: string): Promise<TenantDetailResponseDto> {
    const organization = await this.organizationsRepository.findById(id);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const memberCount =
      await this.organizationsRepository.countMembersByOrganizationId(
        organization.id,
      );

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      memberCount,
    };
  }

  async startImpersonation(
    organizationId: string,
    actor: AuthUserProfile,
  ): Promise<ImpersonateTenantResponseDto> {
    this.assertCanImpersonate(actor);

    const organization =
      await this.organizationsRepository.findById(organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.status === 'suspended') {
      throw new ForbiddenException('Organization is suspended');
    }

    this.auditLogsService.recordAsync({
      organizationId: organization.id,
      actorUserId: actor.id,
      actorName: actor.username ?? actor.email,
      actorEmail: actor.email,
      module: 'platform',
      action: 'other',
      httpMethod: 'POST',
      requestPath: `/platform/impersonate/${organization.id}`,
      statusCode: 200,
      message: `${actor.email} started platform impersonation for ${organization.name}`,
      resourceType: 'organization',
      resourceId: organization.id,
    });

    return {
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
    };
  }

  async getTenantEntitlements(id: string): Promise<OrgEntitlementsSnapshot> {
    await this.getTenantById(id);
    return this.orgEntitlementsService.getSnapshot(id);
  }

  async updateTenantEntitlements(
    id: string,
    input: {
      enabledModules?: OrgModule[];
      platformCaps?: OrgLimitsMap;
    },
  ): Promise<OrgEntitlementsSnapshot> {
    await this.getTenantById(id);
    return this.orgEntitlementsService.updatePlatformEntitlements(id, input);
  }

  stopImpersonation(
    actor: AuthUserProfile,
    organizationId?: string | null,
  ): void {
    this.assertCanImpersonate(actor);

    this.auditLogsService.recordAsync({
      organizationId: organizationId ?? null,
      actorUserId: actor.id,
      actorName: actor.username ?? actor.email,
      actorEmail: actor.email,
      module: 'platform',
      action: 'other',
      httpMethod: 'DELETE',
      requestPath: '/platform/impersonate',
      statusCode: 204,
      message: `${actor.email} exited platform impersonation`,
      resourceType: organizationId ? 'organization' : null,
      resourceId: organizationId ?? null,
    });
  }

  private assertCanImpersonate(actor: AuthUserProfile): void {
    if (!hasPermission(actor, 'platform:impersonate')) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
