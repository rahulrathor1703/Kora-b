import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { RolesRepository } from '../rbac/roles.repository';
import { UserRolesRepository } from '../rbac/user-roles.repository';
import { UserRole, type User } from './entities/user.entity';
import {
  UpdateTeamMemberDto,
  UpdateTeamMemberStatusDto,
} from './dto/update-team-member.dto';
import {
  USERS_REPOSITORY,
  type UsersRepositoryPort,
} from './users.repository.port';
import type { TeamMemberSummary } from './users.types';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    private readonly rolesRepository: RolesRepository,
    private readonly userRolesRepository: UserRolesRepository,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findByGoogleId(googleId);
  }

  findByAppleId(appleId: string): Promise<User | null> {
    return this.usersRepository.findByAppleId(appleId);
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  createEntity(data: Partial<User>): User {
    return this.usersRepository.createEntity(data);
  }

  create(
    email: string,
    passwordHash: string,
    role?: UserRole,
    organizationId?: string | null,
  ): Promise<User> {
    return this.usersRepository.create(
      email,
      passwordHash,
      role,
      organizationId,
    );
  }

  listAdmins() {
    return this.usersRepository.findAllByRole(UserRole.ADMIN);
  }

  updateRole(email: string, role: UserRole) {
    return this.usersRepository.updateRole(email, role);
  }

  async findAllTeamMembers(
    organizationId: string | null,
  ): Promise<TeamMemberSummary[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const members = await this.usersRepository.findByOrganizationId(
      resolvedOrganizationId,
    );

    const summaries = await Promise.all(
      members.map(async (member) => this.toTeamMemberSummary(member)),
    );

    return summaries;
  }

  async updateTeamMember(
    organizationId: string | null,
    id: string,
    dto: UpdateTeamMemberDto,
  ): Promise<TeamMemberSummary> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const user = await this.usersRepository.findById(id);

    if (!user || user.organizationId !== resolvedOrganizationId) {
      throw new NotFoundException('Team member not found');
    }

    if (dto.hierarchyLevel !== undefined) {
      user.hierarchyLevel = dto.hierarchyLevel;
      await this.usersRepository.save(user);
    }

    if (dto.roleId !== undefined) {
      const role = await this.rolesRepository.findById(dto.roleId);

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      if (role.slug === 'super-admin') {
        throw new ForbiddenException('Cannot assign super admin role');
      }

      await this.userRolesRepository.replaceRoleForUser(user.id, dto.roleId);
    }

    if (dto.roleId === undefined && dto.hierarchyLevel === undefined) {
      throw new BadRequestException('No updates provided');
    }

    const updated = await this.usersRepository.findById(id);
    if (!updated) {
      throw new NotFoundException('Team member not found');
    }

    return this.toTeamMemberSummary(updated);
  }

  async updateTeamMemberStatus(
    organizationId: string | null,
    id: string,
    dto: UpdateTeamMemberStatusDto,
  ): Promise<TeamMemberSummary> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const user = await this.usersRepository.findById(id);

    if (!user || user.organizationId !== resolvedOrganizationId) {
      throw new NotFoundException('Team member not found');
    }

    user.status = dto.status;
    await this.usersRepository.save(user);

    return this.toTeamMemberSummary(user);
  }

  private async toTeamMemberSummary(user: User): Promise<TeamMemberSummary> {
    const userRoles = await this.userRolesRepository.findByUserId(user.id);
    const primaryRole = userRoles[0]?.role;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      roleId: primaryRole?.id ?? null,
      roleName: primaryRole?.name ?? null,
      hierarchyLevel: user.hierarchyLevel,
      status: user.status,
      joinedAt: user.createdAt.toISOString(),
    };
  }
}
