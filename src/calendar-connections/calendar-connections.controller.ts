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
import { AbacGuard } from '../abac/abac-evaluation.service';
import type { AuthUserProfile } from '../auth/auth.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { CalendarConnectionsOAuthService } from './calendar-connections-oauth.service';
import { CalendarConnectionsService } from './calendar-connections.service';
import type { CalendarConnectionProvider } from './types/calendar-connection.types';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('calendar-connections')
export class CalendarConnectionsController {
  constructor(
    private readonly calendarConnectionsService: CalendarConnectionsService,
    private readonly calendarConnectionsOAuthService: CalendarConnectionsOAuthService,
  ) {}

  @Get('availability')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('meetings:read')
  availability() {
    return this.calendarConnectionsOAuthService.getAvailability();
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('meetings:read')
  list(@Req() req: AuthenticatedRequest) {
    const user = this.requireUser(req);
    return this.calendarConnectionsService.listConnections(user.id);
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('meetings:create')
  disconnect(
    @Param('provider') provider: CalendarConnectionProvider,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.calendarConnectionsService.disconnect(user.id, provider);
  }

  @Get('oauth/google/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('meetings:create')
  startGoogle(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string | undefined,
    @Res() res: Response,
  ) {
    const user = this.requireUser(req);
    const organizationSlug = this.resolveOrganizationSlug(req, orgSlug);
    if (!organizationSlug) {
      throw new UnauthorizedException();
    }

    const url = this.calendarConnectionsOAuthService.buildGoogleAuthorizeUrl({
      userId: user.id,
      organizationSlug,
    });

    res.redirect(url);
  }

  @Get('oauth/google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing Google OAuth response');
    }

    await this.calendarConnectionsOAuthService.handleGoogleCallback(
      code,
      state,
      res,
    );
  }

  @Get('oauth/microsoft/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('meetings:create')
  startMicrosoft(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string | undefined,
    @Res() res: Response,
  ) {
    const user = this.requireUser(req);
    const organizationSlug = this.resolveOrganizationSlug(req, orgSlug);
    if (!organizationSlug) {
      throw new UnauthorizedException();
    }

    const url = this.calendarConnectionsOAuthService.buildMicrosoftAuthorizeUrl(
      {
        userId: user.id,
        organizationSlug,
      },
    );

    res.redirect(url);
  }

  @Get('oauth/microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing Microsoft OAuth response');
    }

    await this.calendarConnectionsOAuthService.handleMicrosoftCallback(
      code,
      state,
      res,
    );
  }

  @Get('oauth/zoom/start')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('meetings:create')
  startZoom(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string | undefined,
    @Res() res: Response,
  ) {
    const user = this.requireUser(req);
    const organizationSlug = this.resolveOrganizationSlug(req, orgSlug);
    if (!organizationSlug) {
      throw new UnauthorizedException();
    }

    const url = this.calendarConnectionsOAuthService.buildZoomAuthorizeUrl({
      userId: user.id,
      organizationSlug,
    });

    res.redirect(url);
  }

  @Get('oauth/zoom/callback')
  async zoomCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Missing Zoom OAuth response');
    }

    await this.calendarConnectionsOAuthService.handleZoomCallback(
      code,
      state,
      res,
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
