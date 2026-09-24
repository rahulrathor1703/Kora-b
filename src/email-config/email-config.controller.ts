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
  CreateEmailConfigOptionDto,
  ListEmailConfigOptionsQueryDto,
  UpdateEmailConfigOptionDto,
} from './dto/email-config-option.dto';
import { EmailConfigService } from './email-config.service';

@Controller('email-config/options')
export class EmailConfigController {
  constructor(private readonly emailConfigService: EmailConfigService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-config:read')
  findAll(
    @Query() query: ListEmailConfigOptionsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailConfigService.findAll(organizationId, query.category);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-config:read')
  findOne(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailConfigService.findOne(id, organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-config:manage')
  create(
    @Body() dto: CreateEmailConfigOptionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailConfigService.create(dto, organizationId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-config:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailConfigOptionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailConfigService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-config:manage')
  remove(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailConfigService.remove(id, organizationId);
  }
}
