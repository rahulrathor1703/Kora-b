import {
  Controller,
  Get,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AbacGuard } from '../../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../../auth/guards/permissions.guard';
import { requireOrganizationId } from '../../common/organization/require-organization-id';
import { WebsiteGoogleConnectionOAuthService } from './website-google-connection-oauth.service';

@Controller('website/google-connection')
export class WebsiteGoogleConnectionController {
  constructor(
    private readonly oauthService: WebsiteGoogleConnectionOAuthService,
  ) {}

  @Get('availability')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  availability(@CurrentOrganizationId() organizationId: string | null) {
    return this.oauthService.getAvailability(
      requireOrganizationId(organizationId),
    );
  }

  @Get('oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing Google OAuth response');
    }

    await this.oauthService.handleCallback(code, state, res);
  }
}
