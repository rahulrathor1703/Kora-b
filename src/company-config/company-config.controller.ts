import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import {
  CreateCompanyConfigOptionDto,
  ListCompanyConfigOptionsQueryDto,
  UpdateCompanyConfigOptionDto,
} from './dto/company-config-option.dto';
import { CompanyConfigService } from './company-config.service';

@Controller('company-config/options')
export class CompanyConfigController {
  constructor(private readonly companyConfigService: CompanyConfigService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('company-config:read')
  findAll(
    @Query() query: ListCompanyConfigOptionsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companyConfigService.findAll(organizationId, query.category);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('company-config:read')
  findOne(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companyConfigService.findOne(id, organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('company-config:manage')
  create(
    @Body() dto: CreateCompanyConfigOptionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companyConfigService.create(dto, organizationId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('company-config:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyConfigOptionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companyConfigService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('company-config:manage')
  remove(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.companyConfigService.remove(id, organizationId);
  }
}
