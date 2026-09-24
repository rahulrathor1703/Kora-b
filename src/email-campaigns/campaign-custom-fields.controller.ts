import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { CampaignCustomFieldsService } from './campaign-custom-fields.service';
import {
  CreateCampaignCustomFieldDefinitionDto,
  CreateCampaignCustomFieldOptionDto,
  UpdateCampaignCustomFieldDefinitionDto,
} from './dto/campaign-custom-field.dto';

@Controller('email-campaigns/custom-fields')
export class CampaignCustomFieldsController {
  constructor(
    private readonly campaignCustomFieldsService: CampaignCustomFieldsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.campaignCustomFieldsService.findAll(organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:create')
  createDefinition(
    @Body() dto: CreateCampaignCustomFieldDefinitionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignCustomFieldsService.createDefinition(
      dto,
      organizationId,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignCustomFieldDefinitionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignCustomFieldsService.updateDefinition(
      id,
      dto,
      organizationId,
    );
  }

  @Post(':id/options')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:create')
  createOption(
    @Param('id') id: string,
    @Body() dto: CreateCampaignCustomFieldOptionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignCustomFieldsService.createOption(
      id,
      dto,
      organizationId,
    );
  }
}
