import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AbacGuard } from '../../abac/abac-evaluation.service';
import type { AuthUserProfile } from '../../auth/auth.service';
import { CurrentOrganizationId } from '../../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RequireAnyPermissions } from '../../auth/decorators/require-any-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../../auth/guards/permissions.guard';
import { requireOrganizationId } from '../../common/organization/require-organization-id';
import { WebsiteGoogleConnectionOAuthService } from './website-google-connection-oauth.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('website/google-connections')
export class OrganizationGoogleConnectionController {
  constructor(
    private readonly oauthService: WebsiteGoogleConnectionOAuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  listConnections(
    @CurrentOrganizationId() organizationId: string | null,
    @Query('oauthAppId') oauthAppId?: string,
  ) {
    return this.oauthService.listOrganizationConnections(
      requireOrganizationId(organizationId),
      oauthAppId?.trim() || undefined,
    );
  }

  @Get('oauth/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  async startOAuth(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string | undefined,
    @Query('oauthAppId') oauthAppId: string | undefined,
    @CurrentOrganizationId() organizationId: string | null,
    @Res() res: Response,
  ) {
    const user = this.requireUser(req);
    const organizationSlug = this.resolveOrganizationSlug(req, orgSlug);
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    if (!organizationSlug) {
      throw new UnauthorizedException();
    }

    const url = await this.oauthService.buildOrgAuthorizeUrl({
      userId: user.id,
      organizationSlug,
      organizationId: resolvedOrganizationId,
      oauthAppId: oauthAppId?.trim() || undefined,
    });

    res.redirect(url);
  }

  @Delete(':connectionId')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  deleteConnection(
    @Param('connectionId') connectionId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.oauthService.deleteOrganizationConnection(
      connectionId,
      requireOrganizationId(organizationId),
    );
  }

  private requireUser(req: AuthenticatedRequest): AuthUserProfile {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }

  private resolveOrganizationSlug(
    req: AuthenticatedRequest,
    orgSlug?: string,
  ): string | null {
    if (orgSlug?.trim()) {
      return orgSlug.trim();
    }

    return req.user?.organization?.slug ?? null;
  }
}
