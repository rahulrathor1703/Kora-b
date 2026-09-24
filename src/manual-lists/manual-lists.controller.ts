import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import type { AuthUserProfile } from '../auth/auth.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import {
  EnrollManualListRowsDto,
  ManualListEnrollmentOptionsQueryDto,
  RemoveContactListMemberDto,
} from '../contact-lists/dto/list-member-campaign-sync.dto';
import { CreateManualListDto } from './dto/create-manual-list.dto';
import {
  AppendManualListImportDto,
  CreateManualListRowDto,
} from './dto/manual-list-detail.dto';
import { ManualListsService } from './manual-lists.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('manual-lists')
export class ManualListsController {
  constructor(private readonly manualListsService: ManualListsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.manualListsService.findAll(organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:create')
  create(
    @Body() dto: CreateManualListDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.manualListsService.create(dto, organizationId, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:read')
  findById(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.manualListsService.findById(id, organizationId);
  }

  @Get(':id/rows/enrollment-options')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:read')
  getEnrollmentOptions(
    @Param('id') id: string,
    @Query() query: ManualListEnrollmentOptionsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const rowIds = query.rowIds
      ? query.rowIds.split(',').map((rowId) => rowId.trim())
      : [];

    return this.manualListsService.getEnrollmentOptions(
      id,
      rowIds,
      organizationId,
    );
  }

  @Post(':id/rows/enroll-in-campaigns')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:update', 'email-campaigns:update')
  enrollRowsInCampaigns(
    @Param('id') id: string,
    @Body() dto: EnrollManualListRowsDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.manualListsService.enrollRowsInCampaigns(
      id,
      dto,
      organizationId,
      req.user,
    );
  }

  @Post(':id/rows')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:update')
  addRow(
    @Param('id') id: string,
    @Body() dto: CreateManualListRowDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.manualListsService.addRow(id, dto, organizationId);
  }

  @Get(':id/rows/:rowId/removal-preview')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:read')
  getRowRemovalPreview(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.manualListsService.getRowRemovalPreview(
      id,
      rowId,
      organizationId,
    );
  }

  @Delete(':id/rows/:rowId')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:update')
  removeRow(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() dto: RemoveContactListMemberDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.manualListsService.removeRow(
      id,
      rowId,
      dto,
      organizationId,
      req.user,
    );
  }

  @Post(':id/import/preview')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:update')
  @UseInterceptors(FileInterceptor('file'))
  previewAppendImport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.manualListsService.previewAppendImport(
      id,
      file,
      organizationId,
    );
  }

  @Post(':id/import')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('manual-lists:update')
  @UseInterceptors(FileInterceptor('file'))
  async appendImport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    if (!payloadJson) {
      throw new BadRequestException('Import payload is required');
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(AppendManualListImportDto, parsedPayload);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    return this.manualListsService.appendImport(id, dto, file, organizationId);
  }
}
