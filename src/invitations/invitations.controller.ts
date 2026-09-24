import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/auth.types';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseGuards(
    JwtAuthGuard,
    OrganizationGuard,
    ModuleAccessGuard,
    PermissionsGuard,
    AbacGuard,
  )
  @RequireModule('settings')
  @RequirePermissions('users:invite')
  create(
    @Body() dto: CreateInvitationDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.invitationsService.create(dto, req.user, organizationId);
  }

  @Get()
  @UseGuards(
    JwtAuthGuard,
    OrganizationGuard,
    ModuleAccessGuard,
    PermissionsGuard,
    AbacGuard,
  )
  @RequireModule('settings')
  @RequirePermissions('users:read')
  findAllPending(@CurrentOrganizationId() organizationId: string | null) {
    return this.invitationsService.findAllPending(organizationId);
  }

  @Delete(':id')
  @UseGuards(
    JwtAuthGuard,
    OrganizationGuard,
    ModuleAccessGuard,
    PermissionsGuard,
    AbacGuard,
  )
  @RequireModule('settings')
  @RequirePermissions('users:manage')
  revoke(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.invitationsService.revoke(id, organizationId);
  }

  @Get(':token/validate')
  validate(@Param('token') token: string) {
    return this.invitationsService.validateToken(token);
  }

  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } = await this.invitationsService.accept(
      token,
      dto,
    );

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { user };
  }
}
