import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions('audit-logs:read')
  list(
    @Query() query: AuditLogsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.auditLogsService.listForOrganization(query, organizationId);
  }
}
