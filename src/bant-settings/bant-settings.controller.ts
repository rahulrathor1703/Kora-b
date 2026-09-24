import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { BantSettingsService } from './bant-settings.service';
import { UpdateBantSettingsDto } from './dto/bant-settings.dto';

@Controller('bant-settings')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
export class BantSettingsController {
  constructor(private readonly bantSettingsService: BantSettingsService) {}

  @Get()
  @RequirePermissions('bant-settings:read')
  getSettings(@CurrentOrganizationId() organizationId: string | null) {
    return this.bantSettingsService.getSettings(organizationId);
  }

  @Put()
  @RequirePermissions('bant-settings:manage')
  updateSettings(
    @Body() dto: UpdateBantSettingsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.bantSettingsService.updateSettings(dto, organizationId);
  }
}
