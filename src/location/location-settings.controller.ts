import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import {
  TestLocationSettingsDto,
  UpdateLocationSettingsDto,
} from './dto/location-settings.dto';
import { LocationSettingsService } from './location-settings.service';

@Controller('location-settings')
export class LocationSettingsController {
  constructor(
    private readonly locationSettingsService: LocationSettingsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('location-settings:read')
  getSettings(@CurrentOrganizationId() organizationId: string | null) {
    return this.locationSettingsService.getSettings(organizationId);
  }

  @Put()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('location-settings:manage')
  updateSettings(
    @Body() dto: UpdateLocationSettingsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.locationSettingsService.updateSettings(dto, organizationId);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('location-settings:manage')
  testSettings(
    @Body() dto: TestLocationSettingsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.locationSettingsService.testSettings(dto, organizationId);
  }
}
