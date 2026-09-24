import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../../auth/guards/permissions.guard';
import { CampaignIdFormatService } from './campaign-id-format.service';
import { SetCampaignIdFormatDto } from './dto/campaign-id-format.dto';

@Controller('email-campaign-id-format')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
export class CampaignIdFormatController {
  constructor(
    private readonly campaignIdFormatService: CampaignIdFormatService,
  ) {}

  @Get()
  @RequirePermissions('email-config:read')
  getFormat(@CurrentOrganizationId() organizationId: string | null) {
    return this.campaignIdFormatService.getFormat(organizationId);
  }

  @Put()
  @RequirePermissions('email-config:manage')
  setFormat(
    @Body() dto: SetCampaignIdFormatDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignIdFormatService.setFormat(dto, organizationId);
  }
}
