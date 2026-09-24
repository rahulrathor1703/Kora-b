import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUserProfile } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { AdminListResponseDto } from './dto/admin-list-item.dto';
import { UpdatePlatformEntitlementsDto } from './dto/platform-entitlements.dto';
import type {
  ImpersonateTenantResponseDto,
  TenantDetailResponseDto,
  TenantListResponseDto,
} from './dto/tenant-list-item.dto';
import { PlatformService } from './platform.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class PlatformController {
  constructor(
    private readonly usersService: UsersService,
    private readonly platformService: PlatformService,
  ) {}

  @Get('admins')
  async listAdmins(): Promise<AdminListResponseDto> {
    const admins = await this.usersService.listAdmins();

    return {
      admins: admins.map((admin) => ({
        id: admin.id,
        email: admin.email,
        createdAt: admin.createdAt.toISOString(),
      })),
    };
  }

  @Get('tenants')
  async listTenants(): Promise<TenantListResponseDto> {
    const tenants = await this.platformService.listTenants();
    return { tenants };
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string): Promise<TenantDetailResponseDto> {
    return this.platformService.getTenantById(id);
  }

  @Get('tenants/:id/entitlements')
  getTenantEntitlements(@Param('id') id: string) {
    return this.platformService.getTenantEntitlements(id);
  }

  @Patch('tenants/:id/entitlements')
  updateTenantEntitlements(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformEntitlementsDto,
  ) {
    return this.platformService.updateTenantEntitlements(id, dto);
  }

  @Post('impersonate/:orgId')
  async startImpersonation(
    @Param('orgId') orgId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ImpersonateTenantResponseDto> {
    return this.platformService.startImpersonation(orgId, req.user!);
  }

  @Delete('impersonate')
  @HttpCode(HttpStatus.NO_CONTENT)
  stopImpersonation(
    @Req() req: AuthenticatedRequest,
    @Query('organizationId') organizationId?: string,
  ): void {
    this.platformService.stopImpersonation(req.user!, organizationId);
  }
}
