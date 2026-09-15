import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../../auth/guards/permissions.guard';
import { requireOrganizationId } from '../../common/organization/require-organization-id';
import { WebsiteGooglePropertiesService } from './website-google-properties.service';

@Controller('website/google-properties')
export class WebsiteGooglePropertiesController {
  constructor(
    private readonly googlePropertiesService: WebsiteGooglePropertiesService,
  ) {}

  @Get('suggestions')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('website:read')
  getSuggestions(
    @Query('url') url: string | undefined,
    @Query('propertyId') propertyId: string | undefined,
    @Query('connectionId') connectionId: string | undefined,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    if (!propertyId?.trim() && !connectionId?.trim()) {
      throw new BadRequestException('propertyId or connectionId is required');
    }

    return this.googlePropertiesService.getSuggestions(
      resolvedOrganizationId,
      url ?? '',
      {
        propertyId: propertyId?.trim(),
        connectionId: connectionId?.trim(),
      },
    );
  }
}
