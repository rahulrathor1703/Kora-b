import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OrgEntitlementsService } from '../org-entitlements/org-entitlements.service';
import { UserRole, type User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { UserRolesRepository } from '../rbac/user-roles.repository';
import type {
  AuthUser,
  AuthUserOrganization,
  AuthUserProfile,
  AuthUserRole,
  JwtPayload,
} from './auth.types';

export type { AuthUser, AuthUserProfile, AuthUserOrganization, AuthUserRole };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userRolesRepository: UserRolesRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly orgEntitlementsService: OrgEntitlementsService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    if (user.status === 'disabled') {
      return null;
    }

    if (!user.passwordHash) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return null;
    }

    return this.buildAuthUser(user);
  }

  async login(user: AuthUser): Promise<{ accessToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async hashPassword(password: string): Promise<string> {
    const rounds = this.config.get<number>('bcrypt.rounds') ?? 12;
    return bcrypt.hash(password, rounds);
  }

  async createUser(
    email: string,
    password: string,
    role: UserRole = UserRole.ADMIN,
  ): Promise<AuthUser> {
    const passwordHash = await this.hashPassword(password);
    const user = await this.usersService.create(email, passwordHash, role);

    return this.buildAuthUser(user);
  }

  validateJwtPayload(payload: JwtPayload): AuthUser {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      username: null,
      hierarchyLevel: 1,
      status: 'active',
      onboardingStep: 0,
      permissions: [],
      roles: [],
      organizationId: payload.organizationId ?? null,
      organization: null,
    };
  }

  async resolveAuthUser(userId: string): Promise<AuthUserProfile> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === 'disabled') {
      throw new UnauthorizedException('User account is disabled');
    }

    return this.buildAuthUser(user);
  }

  async getUserProfile(userId: string): Promise<AuthUserProfile> {
    return this.resolveAuthUser(userId);
  }

  async buildAuthUser(user: User): Promise<AuthUserProfile> {
    if (user.role === UserRole.SUPERADMIN) {
      return this.buildSuperAdminAuthUser(user);
    }

    return this.buildOrganizationAuthUser(user);
  }

  private async buildSuperAdminAuthUser(user: User): Promise<AuthUserProfile> {
    const permissions =
      await this.userRolesRepository.findPermissionKeysByUserId(user.id);
    const userRoles = await this.userRolesRepository.findByUserId(user.id);

    const roles: AuthUserRole[] = userRoles.map((userRole) => ({
      id: userRole.role.id,
      name: userRole.role.name,
      slug: userRole.role.slug,
    }));

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      hierarchyLevel: user.hierarchyLevel,
      status: user.status,
      onboardingStep: user.onboardingStep,
      permissions,
      roles,
      organizationId: null,
      organization: null,
    };
  }

  private async buildOrganizationAuthUser(
    user: User,
  ): Promise<AuthUserProfile> {
    const permissions =
      await this.userRolesRepository.findPermissionKeysByUserId(user.id);
    const userRoles = await this.userRolesRepository.findByUserId(user.id);

    const roles: AuthUserRole[] = userRoles.map((userRole) => ({
      id: userRole.role.id,
      name: userRole.role.name,
      slug: userRole.role.slug,
    }));

    const organization = user.organization
      ? await this.buildAuthOrganization(user.organization.id, {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          status: user.organization.status,
        })
      : null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      hierarchyLevel: user.hierarchyLevel,
      status: user.status,
      onboardingStep: user.onboardingStep,
      permissions,
      roles,
      organizationId: user.organizationId,
      organization,
    };
  }

  private async buildAuthOrganization(
    organizationId: string,
    base: Pick<AuthUserOrganization, 'id' | 'name' | 'slug' | 'status'>,
  ): Promise<AuthUserOrganization> {
    const entitlements =
      await this.orgEntitlementsService.getAuthSummary(organizationId);

    return {
      ...base,
      enabledModules: entitlements.enabledModules,
      limits: entitlements.limits,
    };
  }
}
