import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import {
  CreateWebsitePropertyDto,
  OnPageAuditsQueryDto,
  OnPagePageResultsQueryDto,
  TriggerOnPageAuditDto,
  UpdateWebsitePropertyDto,
} from './dto/on-page-seo.dto';
import {
  OnPageAuditsService,
  WebsitePropertiesService,
} from './on-page-seo.service';

@Controller('website')
@UseGuards(
  JwtAuthGuard,
  OrganizationGuard,
  ModuleAccessGuard,
  PermissionsGuard,
  AbacGuard,
)
@RequireModule('website')
export class OnPageSeoController {
  constructor(
    private readonly websitePropertiesService: WebsitePropertiesService,
    private readonly onPageAuditsService: OnPageAuditsService,
  ) {}

  @Get('properties')
  @RequirePermissions('website:read')
  listProperties(@CurrentOrganizationId() organizationId: string | null) {
    return this.websitePropertiesService.findAll(organizationId);
  }

  @Post('properties')
  @RequirePermissions('website:manage')
  createProperty(
    @Body() dto: CreateWebsitePropertyDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websitePropertiesService.create(dto, organizationId);
  }

  @Patch('properties/:id')
  @RequirePermissions('website:manage')
  updateProperty(
    @Param('id') id: string,
    @Body() dto: UpdateWebsitePropertyDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websitePropertiesService.update(id, dto, organizationId);
  }

  @Delete('properties/:id')
  @RequirePermissions('website:manage')
  deleteProperty(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websitePropertiesService.delete(id, organizationId);
  }

  @Get('on-page/audits')
  @RequirePermissions('website:read')
  listAudits(
    @Query() query: OnPageAuditsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.onPageAuditsService.listAudits(query, organizationId);
  }

  @Get('on-page/audits/:id')
  @RequirePermissions('website:read')
  getAudit(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.onPageAuditsService.getAudit(id, organizationId);
  }

  @Get('on-page/audits/:id/pages')
  @RequirePermissions('website:read')
  listPageResults(
    @Param('id') id: string,
    @Query() query: OnPagePageResultsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.onPageAuditsService.listPageResults(id, query, organizationId);
  }

  @Post('on-page/audits/trigger')
  @RequirePermissions('website:manage')
  triggerAudit(
    @Body() dto: TriggerOnPageAuditDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.onPageAuditsService.triggerAudit(dto, organizationId);
  }
}
