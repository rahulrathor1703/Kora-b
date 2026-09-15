import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { OrganizationGuard } from '../auth/guards/permissions.guard';
import { AbacGuard } from './abac-evaluation.service';
import { AbacPoliciesService } from './abac-policies.service';
import { BulkAssignAbacPoliciesDto } from './dto/bulk-assign-abac-policies.dto';
import { CreateAbacPolicyDto } from './dto/create-abac-policy.dto';
import { UpdateAbacPolicyDto } from './dto/update-abac-policy.dto';

@Controller('abac-policies')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
export class AbacPoliciesController {
  constructor(private readonly abacPoliciesService: AbacPoliciesService) {}

  @Get()
  @RequirePermissions('abac:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.abacPoliciesService.findAll(organizationId);
  }

  @Get(':id')
  @RequirePermissions('abac:read')
  findOne(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') id: string,
  ) {
    return this.abacPoliciesService.findOne(organizationId, id);
  }

  @Post()
  @RequirePermissions('abac:manage')
  create(
    @CurrentOrganizationId() organizationId: string | null,
    @Body() dto: CreateAbacPolicyDto,
  ) {
    return this.abacPoliciesService.create(organizationId, dto);
  }

  @Post('bulk-assign')
  @RequirePermissions('abac:manage')
  bulkAssign(
    @CurrentOrganizationId() organizationId: string | null,
    @Body() dto: BulkAssignAbacPoliciesDto,
  ) {
    return this.abacPoliciesService.bulkAssignPolicies(organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions('abac:manage')
  update(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateAbacPolicyDto,
  ) {
    return this.abacPoliciesService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('abac:manage')
  remove(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') id: string,
  ) {
    return this.abacPoliciesService.remove(organizationId, id);
  }
}
