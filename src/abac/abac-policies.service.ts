import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { AuthUser } from '../auth/auth.types';
import {
  USERS_REPOSITORY,
  type UsersRepositoryPort,
} from '../users/users.repository.port';
import { AbacPoliciesRepository } from './abac-policies.repository';
import type {
  AbacPolicyConditions,
  AbacPolicyDetailDto,
  AbacPolicyListItemDto,
  BulkAssignAbacPoliciesResultDto,
  UserAbacPolicySummaryDto,
} from './abac.types';
import {
  BulkAssignAbacPoliciesDto,
  BulkAssignAbacPoliciesMode,
} from './dto/bulk-assign-abac-policies.dto';
import { CreateAbacPolicyDto } from './dto/create-abac-policy.dto';
import { UpdateAbacPolicyDto } from './dto/update-abac-policy.dto';
import { AbacPolicyEntity } from './entities/abac-policy.entity';
import { UserAbacPoliciesRepository } from './user-abac-policies.repository';

@Injectable()
export class AbacPoliciesService {
  constructor(
    private readonly abacPoliciesRepository: AbacPoliciesRepository,
    private readonly userAbacPoliciesRepository: UserAbacPoliciesRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
  ) {}

  async findAll(
    organizationId: string | null,
  ): Promise<AbacPolicyListItemDto[]> {
    const policies = await this.abacPoliciesRepository.findAllByOrganizationId(
      requireOrganizationId(organizationId),
    );
    return policies.map((policy) => this.toListItemDto(policy));
  }

  async findOne(
    organizationId: string | null,
    id: string,
  ): Promise<AbacPolicyDetailDto> {
    const policy = await this.abacPoliciesRepository.findByIdAndOrganizationId(
      id,
      requireOrganizationId(organizationId),
    );

    if (!policy) {
      throw new NotFoundException(`ABAC policy ${id} not found`);
    }

    return this.toDetailDto(policy);
  }

  async create(
    organizationId: string | null,
    dto: CreateAbacPolicyDto,
  ): Promise<AbacPolicyDetailDto> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const existing =
      await this.abacPoliciesRepository.findByNameAndOrganizationId(
        dto.name.trim(),
        resolvedOrganizationId,
      );

    if (existing) {
      throw new ConflictException(
        `ABAC policy with name "${dto.name}" already exists`,
      );
    }

    if (dto.userIds?.length) {
      await this.validateUserIds(dto.userIds);
    }

    const policy = this.abacPoliciesRepository.create({
      organizationId: resolvedOrganizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      resource: dto.resource.trim(),
      action: dto.action.trim(),
      effect: dto.effect,
      isEnabled: dto.isEnabled ?? true,
      conditions: dto.conditions ?? {},
    });

    const saved = await this.abacPoliciesRepository.save(policy);

    if (dto.userIds?.length) {
      await this.userAbacPoliciesRepository.replaceUsersForPolicy(
        saved.id,
        dto.userIds,
      );
    }

