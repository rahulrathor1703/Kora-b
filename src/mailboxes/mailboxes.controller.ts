import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import {
  CreateMailboxDto,
  TestMailboxSendDto,
  UpdateMailboxDto,
  UpdateMailboxStatusDto,
} from './dto/mailbox.dto';
import { DomainDnsService } from './domain-dns.service';
import { MailboxesService } from './mailboxes.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('mailboxes')
@UseGuards(JwtAuthGuard, OrganizationGuard, ModuleAccessGuard)
@RequireModule('email')
export class MailboxesController {
  constructor(
    private readonly mailboxesService: MailboxesService,
    private readonly domainDnsService: DomainDnsService,
  ) {}

  @Get('domain-dns')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:create')
  checkDomainDns(
    @Query('domain') domain?: string,
    @Query('email') email?: string,
  ) {
    if (email?.trim()) {
      return this.domainDnsService.checkEmailDomain(email.trim());
    }

    return this.domainDnsService.checkDomain(domain ?? '');
  }

  @Get()
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.mailboxesService.findAll(organizationId);
  }

  @Post(':id/test-send')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:update')
  sendTestEmail(
    @Param('id') id: string,
    @Body() dto: TestMailboxSendDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.mailboxesService.sendTestEmail(id, dto, organizationId);
  }

  @Get(':id/campaigns')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:read')
  findCampaigns(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.mailboxesService.findCampaignsForMailbox(id, organizationId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:read')
  findOne(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.mailboxesService.findOne(id, organizationId);
  }

  @Post()
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:create')
  create(
    @Body() dto: CreateMailboxDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.mailboxesService.create(dto, organizationId, req.user.id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMailboxDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.mailboxesService.update(id, dto, organizationId);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:update')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMailboxStatusDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.mailboxesService.updateStatus(id, dto.status, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('mailboxes:delete')
  remove(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.mailboxesService.remove(id, organizationId);
  }
}
