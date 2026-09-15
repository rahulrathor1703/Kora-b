import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { UpdateFormSchemaDto } from './dto/update-form-schema.dto';
import { FormsService } from './forms.service';

@Controller('forms')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get('registry')
  @UseGuards(AbacGuard)
  @RequirePermissions('forms:read')
  listRegistry(@CurrentOrganizationId() organizationId: string | null) {
    return this.formsService.listRegistryForOrg(organizationId);
  }

  @Get(':formKey/schema')
  getSchema(
    @Param('formKey') formKey: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.formsService.getResolvedSchema(formKey, organizationId);
  }

  @Put(':formKey/schema')
  @UseGuards(AbacGuard)
  @RequirePermissions('forms:update')
  updateOrgExtensions(
    @Param('formKey') formKey: string,
    @Body() dto: UpdateFormSchemaDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.formsService.updateOrgExtensions(formKey, dto, organizationId);
  }
}