    return this.findOne(resolvedOrganizationId, saved.id);
  }

  async update(
    organizationId: string | null,
    id: string,
    dto: UpdateAbacPolicyDto,
  ): Promise<AbacPolicyDetailDto> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const policy = await this.abacPoliciesRepository.findByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!policy) {
      throw new NotFoundException(`ABAC policy ${id} not found`);
    }

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing =
        await this.abacPoliciesRepository.findByNameAndOrganizationId(
          trimmedName,
          resolvedOrganizationId,
        );

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `ABAC policy with name "${dto.name}" already exists`,
        );
      }

      policy.name = trimmedName;
    }

    if (dto.description !== undefined) {
      policy.description = dto.description?.trim() ?? null;
    }

    if (dto.resource !== undefined) {
      policy.resource = dto.resource.trim();
    }

    if (dto.action !== undefined) {
      policy.action = dto.action.trim();
    }

    if (dto.effect !== undefined) {
      policy.effect = dto.effect;
    }

    if (dto.isEnabled !== undefined) {
      policy.isEnabled = dto.isEnabled;
    }

    if (dto.conditions !== undefined) {
      policy.conditions = dto.conditions;
    }

    if (dto.userIds !== undefined) {
      await this.validateUserIds(dto.userIds);
    }

    await this.abacPoliciesRepository.save(policy);

    if (dto.userIds !== undefined) {
      await this.userAbacPoliciesRepository.replaceUsersForPolicy(
        id,
        dto.userIds,
      );
    }

    return this.findOne(resolvedOrganizationId, id);
  }

  async remove(organizationId: string | null, id: string): Promise<void> {
    const policy = await this.abacPoliciesRepository.findByIdAndOrganizationId(
      id,
      requireOrganizationId(organizationId),
    );

    if (!policy) {
      throw new NotFoundException(`ABAC policy ${id} not found`);
    }

    await this.abacPoliciesRepository.remove(policy);
  }

  async findPoliciesForUser(
    userId: string,
  ): Promise<UserAbacPolicySummaryDto[]> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const assignments =
      await this.userAbacPoliciesRepository.findByUserId(userId);

    return assignments.map((assignment) => ({
      id: assignment.policy.id,
      name: assignment.policy.name,
      resource: assignment.policy.resource,
      action: assignment.policy.action,
      effect: assignment.policy.effect,
      isEnabled: assignment.policy.isEnabled,
    }));
  }

  async bulkAssignPolicies(
    organizationId: string | null,
    dto: BulkAssignAbacPoliciesDto,
  ): Promise<BulkAssignAbacPoliciesResultDto> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    await this.validateUserIds(dto.userIds);
    await this.validatePolicyIds(resolvedOrganizationId, dto.policyIds);

    const existingByUser =
      await this.userAbacPoliciesRepository.findPolicyIdsByUserIds(dto.userIds);

    const assignments: Array<{ userId: string; policyIds: string[] }> = [];
    let assignmentsCreated = 0;
    let assignmentsRemoved = 0;

    for (const userId of dto.userIds) {
      const existing = new Set(existingByUser.get(userId) ?? []);
      let finalPolicyIds: string[];

      if (dto.mode === BulkAssignAbacPoliciesMode.Add) {
        finalPolicyIds = [...new Set([...existing, ...dto.policyIds])];

        for (const policyId of dto.policyIds) {
          if (!existing.has(policyId)) {
            assignmentsCreated += 1;
          }
        }
      } else {
        finalPolicyIds = [...dto.policyIds];

        for (const policyId of existing) {
          if (!dto.policyIds.includes(policyId)) {
            assignmentsRemoved += 1;
          }
        }

        for (const policyId of dto.policyIds) {
          if (!existing.has(policyId)) {
            assignmentsCreated += 1;
          }
        }
      }

      assignments.push({ userId, policyIds: finalPolicyIds });
    }

    await this.userAbacPoliciesRepository.bulkReplaceForUsers(assignments);

    return {
      mode: dto.mode,
      affectedUsers: dto.userIds.length,
      assignmentsCreated,
      assignmentsRemoved,
    };
  }

  async assignPoliciesToUser(
    organizationId: string | null,
    userId: string,
    policyIds: string[],
  ): Promise<UserAbacPolicySummaryDto[]> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (policyIds.length > 0) {
      await this.validatePolicyIds(
        requireOrganizationId(organizationId),
        policyIds,
      );
    }

    await this.userAbacPoliciesRepository.replacePoliciesForUser(
      userId,
      policyIds,
    );

    return this.findPoliciesForUser(userId);
  }

  evaluateConditions(
    conditions: AbacPolicyConditions,
    user: AuthUser,
  ): boolean {
    if (conditions.hierarchyLevel) {
      const { min, max } = conditions.hierarchyLevel;

      if (min !== undefined && user.hierarchyLevel < min) {
        return false;
      }

      if (max !== undefined && user.hierarchyLevel > max) {
        return false;
      }
    }

    if (conditions.roleSlugs?.length) {
      const userSlugs = new Set(user.roles.map((role) => role.slug));
      const hasRole = conditions.roleSlugs.some((slug) => userSlugs.has(slug));

      if (!hasRole) {
        return false;
      }
    }

    if (conditions.status !== undefined) {
      if (user.status !== conditions.status) {
        return false;
      }
    }

    return true;
  }

  private async validateUserIds(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const user = await this.usersRepository.findById(userId);

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
    }
  }

  private async validatePolicyIds(
    organizationId: string | null,
    policyIds: string[],
  ): Promise<void> {
    for (const policyId of policyIds) {
      const policy = organizationId
        ? await this.abacPoliciesRepository.findByIdAndOrganizationId(
            policyId,
            organizationId,
          )
        : null;

      if (!policy) {
        throw new NotFoundException(`ABAC policy ${policyId} not found`);
      }
    }
  }

  private toListItemDto(policy: AbacPolicyEntity): AbacPolicyListItemDto {
    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      resource: policy.resource,
      action: policy.action,
      effect: policy.effect,
      isEnabled: policy.isEnabled,
      assignedUserCount: policy.userAbacPolicies?.length ?? 0,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
  }

  private toDetailDto(policy: AbacPolicyEntity): AbacPolicyDetailDto {
    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      resource: policy.resource,
      action: policy.action,
      effect: policy.effect,
      isEnabled: policy.isEnabled,
      conditions: policy.conditions ?? {},
      assignedUsers: (policy.userAbacPolicies ?? []).map((assignment) => ({
        id: assignment.user.id,
        email: assignment.user.email,
        username: assignment.user.username,
      })),
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
  }
}
