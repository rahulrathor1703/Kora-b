import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { LocationSearchQueryDto } from './dto/location-search.dto';
import { LocationSearchService } from './location-search.service';

@Controller('location')
export class LocationSearchController {
  constructor(private readonly locationSearchService: LocationSearchService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('location:search')
  search(
    @Query() query: LocationSearchQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.locationSearchService.search(query, organizationId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('location:search')
  status(@CurrentOrganizationId() organizationId: string | null) {
    return this.locationSearchService.getStatus(organizationId);
  }
}
