import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { UpdateOrgLimitsDto } from './dto/org-entitlements.dto';
import { OrgEntitlementsService } from './org-entitlements.service';

@Controller('organization')
@UseGuards(
  JwtAuthGuard,
  OrganizationGuard,
  PermissionsGuard,
  RolesGuard,
  AbacGuard,
)
@Roles(UserRole.SUPERADMIN)
export class OrganizationEntitlementsController {
  constructor(
    private readonly orgEntitlementsService: OrgEntitlementsService,
  ) {}

  @Get('entitlements')
  getEntitlements(@CurrentOrganizationId() organizationId: string | null) {
    return this.orgEntitlementsService.getSnapshot(organizationId!);
  }

  @Put('limits')
  updateLimits(
    @Body() dto: UpdateOrgLimitsDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.orgEntitlementsService.updateOrgLimits(
      organizationId!,
      dto.orgLimits,
    );
  }
}
