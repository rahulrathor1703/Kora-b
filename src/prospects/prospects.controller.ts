import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Param,
  Patch,
  Post,
  Put,
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
import { AuthUser } from '../auth/auth.types';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import {
  CreateProspectDto,
  CreateProspectStubDto,
  CreateProspectEngagementDto,
  FollowUpsQueryDto,
  PipelineSummaryQueryDto,
  ProspectSearchQueryDto,
  ProspectsQueryDto,
  UpdateProspectDto,
} from './dto/prospect.dto';
import {
  CreateProspectDeleteRequestDto,
  ProspectDeleteRequestsQueryDto,
  RejectProspectDeleteRequestDto,
} from './dto/prospect-delete-request.dto';
import { ProspectDeleteRequestsService } from './prospect-delete-requests.service';
import { ProspectsService } from './prospects.service';
import { RequireAnyPermissions } from '../auth/decorators/require-any-permissions.decorator';
import { CrmImportDto } from '../common/crm-import/dto/crm-import.dto';
import { ProspectsImportService } from './prospects-import.service';
import { BantSettingsService } from '../bant-settings/bant-settings.service';
import { UpdateProspectBantDto } from '../bant-settings/dto/bant-settings.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('prospects')
@UseGuards(
  JwtAuthGuard,
  OrganizationGuard,
  ModuleAccessGuard,
  PermissionsGuard,
  AbacGuard,
)
@RequireModule('crm')
export class ProspectsController {
  constructor(
    private readonly prospectsService: ProspectsService,
    private readonly deleteRequestsService: ProspectDeleteRequestsService,
    private readonly prospectsImportService: ProspectsImportService,
    private readonly bantSettingsService: BantSettingsService,
  ) {}

  @Get('field-schema')
  @RequirePermissions('prospects:read')
  getFieldSchema(@CurrentOrganizationId() organizationId: string | null) {
    return this.prospectsService.getFieldSchema(organizationId);
  }

  @Put('field-schema')
  updateFieldSchema() {
    throw new GoneException(
      'Prospect field schema is managed in Settings → Manage Forms (crm.prospect.create).',
    );
  }

  @Get('pipeline/summary')
  @RequirePermissions('prospects:read')
  getPipelineSummary(
    @Query() query: PipelineSummaryQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.getPipelineSummary(
      organizationId,
      query.followUpRange,
    );
  }

  @Get('search')
  @RequirePermissions('prospects:read')
  searchProspects(
    @Query() query: ProspectSearchQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.searchProspects(
      query.q,
      query.limit ?? 10,
      organizationId,
    );
  }

  @Get('followups')
  @RequirePermissions('prospects:read')
  findFollowUps(
    @Query() query: FollowUpsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.findFollowUps(query, organizationId);
  }

  @Get()
  @RequirePermissions('prospects:read')
  findProspects(
    @Query() query: ProspectsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.findProspects(query, organizationId);
  }

  @Post('import/preview')
  @RequirePermissions('prospects:create')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string | undefined,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const fieldMapping = this.parseOptionalFieldMapping(payloadJson);
    return this.prospectsImportService.previewImport(
      file,
      organizationId,
      fieldMapping,
    );
  }

  @Post('import')
  @RequirePermissions('prospects:create')
  @UseInterceptors(FileInterceptor('file'))
  async importProspects(
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const dto = await this.parseImportPayload(payloadJson);
    return this.prospectsImportService.importRows(
      file,
      dto.fieldMapping,
      organizationId,
    );
  }

  @Post()
  @RequirePermissions('prospects:create')
  createProspect(
    @Body() dto: CreateProspectDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.createProspect(dto, organizationId);
  }

  @Post('stub')
  @RequirePermissions('prospects:create')
  createProspectStub(
    @Body() dto: CreateProspectStubDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.createProspectStub(dto, organizationId);
  }

  @Post('delete-requests')
  @RequirePermissions('prospects:request-delete')
  createDeleteRequest(
    @Body() dto: CreateProspectDeleteRequestDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.create(dto, user, organizationId);
  }

  @Get('delete-requests')
  @RequireAnyPermissions('prospects:request-delete', 'prospects:approve-delete')
  findDeleteRequests(
    @Query() query: ProspectDeleteRequestsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.findAll(query, user, organizationId);
  }

  @Get('delete-requests/summary-count')
  @RequireAnyPermissions('prospects:request-delete', 'prospects:approve-delete')
  getDeleteRequestSummaryCounts(
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.getSummaryCounts(user, organizationId);
  }

  @Get('delete-requests/pending-count')
  @RequirePermissions('prospects:approve-delete')
  getPendingDeleteRequestCount(
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.countPending(user, organizationId);
  }

  @Patch('delete-requests/:id/approve')
  @RequirePermissions('prospects:approve-delete')
  approveDeleteRequest(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.approve(id, user, organizationId);
  }

  @Patch('delete-requests/:id/reject')
  @RequirePermissions('prospects:approve-delete')
  rejectDeleteRequest(
    @Param('id') id: string,
    @Body() dto: RejectProspectDeleteRequestDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.reject(id, dto, user, organizationId);
  }

  @Patch('delete-requests/:id/cancel')
  @RequirePermissions('prospects:request-delete')
  cancelDeleteRequest(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.cancel(id, user, organizationId);
  }

  @Get(':id')
  @RequirePermissions('prospects:read')
  findOneProspect(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.findOneProspect(id, organizationId);
  }

  @Patch(':id')
  @RequirePermissions('prospects:update')
  updateProspect(
    @Param('id') id: string,
    @Body() dto: UpdateProspectDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.prospectsService.updateProspect(
      id,
      dto,
      organizationId,
      user.id,
    );
  }

  @Delete(':id')
  @RequirePermissions('prospects:delete')
  deleteProspect(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.deleteProspect(id, organizationId);
  }

  @Get(':id/campaigns')
  @RequirePermissions('prospects:read', 'email-campaigns:read')
  listProspectCampaigns(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.listProspectCampaigns(id, organizationId);
  }

  @Get(':id/engagements')
  @RequirePermissions('prospects:read')
  listEngagements(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.prospectsService.listEngagements(id, organizationId);
  }

  @Post(':id/engagements')
  @RequirePermissions('prospects:update')
  createEngagement(
    @Param('id') id: string,
    @Body() dto: CreateProspectEngagementDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.prospectsService.createEngagement(
      id,
      dto,
      organizationId,
      user.id,
    );
  }

  @Get(':id/bant')
  @RequirePermissions('prospects:read')
  getProspectBant(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.bantSettingsService.getProspectBant(id, organizationId);
  }

  @Put(':id/bant')
  @RequirePermissions('prospects:update')
  updateProspectBant(
    @Param('id') id: string,
    @Body() dto: UpdateProspectBantDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.bantSettingsService.updateProspectBant(
      id,
      dto.responses,
      organizationId,
    );
  }

  private requireUser(req: AuthenticatedRequest): AuthUser {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }

  private parseOptionalFieldMapping(
    payloadJson: string | undefined,
  ): Record<string, string> | undefined {
    if (!payloadJson) {
      return undefined;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(CrmImportDto, parsedPayload);
    return dto.fieldMapping;
  }

  private async parseImportPayload(payloadJson: string): Promise<CrmImportDto> {
    if (!payloadJson) {
      throw new BadRequestException('Import payload is required');
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(CrmImportDto, parsedPayload);
    const errors = await validate(dto);

    if (errors.length > 0) {
      throw new BadRequestException('Invalid import payload');
    }

    return dto;
  }
}
