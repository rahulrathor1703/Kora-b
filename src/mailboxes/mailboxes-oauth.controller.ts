import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthUserProfile } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { MailboxesOAuthService } from './mailboxes-oauth.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('mailboxes/oauth')
export class MailboxesOAuthController {
  constructor(private readonly mailboxesOAuthService: MailboxesOAuthService) {}

  @Get('availability')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:read')
  availability() {
    return this.mailboxesOAuthService.getAvailability();
  }

  @Get('google/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:create')
  startGoogle(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string | undefined,
    @CurrentOrganizationId() organizationId: string | null,
    @Res() res: Response,
  ) {
    const organizationSlug = this.resolveOrganizationSlug(req, orgSlug);
    if (!req.user || !organizationId || !organizationSlug) {
      throw new UnauthorizedException();
    }

    const url = this.mailboxesOAuthService.buildGoogleAuthorizeUrl({
      organizationId,
      organizationSlug,
      userId: req.user.id,
    });

    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing Google OAuth response');
    }

    await this.mailboxesOAuthService.handleGoogleCallback(code, state, res);
  }

  @Get('microsoft/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:create')
  startMicrosoft(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string | undefined,
    @CurrentOrganizationId() organizationId: string | null,
    @Res() res: Response,
  ) {
    const organizationSlug = this.resolveOrganizationSlug(req, orgSlug);
    if (!req.user || !organizationId || !organizationSlug) {
      throw new UnauthorizedException();
    }

    const url = this.mailboxesOAuthService.buildMicrosoftAuthorizeUrl({
      organizationId,
      organizationSlug,
      userId: req.user.id,
    });

    res.redirect(url);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing Microsoft OAuth response');
    }

    await this.mailboxesOAuthService.handleMicrosoftCallback(code, state, res);
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
