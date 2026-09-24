import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { runWithOrganizationContext } from '../../common/organization/organization.context';
import { OrganizationsService } from '../../organizations/organizations.service';
import { UserRole } from '../../users/entities/user.entity';
import { isSuperAdmin } from '../auth-access.utils';
import type { AuthUserProfile } from '../auth.service';
import { ANY_PERMISSIONS_KEY } from '../decorators/require-any-permissions.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
  organizationId?: string | null;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!anyPermissions || anyPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (isSuperAdmin(user)) {
      return true;
    }

    if (anyPermissions && anyPermissions.length > 0) {
      const hasAnyPermission = anyPermissions.some((permission) =>
        user.permissions.includes(permission),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException('Insufficient permissions');
      }

      return true;
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

export const ORGANIZATION_ID_HEADER = 'x-organization-id';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly organizationsService: OrganizationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return true;
    }

    let organizationId: string | null = null;

    if (user.role === UserRole.SUPERADMIN) {
      const headerValue = request.headers[ORGANIZATION_ID_HEADER];
      const requestedOrganizationId = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue;

      organizationId = requestedOrganizationId ?? null;

      if (organizationId) {
        const organization =
          await this.organizationsService.findById(organizationId);

        if (!organization) {
          throw new ForbiddenException('Organization not found');
        }

        if (organization.status === 'suspended') {
          throw new ForbiddenException('Organization is suspended');
        }
      }
    } else {
      if (!user.organization) {
        throw new ForbiddenException('No organization membership found');
      }

      if (user.organization.status === 'suspended') {
        throw new ForbiddenException(
          'Your organization has been suspended. Contact support.',
        );
      }

      organizationId = user.organization.id;
    }

    request.organizationId = organizationId;

    return runWithOrganizationContext(
      {
        organizationId,
        isSuperAdmin: user.role === UserRole.SUPERADMIN,
      },
      () => true,
    );
  }
}
