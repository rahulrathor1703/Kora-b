import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RequireAnyPermissions } from '../../auth/decorators/require-any-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../../auth/guards/permissions.guard';
import { requireOrganizationId } from '../../common/organization/require-organization-id';
import {
  CreateGoogleOAuthAppDto,
  UpdateGoogleOAuthAppDto,
} from '../dto/google-oauth-app.dto';
import { OrganizationGoogleOAuthAppService } from './organization-google-oauth-app.service';

@Controller('website/google-oauth-apps')
export class OrganizationGoogleOAuthAppController {
  constructor(
    private readonly oauthAppService: OrganizationGoogleOAuthAppService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  listApps(@CurrentOrganizationId() organizationId: string | null) {
    return this.oauthAppService.listApps(requireOrganizationId(organizationId));
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  createApp(
    @Body() dto: CreateGoogleOAuthAppDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.oauthAppService.createApp(
      dto,
      requireOrganizationId(organizationId),
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  updateApp(
    @Param('id') id: string,
    @Body() dto: UpdateGoogleOAuthAppDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.oauthAppService.updateApp(
      id,
      dto,
      requireOrganizationId(organizationId),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequireAnyPermissions('website:manage', 'website:manage-integrations')
  deleteApp(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.oauthAppService.deleteApp(
      id,
      requireOrganizationId(organizationId),
    );
  }
}
