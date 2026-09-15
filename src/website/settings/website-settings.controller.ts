import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RequireAnyPermissions } from '../../auth/decorators/require-any-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../../auth/guards/permissions.guard';
import {
  TestPsiSettingsDto,
  UpdateGoogleOAuthAppSettingsDto,
  UpdatePsiSettingsDto,
} from '../dto/website-settings.dto';
import { WebsiteSettingsService } from './website-settings.service';

@Controller('website/settings')
export class WebsiteSettingsController {
  constructor(
    private readonly websiteSettingsService: WebsiteSettingsService,
  ) {}

  @Get('psi')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  getPsiSettings(@CurrentOrganizationId() organizationId: string | null) {
    return this.websiteSettingsService.getPsiSettings(organizationId);
  }

  @Put('psi')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  updatePsiSettings(
    @Body() dto: UpdatePsiSettingsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websiteSettingsService.updatePsiSettings(dto, organizationId);
  }

  @Post('psi/test')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  testPsiSettings(
    @Body() dto: TestPsiSettingsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websiteSettingsService.testPsiSettings(dto, organizationId);
  }

  @Get('google-oauth')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  getGoogleOAuthAppSettings(
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websiteSettingsService.getGoogleOAuthAppSettings(
      organizationId,
    );
  }

  @Put('google-oauth')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  updateGoogleOAuthAppSettings(
    @Body() dto: UpdateGoogleOAuthAppSettingsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.websiteSettingsService.updateGoogleOAuthAppSettings(
      dto,
      organizationId,
    );
  }
}
