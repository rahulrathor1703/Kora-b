import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import type { AuthUser } from '../auth/auth.types';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequireAnyPermissions } from '../auth/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import {
  CampaignProgressService,
  EmailCampaignRecipientsService,
} from './campaign-progress.service';
import { CampaignEventsService } from './campaign-events.service';
import {
  CreateEmailCampaignDto,
  ScheduleEmailCampaignDto,
  UpdateEmailCampaignDto,
  AddEmailCampaignRecipientDto,
  UpdateEmailCampaignRecipientDto,
  PauseEmailCampaignRecipientDto,
  PauseEmailCampaignDto,
  PauseCampaignMailboxSenderDto,
  StopCampaignMailboxSenderDto,
  ResumeEmailCampaignDto,
  UpdateEmailCampaignStatusDto,
  CreateMailboxSenderDto,
  UpdateCampaignMailboxSenderDto,
} from './dto/email-campaign.dto';
import { CampaignRecipientsQueryDto } from './dto/campaign-recipients-query.dto';
import { CampaignAudienceQueryDto } from './dto/campaign-audience-query.dto';
import {
  CampaignEventsQueryDto,
  RecipientEventsQueryDto,
} from './dto/campaign-events-query.dto';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailCampaignDeleteRequestsService } from './email-campaign-delete-requests.service';
import {
  CreateEmailCampaignDeleteRequestDto,
  EmailCampaignDeleteRequestsQueryDto,
  RejectEmailCampaignDeleteRequestDto,
} from './dto/email-campaign-delete-request.dto';
import { CampaignTrackingSyncService } from './campaign-tracking-sync.service';
import { CampaignMailboxSendersService } from './campaign-mailbox-senders.service';
import { CampaignListMetricsService } from './campaign-list-metrics.service';
import { CampaignMergeFieldCatalogService } from './campaign-merge-field-catalog.service';
import { TrackingConfigService } from './tracking-config.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('email-campaigns')
@UseGuards(JwtAuthGuard, OrganizationGuard, ModuleAccessGuard)
@RequireModule('email')
export class EmailCampaignsController {
  constructor(
    private readonly emailCampaignsService: EmailCampaignsService,
    private readonly campaignListMetricsService: CampaignListMetricsService,
    private readonly mergeFieldCatalogService: CampaignMergeFieldCatalogService,
    private readonly deleteRequestsService: EmailCampaignDeleteRequestsService,
    private readonly campaignProgressService: CampaignProgressService,
    private readonly emailCampaignRecipientsService: EmailCampaignRecipientsService,
    private readonly campaignEventsService: CampaignEventsService,
    private readonly campaignTrackingSyncService: CampaignTrackingSyncService,
    private readonly campaignMailboxSendersService: CampaignMailboxSendersService,
    private readonly trackingConfigService: TrackingConfigService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.emailCampaignsService.findAll(organizationId);
  }

  @Get('metrics-summary')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  findMetricsSummary(@CurrentOrganizationId() organizationId: string | null) {
    return this.campaignListMetricsService.findAllByOrganizationId(
      organizationId,
    );
  }

  @Get('merge-field-catalog')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  getMergeFieldCatalog(@CurrentOrganizationId() organizationId: string | null) {
    return this.mergeFieldCatalogService.getCatalog(organizationId);
  }

  @Get('tracking-status')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  getTrackingStatus(@CurrentOrganizationId() organizationId: string | null) {
    return this.trackingConfigService.getTrackingStatusForOrganization(
      organizationId,
    );
  }

  @Post('sync-tracking')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  syncTracking() {
    return this.campaignTrackingSyncService.syncTrackingManual();
  }

  @Post('delete-requests')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:request-delete')
  createDeleteRequest(
    @Body() dto: CreateEmailCampaignDeleteRequestDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.create(dto, user, organizationId);
  }

  @Get('delete-requests')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequireAnyPermissions(
    'email-campaigns:request-delete',
    'email-campaigns:approve-delete',
  )
  findDeleteRequests(
    @Query() query: EmailCampaignDeleteRequestsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.findAll(query, user, organizationId);
  }

  @Get('delete-requests/summary-count')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequireAnyPermissions(
    'email-campaigns:request-delete',
    'email-campaigns:approve-delete',
  )
  getDeleteRequestSummaryCounts(
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.getSummaryCounts(user, organizationId);
  }

  @Get('delete-requests/pending-count')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:approve-delete')
  getPendingDeleteRequestCount(
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.countPending(user, organizationId);
  }

  @Patch('delete-requests/:id/approve')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:approve-delete')
  approveDeleteRequest(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.approve(id, user, organizationId);
  }

  @Patch('delete-requests/:id/reject')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:approve-delete')
  rejectDeleteRequest(
    @Param('id') id: string,
    @Body() dto: RejectEmailCampaignDeleteRequestDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.reject(id, dto, user, organizationId);
  }

  @Patch('delete-requests/:id/cancel')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:request-delete')
  cancelDeleteRequest(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.deleteRequestsService.cancel(id, user, organizationId);
  }

  @Get(':id/tracking-health')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  getCampaignTrackingHealth(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.trackingConfigService.getCampaignTrackingHealth(
      id,
      organizationId,
    );
  }

  @Get(':id/progress')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  getProgress(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignProgressService.getProgress(id, organizationId);
  }

