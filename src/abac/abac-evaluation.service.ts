import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isSuperAdmin } from '../auth/auth-access.utils';
import { AuthUser } from '../auth/auth.types';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';
import { AbacPoliciesService } from './abac-policies.service';
import { UserAbacPoliciesRepository } from './user-abac-policies.repository';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Injectable()
export class AbacEvaluationService {
  constructor(
    private readonly userAbacPoliciesRepository: UserAbacPoliciesRepository,
    private readonly abacPoliciesService: AbacPoliciesService,
  ) {}

  async canAccess(
    user: AuthUser,
    resource: string,
    action: string,
  ): Promise<boolean> {
    if (isSuperAdmin(user)) {
      return true;
    }

    const assignments =
      await this.userAbacPoliciesRepository.findEnabledPoliciesByUserId(
        user.id,
      );

    const relevantPolicies = assignments
      .map((assignment) => assignment.policy)
      .filter(
        (policy) => policy.resource === resource && policy.action === action,
      );

    if (relevantPolicies.length === 0) {
      return true;
    }

    const denyPolicies = relevantPolicies.filter(
      (policy) => policy.effect === 'deny',
    );

    for (const policy of denyPolicies) {
      if (
        this.abacPoliciesService.evaluateConditions(policy.conditions, user)
      ) {
        return false;
      }
    }

    const allowPolicies = relevantPolicies.filter(
      (policy) => policy.effect === 'allow',
    );

    return allowPolicies.some((policy) =>
      this.abacPoliciesService.evaluateConditions(policy.conditions, user),
    );
  }
}

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abacEvaluationService: AbacEvaluationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    for (const permission of requiredPermissions) {
      const [resource, action] = permission.split(':');

      if (!resource || !action) {
        continue;
      }

      const allowed = await this.abacEvaluationService.canAccess(
        user,
        resource,
        action,
      );

      if (!allowed) {
        throw new ForbiddenException('Access denied by ABAC policy');
      }
    }

    return true;
  }
}
