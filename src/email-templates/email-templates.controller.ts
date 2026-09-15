import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import type { AuthUser } from '../auth/auth.types';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import {
  CreateEmailTemplateDto,
  ListEmailTemplatesQueryDto,
  UpdateEmailTemplateDto,
} from './dto/email-template.dto';
import { EmailTemplatesService } from './email-templates.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-templates:read')
  findAll(
    @Query() query: ListEmailTemplatesQueryDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailTemplatesService.findAll(
      organizationId,
      this.requireUser(req),
      {
        type: query.type,
        includeInactive: query.includeInactive,
      },
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-templates:read')
  findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailTemplatesService.findOne(
      id,
      organizationId,
      this.requireUser(req),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-templates:manage')
  create(
    @Body() dto: CreateEmailTemplateDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailTemplatesService.create(
      dto,
      organizationId,
      this.requireUser(req),
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-templates:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailTemplatesService.update(
      id,
      dto,
      organizationId,
      this.requireUser(req),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-templates:manage')
  remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailTemplatesService.remove(
      id,
      organizationId,
      this.requireUser(req),
    );
  }

  private requireUser(req: AuthenticatedRequest): AuthUser {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }
}
