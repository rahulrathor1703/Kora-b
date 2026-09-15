import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUserProfile } from '../../auth/auth.service';
import { MODULE_KEY } from '../decorators/require-module.decorator';
import type { OrgModule } from '../org-entitlements.registry';
import { OrgEntitlementsService } from '../org-entitlements.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
  organizationId?: string | null;
}

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly orgEntitlementsService: OrgEntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<
      OrgModule | undefined
    >(MODULE_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException();
    }

    const organizationId = request.organizationId;

    if (!organizationId) {
      return true;
    }

    await this.orgEntitlementsService.assertModuleEnabled(
      organizationId,
      requiredModule,
    );

    return true;
  }
}
