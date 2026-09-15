import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { AbacPoliciesService } from '../abac/abac-policies.service';
import { AssignUserPoliciesDto } from '../abac/dto/assign-user-policies.dto';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import {
  UpdateTeamMemberDto,
  UpdateTeamMemberStatusDto,
} from './dto/update-team-member.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly abacPoliciesService: AbacPoliciesService,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.usersService.findAllTeamMembers(organizationId);
  }

  @Patch(':id')
  @RequirePermissions('users:manage')
  update(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.usersService.updateTeamMember(organizationId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('users:manage')
  updateStatus(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateTeamMemberStatusDto,
  ) {
    return this.usersService.updateTeamMemberStatus(organizationId, id, dto);
  }

  @Get(':id/abac-policies')
  @RequirePermissions('users:read')
  findAbacPolicies(@Param('id') id: string) {
    return this.abacPoliciesService.findPoliciesForUser(id);
  }

  @Put(':id/abac-policies')
  @RequirePermissions('users:manage')
  assignAbacPolicies(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') id: string,
    @Body() dto: AssignUserPoliciesDto,
  ) {
    return this.abacPoliciesService.assignPoliciesToUser(
      organizationId,
      id,
      dto.policyIds,
    );
  }
}
