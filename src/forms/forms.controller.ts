import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { CrmFormBridgeService } from './crm-form-bridge.service';
import { UpdateFormSchemaDto } from './dto/update-form-schema.dto';
import { FormsService } from './forms.service';

@Controller('forms')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly crmFormBridgeService: CrmFormBridgeService,
  ) {}

  @Get('registry')
  @UseGuards(AbacGuard)
  @RequirePermissions('forms:read')
  listRegistry(@CurrentOrganizationId() organizationId: string | null) {
    return this.formsService.listRegistryForOrg(organizationId);
  }

  @Get(':formKey/schema')
  @UseGuards(AbacGuard)
  @RequirePermissions('forms:read')
  async getSchema(
    @Param('formKey') formKey: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const base = await this.formsService.getResolvedSchema(
      formKey,
      resolvedOrganizationId,
    );

    if (this.crmFormBridgeService.isCrmManagedFormKey(formKey)) {
      return this.crmFormBridgeService.enrichGetSchema(
        formKey,
        resolvedOrganizationId,
        base,
      );
    }

    return base;
  }

  @Put(':formKey/schema')
  @UseGuards(AbacGuard)
  @RequirePermissions('forms:update')
  updateOrgExtensions(
    @Param('formKey') formKey: string,
    @Body() dto: UpdateFormSchemaDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    if (this.crmFormBridgeService.isCrmManagedFormKey(formKey)) {
      return this.crmFormBridgeService.updateOrgSchema(
        formKey,
        dto,
        resolvedOrganizationId,
      );
    }

    return this.formsService.updateOrgExtensions(
      formKey,
      dto,
      resolvedOrganizationId,
    );
  }
}
