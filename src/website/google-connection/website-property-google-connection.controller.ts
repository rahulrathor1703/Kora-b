import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
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
import { AssignGoogleConnectionDto } from '../dto/website-google-connection.dto';
import { WebsiteGoogleConnectionOAuthService } from './website-google-connection-oauth.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('website/properties/:propertyId/google-connection')
export class WebsitePropertyGoogleConnectionController {
  constructor(
    private readonly oauthService: WebsiteGoogleConnectionOAuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  getConnection(
    @Param('propertyId') propertyId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    return this.oauthService.getConnection(propertyId, resolvedOrganizationId);
  }

  @Put()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  assignConnection(
    @Param('propertyId') propertyId: string,
    @Body() dto: AssignGoogleConnectionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    return this.oauthService.assignConnectionToProperty(
      propertyId,
      resolvedOrganizationId,
      dto.connectionId,
    );
  }

  @Delete()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  disconnect(
    @Param('propertyId') propertyId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    return this.oauthService.disconnect(propertyId, resolvedOrganizationId);
  }

  @Get('oauth/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  async startOAuth(
    @Param('propertyId') propertyId: string,
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

    const url = await this.oauthService.buildPropertyAuthorizeUrl({
      userId: user.id,
      organizationSlug,
      organizationId: resolvedOrganizationId,
      websitePropertyId: propertyId,
      oauthAppId: oauthAppId?.trim() || undefined,
    });

    res.redirect(url);
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