  @Get(':id/events/daily')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  listDailyEvents(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignEventsService.listDailyEvents(id, organizationId);
  }

  @Get(':id/events')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  listEvents(
    @Param('id') id: string,
    @Query() query: CampaignEventsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignEventsService.listCampaignEvents(
      id,
      organizationId,
      query,
    );
  }

  @Get(':id/recipients/:recipientId/events')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  listRecipientEvents(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @Query() query: RecipientEventsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignEventsService.listRecipientEvents(
      id,
      recipientId,
      organizationId,
      query.page,
      query.limit,
    );
  }

  @Get('recipients/audience')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  listAudience(
    @Query() query: CampaignAudienceQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.listAudience(
      organizationId,
      query,
    );
  }

  @Get(':id/recipients')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  listRecipients(
    @Param('id') id: string,
    @Query() query: CampaignRecipientsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.listRecipients(
      id,
      organizationId,
      query,
    );
  }

  @Post(':id/recipients')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  addRecipient(
    @Param('id') id: string,
    @Body() dto: AddEmailCampaignRecipientDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.addRecipient(
      id,
      organizationId,
      dto,
    );
  }

  @Get(':id/recipients/:recipientId')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  getRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.getRecipient(
      id,
      recipientId,
      organizationId,
    );
  }

  @Patch(':id/recipients/:recipientId')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  updateRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @Body() dto: UpdateEmailCampaignRecipientDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.updateRecipient(
      id,
      recipientId,
      organizationId,
      dto,
    );
  }

  @Post(':id/recipients/:recipientId/exclude')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  excludeRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.excludeRecipient(
      id,
      recipientId,
      organizationId,
    );
  }

  @Post(':id/recipients/:recipientId/include')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  includeRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.includeRecipient(
      id,
      recipientId,
      organizationId,
    );
  }

  @Post(':id/recipients/:recipientId/pause')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  pauseRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @Body() dto: PauseEmailCampaignRecipientDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.pauseRecipient(
      id,
      recipientId,
      organizationId,
      dto.pausedUntil,
    );
  }

  @Post(':id/recipients/:recipientId/stop')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  stopRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.stopRecipient(
      id,
      recipientId,
      organizationId,
    );
  }

  @Post(':id/recipients/:recipientId/resume')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  resumeRecipient(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.resumeRecipient(
      id,
      recipientId,
      organizationId,
    );
  }

  @Post(':id/recipients/:recipientId/exclude-globally')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  excludeRecipientGlobally(
    @Param('id') id: string,
    @Param('recipientId') recipientId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignRecipientsService.excludeRecipientGlobally(
      id,
      recipientId,
      organizationId,
    );
  }

  @Post(':id/mailbox-senders')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  addMailboxSender(
    @Param('id') id: string,
    @Body() dto: CreateMailboxSenderDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignMailboxSendersService.addSender(
      id,
      dto,
      organizationId,
    );
  }

  @Patch(':id/mailbox-senders/:senderId')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  updateMailboxSender(
    @Param('id') id: string,
    @Param('senderId') senderId: string,
    @Body() dto: UpdateCampaignMailboxSenderDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignMailboxSendersService.updateSender(
      id,
      senderId,
      dto,
      organizationId,
    );
  }

  @Post(':id/mailbox-senders/:senderId/pause')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  pauseMailboxSender(
    @Param('id') id: string,
    @Param('senderId') senderId: string,
    @Body() dto: PauseCampaignMailboxSenderDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignMailboxSendersService.pauseSender(
      id,
      senderId,
      organizationId,
      dto,
    );
  }

  @Post(':id/mailbox-senders/:senderId/resume')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  resumeMailboxSender(
    @Param('id') id: string,
    @Param('senderId') senderId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignMailboxSendersService.resumeSender(
      id,
      senderId,
      organizationId,
    );
  }

  @Post(':id/mailbox-senders/:senderId/stop')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  stopMailboxSender(
    @Param('id') id: string,
    @Param('senderId') senderId: string,
    @Body() dto: StopCampaignMailboxSenderDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.campaignMailboxSendersService.stopSender(
      id,
      senderId,
      organizationId,
      dto,
    );
  }

  @Get(':id')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  findOne(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.findOne(id, organizationId);
  }

  @Post()
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:create')
  create(
    @Body() dto: CreateEmailCampaignDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.create(dto, organizationId);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailCampaignDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:delete')
  deleteCampaign(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.deleteCampaign(id, organizationId);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEmailCampaignStatusDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.updateStatus(id, dto, organizationId);
  }

  @Post(':id/schedule')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleEmailCampaignDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.schedule(id, dto, organizationId);
  }

  @Post(':id/pause')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  pauseCampaign(
    @Param('id') id: string,
    @Body() dto: PauseEmailCampaignDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.pauseCampaign(
      id,
      organizationId,
      dto.pausedUntil,
    );
  }

  @Post(':id/stop')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  stopCampaign(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.stopCampaign(id, organizationId);
  }

  @Post(':id/resume')
  @UseGuards(PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  resumeCampaign(
    @Param('id') id: string,
    @Body() dto: ResumeEmailCampaignDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.emailCampaignsService.resumeCampaign(id, organizationId, dto);
  }

  private requireUser(req: AuthenticatedRequest): AuthUser {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }
}
