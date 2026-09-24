import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { ConnectNotionDto } from './dto/connect-notion.dto';
import {
  NotionColumnsQueryDto,
  NotionImportDto,
} from './dto/notion-import.dto';
import { NotionIntegrationsService } from './notion-integrations.service';

@Controller('notion')
export class NotionIntegrationsController {
  constructor(
    private readonly notionIntegrationsService: NotionIntegrationsService,
  ) {}

  @Get('connection')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('integrations:manage')
  getConnection(@CurrentOrganizationId() organizationId: string | null) {
    return this.notionIntegrationsService.getConnection(organizationId);
  }

  @Put('connection')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('integrations:manage')
  connect(
    @Body() dto: ConnectNotionDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.notionIntegrationsService.connect(dto, organizationId);
  }

  @Delete('connection')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('integrations:manage')
  disconnect(@CurrentOrganizationId() organizationId: string | null) {
    return this.notionIntegrationsService.disconnect(organizationId);
  }

  @Get('databases')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('integrations:manage')
  listDatabases(@CurrentOrganizationId() organizationId: string | null) {
    return this.notionIntegrationsService.listDatabases(organizationId);
  }

  @Get('databases/:databaseId/columns')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('integrations:manage')
  getColumns(
    @Param('databaseId') databaseId: string,
    @Query() query: NotionColumnsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.notionIntegrationsService.getColumns(
      databaseId,
      query.destination,
      organizationId,
    );
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('integrations:manage')
  importRows(
    @Body() dto: NotionImportDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.notionIntegrationsService.importRows(dto, organizationId);
  }
}
