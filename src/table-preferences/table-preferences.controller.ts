import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/permissions.guard';
import { UpsertTablePreferencesDto } from './dto/upsert-table-preferences.dto';
import { TablePreferencesService } from './table-preferences.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('table-preferences')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class TablePreferencesController {
  constructor(
    private readonly tablePreferencesService: TablePreferencesService,
  ) {}

  @Get(':tableName/effective')
  getEffective(
    @Param('tableName') tableName: string,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const user = this.requireUser(req);
    return this.tablePreferencesService.getEffectivePreferences(
      user.id,
      organizationId,
      tableName,
    );
  }

  @Get(':tableName/defaults')
  getDefaults(
    @Param('tableName') tableName: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.tablePreferencesService.getTeamDefaults(
      organizationId,
      tableName,
    );
  }

  @Put(':tableName/defaults')
  upsertDefaults(
    @Param('tableName') tableName: string,
    @Body() dto: UpsertTablePreferencesDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const user = this.requireUser(req);
    return this.tablePreferencesService.upsertTeamDefaults(
      user,
      organizationId,
      tableName,
      dto,
    );
  }

  @Put(':tableName')
  upsertUserPreferences(
    @Param('tableName') tableName: string,
    @Body() dto: UpsertTablePreferencesDto,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const user = this.requireUser(req);
    return this.tablePreferencesService.upsertUserPreferences(
      user,
      organizationId,
      tableName,
      dto,
    );
  }

  @Delete(':tableName')
  resetUserPreferences(
    @Param('tableName') tableName: string,
    @Req() req: AuthenticatedRequest,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const user = this.requireUser(req);
    return this.tablePreferencesService.resetUserPreferences(
      user.id,
      organizationId,
      tableName,
    );
  }

  private requireUser(req: AuthenticatedRequest): AuthUser {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }
}
