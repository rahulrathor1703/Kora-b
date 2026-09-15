import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getManualCampaignStatusTransitionError } from './campaign-status-transitions.util';
import { buildMailboxConflictMessage } from './campaign-mailbox-lock.util';
import {
  applyCampaignPause,
  applyCampaignResume,
  applyCampaignStop,
} from './campaign-action.util';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import { ContactListMembersRepository } from '../contact-lists/contact-list-members.repository';
import { ContactListsRepository } from '../contact-lists/contact-lists.repository';
import { EmailConfigRepository } from '../email-config/email-config.repository';
import { ManualListsRepository } from '../manual-lists/manual-lists.repository';
import { MailboxesRepository } from '../mailboxes/mailboxes.repository';
import { CampaignMailboxSendersService } from './campaign-mailbox-senders.service';
import { assertCampaignResumeHasActiveSenders } from './campaign-mailbox-sender-action.util';
import { CampaignAudienceResolverService } from './campaign-audience-resolver.service';
import { CampaignCustomFieldsService } from './campaign-custom-fields.service';
import {
  computeEstimatedEndAt,
  createDateInTimezone,
  isLaunchDateValid,
  resolveActiveWeekdays,
} from './campaign-schedule.util';
import { assignInitialNextSendAtToRecipients } from './campaign-send-spacing.util';
import type {
  CreateEmailCampaignDto,
  CreateSequenceStepDto,
  ScheduleEmailCampaignDto,
  UpdateEmailCampaignDto,
  UpdateEmailCampaignStatusDto,
  ResumeEmailCampaignDto,
} from './dto/email-campaign.dto';
import { EmailCampaignDeleteRequestsService } from './email-campaign-delete-requests.service';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import { EmailCampaignSequenceStepEntity } from './entities/email-campaign-sequence-step.entity';
import { EmailCampaignEntity } from './entities/email-campaign.entity';
import {
  EmailCampaignMapper,
  type EmailCampaignResponse,
} from './mappers/email-campaign.mapper';

@Injectable()
export class EmailCampaignsService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly emailCampaignMapper: EmailCampaignMapper,
    private readonly emailConfigRepository: EmailConfigRepository,
    private readonly mailboxesRepository: MailboxesRepository,
    private readonly contactListsRepository: ContactListsRepository,
    private readonly contactListMembersRepository: ContactListMembersRepository,
    private readonly manualListsRepository: ManualListsRepository,
    private readonly audienceResolver: CampaignAudienceResolverService,
    private readonly campaignCustomFieldsService: CampaignCustomFieldsService,
    private readonly orgQuotaService: OrgQuotaService,
    private readonly deleteRequestsService: EmailCampaignDeleteRequestsService,
    private readonly campaignMailboxSendersService: CampaignMailboxSendersService,
  ) {}

  async findAll(
    organizationId: string | null,
  ): Promise<EmailCampaignResponse[]> {
    const campaigns =
      await this.emailCampaignsRepository.findAllByOrganizationId(
        requireOrganizationId(organizationId),
      );

    return campaigns.map((campaign) =>
      this.emailCampaignMapper.toResponse(campaign),
    );
  }

  async findOne(
    id: string,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const campaign = await this.requireCampaign(id, organizationId);
    return this.emailCampaignMapper.toResponse(campaign);
  }

  async create(
    dto: CreateEmailCampaignDto,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'email.campaigns',
    );

    this.validateSteps(dto.steps);
    await this.validateForeignKeys(dto, resolvedOrganizationId);
    await this.validateMailboxes(
      dto.mailboxSenders ?? [],
      resolvedOrganizationId,
    );
    const customFieldValues =
      await this.campaignCustomFieldsService.validateAndNormalizeCustomFieldValues(
        dto.customFieldValues,
        resolvedOrganizationId,
      );

    const campaign = this.emailCampaignsRepository.create({
      organizationId: resolvedOrganizationId,
      name: dto.name.trim(),
      goal: dto.goal?.trim() ?? null,
      status: 'draft',
      campaignTypeId: dto.campaignTypeId ?? null,
      brandId: dto.brandId ?? null,
      regionId: dto.regionId ?? null,
      customFieldValues,
      steps: this.buildStepEntities(dto.steps),
      mailboxSenders: this.buildSenderEntities(dto.mailboxSenders ?? []),
    });

    const saved = await this.emailCampaignsRepository.save(campaign);
    return this.emailCampaignMapper.toResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateEmailCampaignDto,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireCampaign(id, organizationId);

    if (dto.name !== undefined) {
      campaign.name = dto.name.trim();
    }

    if (dto.goal !== undefined) {
      campaign.goal = dto.goal.trim() || null;
    }

    if (dto.campaignTypeId !== undefined) {
      campaign.campaignTypeId = dto.campaignTypeId;
    }

    if (dto.brandId !== undefined) {
      campaign.brandId = dto.brandId;
    }

    if (dto.regionId !== undefined) {
      campaign.regionId = dto.regionId;
    }

    if (dto.customFieldValues !== undefined) {
      campaign.customFieldValues =
        await this.campaignCustomFieldsService.validateAndNormalizeCustomFieldValues(
          dto.customFieldValues,
          resolvedOrganizationId,
        );
    }

    if (dto.steps !== undefined) {
      this.validateSteps(dto.steps);
    }

    await this.validateForeignKeys(
      {
        campaignTypeId:
          dto.campaignTypeId ?? campaign.campaignTypeId ?? undefined,
        brandId: dto.brandId ?? campaign.brandId ?? undefined,
        regionId: dto.regionId ?? campaign.regionId ?? undefined,
      },
      resolvedOrganizationId,
    );

    if (dto.mailboxSenders !== undefined) {
      if (campaign.status !== 'draft') {
        throw new BadRequestException(
          'Mailbox senders can only be bulk-updated while campaign is a draft. Use mailbox sender endpoints for live campaigns.',
        );
      }

      await this.validateMailboxes(
        dto.mailboxSenders,
        resolvedOrganizationId,
        id,
      );
    }

    if (
      dto.audienceListType !== undefined ||
      dto.audienceListId !== undefined
    ) {
      if (campaign.status !== 'draft') {
        throw new BadRequestException(
          'Audience can only be updated while campaign is a draft',
        );
      }

      const audienceListType =
        dto.audienceListType ?? campaign.audienceListType ?? undefined;
      const audienceListId =
        dto.audienceListId ?? campaign.audienceListId ?? undefined;

      if (!audienceListType || !audienceListId) {
        throw new BadRequestException(
          'Both audienceListType and audienceListId are required',
        );
      }

      await this.validateAudienceList(
        audienceListType,
        audienceListId,
        resolvedOrganizationId,
      );

      campaign.audienceListType = audienceListType;
      campaign.audienceListId = audienceListId;
    }

    if (dto.wizardStepIndex !== undefined) {
      campaign.wizardStepIndex = dto.wizardStepIndex;
    }

    this.applyDraftScheduleFields(campaign, dto);

    const saved = await this.emailCampaignsRepository.save(campaign);

    if (dto.steps !== undefined || dto.mailboxSenders !== undefined) {
      const steps = this.buildStepEntities(
        dto.steps ??
          [...(campaign.steps ?? [])]
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((step) => ({
              stepOrder: step.stepOrder,
              subject: step.subject,
              body: step.body,
              delayDays: step.delayDays,
              delayMode: step.delayMode,
              scheduledDate: step.scheduledDate ?? undefined,
              includeSignature: step.includeSignature,
            })),
        saved.id,
      );

      const senders = this.buildSenderEntities(
        dto.mailboxSenders ??
          (campaign.mailboxSenders ?? []).map((sender) => ({
            mailboxId: sender.mailboxId,
            senderName: sender.senderName,
            senderEmail: sender.senderEmail,
            signature: sender.signature ?? undefined,
            dailySendQuota: sender.dailySendQuota ?? undefined,
          })),
        saved.id,
      );

      await this.emailCampaignsRepository.replaceChildCollections(
        saved.id,
        steps,
        senders,
      );
    }

    const refreshed = await this.requireCampaign(saved.id, organizationId);
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async updateStatus(
    id: string,
    dto: UpdateEmailCampaignStatusDto,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const campaign = await this.requireCampaign(id, organizationId);

    if (campaign.status === dto.status) {
      return this.emailCampaignMapper.toResponse(campaign);
    }

    const transitionError = getManualCampaignStatusTransitionError(
      campaign.status,
      dto.status,
    );

    if (transitionError) {
      throw new BadRequestException(transitionError);
    }

    if (dto.status === 'draft') {
      const saved = await this.emailCampaignsRepository.resetToDraft(campaign);
      const refreshed = await this.requireCampaign(saved.id, organizationId);
      return this.emailCampaignMapper.toResponse(refreshed);
    }

    campaign.status = dto.status;
    const saved = await this.emailCampaignsRepository.save(campaign);
    const refreshed = await this.requireCampaign(saved.id, organizationId);
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async schedule(
    id: string,
    dto: ScheduleEmailCampaignDto,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireCampaign(id, organizationId);

    if (campaign.status !== 'draft') {
      throw new BadRequestException('Only draft campaigns can be scheduled');
    }

    if (!campaign.audienceListType || !campaign.audienceListId) {
      throw new BadRequestException(
        'Select an audience list before scheduling this campaign',
      );
    }

    if ((campaign.steps ?? []).length === 0) {
      throw new BadRequestException('Campaign sequence is required');
    }

    if ((campaign.mailboxSenders ?? []).length === 0) {
      throw new BadRequestException('At least one sender mailbox is required');
    }

    await this.validateMailboxes(
      campaign.mailboxSenders ?? [],
      resolvedOrganizationId,
      campaign.id,
    );
    this.validateMailboxQuotaTotals(
      campaign.mailboxSenders ?? [],
      dto.dailyBatchSize,
    );

    if (dto.sendingWindowStartMinutes >= dto.sendingWindowEndMinutes) {
      throw new BadRequestException(
        'Sending window end must be after the start time',
      );
    }

    if (!isLaunchDateValid(dto.launchAt, dto.timezone)) {
      throw new BadRequestException('Launch date cannot be in the past');
    }

    const resolvedRecipients = await this.resolveAudienceRecipients(
      campaign.audienceListType,
      campaign.audienceListId,
      resolvedOrganizationId,
    );

    if (resolvedRecipients.length === 0) {
      throw new BadRequestException(
        'Selected audience list has no valid email recipients',
      );
    }

    const activeWeekdays = resolveActiveWeekdays(dto.activeWeekdays);
    const launchAt = createDateInTimezone(
      dto.launchAt,
      dto.sendingWindowStartMinutes,
      dto.timezone,
    );
    const estimatedEndAt = computeEstimatedEndAt(
      dto.launchAt,
      resolvedRecipients.length,
      dto.dailyBatchSize,
      dto.sendingWindowEndMinutes,
      dto.timezone,
      activeWeekdays,
    );

    campaign.launchAt = launchAt;
    campaign.dailyBatchSize = dto.dailyBatchSize;
    campaign.sendingWindowStartMinutes = dto.sendingWindowStartMinutes;
    campaign.sendingWindowEndMinutes = dto.sendingWindowEndMinutes;
    campaign.timezone = dto.timezone;
    campaign.activeWeekdays = activeWeekdays;
    campaign.audienceCount = resolvedRecipients.length;
    campaign.estimatedEndAt = estimatedEndAt;
    campaign.scheduledAt = new Date();
    campaign.status = 'scheduled';
    campaign.sendsTodayCount = 0;
    campaign.sendsTodayDate = null;

    const recipientEntities = resolvedRecipients.map((recipient) => {
      const entity = new EmailCampaignRecipientEntity();
      entity.campaignId = campaign.id;
      entity.email = recipient.email;
      entity.mergeFields = recipient.mergeFields;
      entity.currentStepOrder = 1;
      entity.status = 'pending';
      entity.lastSentAt = null;
      entity.replyCategory = null;
      entity.contactDisposition = 'eligible';
      return entity;
    });

    assignInitialNextSendAtToRecipients(
      recipientEntities,
      dto.launchAt,
      dto.sendingWindowStartMinutes,
      dto.sendingWindowEndMinutes,
      dto.timezone,
      dto.dailyBatchSize,
      activeWeekdays,
      campaign.id,
    );

    const saved =
      await this.emailCampaignsRepository.scheduleCampaignWithRecipients(
        campaign,
        recipientEntities,
      );

    return this.emailCampaignMapper.toResponse(saved);
  }

  async pauseCampaign(
    id: string,
    organizationId: string | null,
    pausedUntilInput: string,
  ): Promise<EmailCampaignResponse> {
    const campaign = await this.requireCampaign(id, organizationId);

    applyCampaignPause(campaign, pausedUntilInput);

    const saved = await this.emailCampaignsRepository.save(campaign);
    const refreshed = await this.requireCampaign(saved.id, organizationId);
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async stopCampaign(
    id: string,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const campaign = await this.requireCampaign(id, organizationId);

    applyCampaignStop(campaign);

    const saved = await this.emailCampaignsRepository.save(campaign);
    const refreshed = await this.requireCampaign(saved.id, organizationId);
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async resumeCampaign(
    id: string,
    organizationId: string | null,
    dto?: ResumeEmailCampaignDto,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireCampaign(id, organizationId);
    const senders = campaign.mailboxSenders ?? [];

    assertCampaignResumeHasActiveSenders(
      senders,
      dto?.resumePausedMailboxSenders,
    );

    if (
      senders.length > 0 &&
      dto?.resumePausedMailboxSenders &&
      senders.some((sender) => sender.status === 'paused')
    ) {
      await this.campaignMailboxSendersService.resumePausedSendersForCampaign(
        campaign,
        resolvedOrganizationId,
      );
    }

    applyCampaignResume(campaign);

    const saved = await this.emailCampaignsRepository.save(campaign);
    const refreshed = await this.requireCampaign(saved.id, organizationId);
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async deleteCampaign(
    id: string,
    organizationId: string | null,
  ): Promise<void> {
    const campaign = await this.requireCampaign(id, organizationId);
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.deleteRequestsService.cancelPendingForCampaign(
      campaign.id,
      resolvedOrganizationId,
    );

    await this.emailCampaignsRepository.deleteById(campaign.id);
  }

  private applyDraftScheduleFields(
    campaign: EmailCampaignEntity,
    dto: UpdateEmailCampaignDto,
  ): void {
    const hasScheduleFieldUpdate =
      dto.launchAt !== undefined ||
      dto.dailyBatchSize !== undefined ||
      dto.sendingWindowStartMinutes !== undefined ||
      dto.sendingWindowEndMinutes !== undefined ||
      dto.timezone !== undefined ||
      dto.activeWeekdays !== undefined;

    if (!hasScheduleFieldUpdate) {
      return;
    }

    if (campaign.status !== 'draft') {
      throw new BadRequestException(
        'Schedule preferences can only be updated while campaign is a draft',
      );
    }

    const sendingWindowStartMinutes =
      dto.sendingWindowStartMinutes ?? campaign.sendingWindowStartMinutes;
    const sendingWindowEndMinutes =
      dto.sendingWindowEndMinutes ?? campaign.sendingWindowEndMinutes;
    const timezone = dto.timezone ?? campaign.timezone;

    if (
      sendingWindowStartMinutes != null &&
      sendingWindowEndMinutes != null &&
      sendingWindowStartMinutes >= sendingWindowEndMinutes
    ) {
      throw new BadRequestException(
        'Sending window end must be after the start time',
      );
    }

    if (dto.dailyBatchSize !== undefined) {
      campaign.dailyBatchSize = dto.dailyBatchSize;
    }

    if (dto.sendingWindowStartMinutes !== undefined) {
      campaign.sendingWindowStartMinutes = dto.sendingWindowStartMinutes;
    }

    if (dto.sendingWindowEndMinutes !== undefined) {
      campaign.sendingWindowEndMinutes = dto.sendingWindowEndMinutes;
    }

    if (dto.timezone !== undefined) {
      campaign.timezone = dto.timezone;
    }

    if (dto.activeWeekdays !== undefined) {
      campaign.activeWeekdays = resolveActiveWeekdays(dto.activeWeekdays);
    }

    if (dto.launchAt !== undefined) {
      if (!timezone || sendingWindowStartMinutes == null) {
        throw new BadRequestException(
          'Timezone and sending window start are required to save a launch date',
        );
      }

      campaign.launchAt = createDateInTimezone(
        dto.launchAt,
        sendingWindowStartMinutes,
        timezone,
      );
    }
  }

  private async validateAudienceList(
    audienceListType: 'contact' | 'manual',
    audienceListId: string,
    organizationId: string,
  ): Promise<void> {
    if (audienceListType === 'contact') {
      const list = await this.contactListsRepository.findByIdAndOrganizationId(
        audienceListId,
        organizationId,
      );

      if (!list) {
        throw new BadRequestException('Selected contact list was not found');
      }

      return;
    }

    const list = await this.manualListsRepository.findByIdAndOrganizationId(
      audienceListId,
      organizationId,
    );

    if (!list) {
      throw new BadRequestException('Selected manual list was not found');
    }
  }

  private async resolveAudienceRecipients(
    audienceListType: 'contact' | 'manual',
    audienceListId: string,
    organizationId: string,
  ) {
    if (audienceListType === 'contact') {
      const members =
        await this.contactListMembersRepository.findByListId(audienceListId);

      return this.audienceResolver.resolveContactListMembers(members);
    }

    const list = await this.manualListsRepository.findByIdAndOrganizationId(
      audienceListId,
      organizationId,
    );

    if (!list) {
      throw new BadRequestException('Selected manual list was not found');
    }

    const rows = await this.manualListsRepository.findRowsByListId(list.id);
    return this.audienceResolver.resolveManualListRows(list.columns, rows);
  }

  private async requireCampaign(
    id: string,
    organizationId: string | null,
  ): Promise<EmailCampaignEntity> {
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        id,
        requireOrganizationId(organizationId),
      );

    if (!campaign) {
      throw new NotFoundException('Email campaign not found');
    }

    return campaign;
  }

  private validateSteps(steps: CreateSequenceStepDto[]): void {
    if (steps.length === 0) {
      throw new BadRequestException('Sequence must contain at least one step');
    }

    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const orders = sorted.map((step) => step.stepOrder);

    for (let index = 0; index < orders.length; index += 1) {
      if (orders[index] !== index + 1) {
        throw new BadRequestException(
          'Sequence steps must have consecutive stepOrder values starting at 1',
        );
      }
    }

    const initial = sorted[0];
    if ((initial.delayMode ?? 'relative') !== 'relative') {
      throw new BadRequestException(
        'Initial outreach step must use relative timing',
      );
    }

    if (initial.delayDays !== 0) {
      throw new BadRequestException(
        'Initial outreach step must have delayDays of 0',
      );
    }

    for (const step of sorted.slice(1)) {
      this.validateFollowUpTiming(step);
    }
  }

  private validateFollowUpTiming(step: CreateSequenceStepDto): void {
    const delayMode = step.delayMode ?? 'relative';

    if (delayMode === 'relative') {
      if (step.delayDays < 1) {
        throw new BadRequestException(
          'Follow-up steps with relative timing must have delayDays of at least 1',
        );
      }
      return;
    }

    if (!step.scheduledDate) {
      throw new BadRequestException(
        'Follow-up steps with absolute timing must include scheduledDate',
      );
    }
  }

  private async validateForeignKeys(
    dto: {
      campaignTypeId?: string;
      brandId?: string;
      regionId?: string;
    },
    organizationId: string,
  ): Promise<void> {
    if (dto.campaignTypeId) {
      await this.requireConfigOption(
        dto.campaignTypeId,
        organizationId,
        'campaign-type',
      );
    }

    if (dto.brandId) {
      await this.requireConfigOption(dto.brandId, organizationId, 'brand');
    }

    if (dto.regionId) {
      await this.requireConfigOption(dto.regionId, organizationId, 'region');
    }
  }

  private async requireConfigOption(
    id: string,
    organizationId: string,
    category: 'campaign-type' | 'brand' | 'region',
  ): Promise<void> {
    const option = await this.emailConfigRepository.findByIdAndOrganizationId(
      id,
      organizationId,
    );

    if (!option || option.category !== category) {
      throw new BadRequestException(`Invalid ${category} reference`);
    }
  }

  private async validateMailboxes(
    senders: Array<{ mailboxId: string; dailySendQuota?: number | null }>,
    organizationId: string,
    excludeCampaignId?: string,
  ): Promise<void> {
    if (senders.length === 0) {
      return;
    }

    for (const sender of senders) {
      const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
        sender.mailboxId,
        organizationId,
      );

      if (!mailbox) {
        throw new BadRequestException(
          `Mailbox ${sender.mailboxId} not found in organization`,
        );
      }

      if (
        sender.dailySendQuota != null &&
        sender.dailySendQuota > mailbox.dailySendLimit
      ) {
        throw new BadRequestException(
          `Daily send quota for "${mailbox.email}" cannot exceed the mailbox limit of ${mailbox.dailySendLimit}`,
        );
      }
    }

    const mailboxIds = senders.map((sender) => sender.mailboxId);
    const conflicts =
      await this.emailCampaignsRepository.findActiveMailboxUsage(
        organizationId,
        mailboxIds,
        excludeCampaignId,
      );

    if (conflicts.length === 0) {
      return;
    }

    const conflict = conflicts[0];
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      conflict.mailboxId,
      organizationId,
    );
    const mailboxLabel = mailbox?.email ?? conflict.mailboxId;

    throw new BadRequestException(
      buildMailboxConflictMessage(mailboxLabel, conflict.campaignName),
    );
  }

  private validateMailboxQuotaTotals(
    senders: Array<{ dailySendQuota?: number | null }>,
    dailyBatchSize: number,
  ): void {
    const sendersWithQuota = senders.filter(
      (sender) => sender.dailySendQuota != null,
    );

    if (sendersWithQuota.length === 0) {
      return;
    }

    const totalQuota = sendersWithQuota.reduce(
      (sum, sender) => sum + (sender.dailySendQuota ?? 0),
      0,
    );

    if (totalQuota > dailyBatchSize) {
      throw new BadRequestException(
        `Total mailbox send quotas (${totalQuota}) cannot exceed the daily batch size (${dailyBatchSize})`,
      );
    }
  }

  private buildStepEntities(
    steps: CreateSequenceStepDto[],
    campaignId?: string,
  ): EmailCampaignSequenceStepEntity[] {
    return [...steps]
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => {
        const entity = new EmailCampaignSequenceStepEntity();
        if (campaignId) {
          entity.campaignId = campaignId;
        }
        entity.stepOrder = step.stepOrder;
        entity.subject = step.subject.trim();
        entity.body = step.body.trim();

        if (step.stepOrder === 1) {
          entity.delayMode = 'relative';
          entity.delayDays = 0;
          entity.scheduledDate = null;
          entity.includeSignature = true;
          return entity;
        }

        const delayMode = step.delayMode ?? 'relative';
        entity.delayMode = delayMode;
        entity.includeSignature = step.includeSignature ?? true;

        if (delayMode === 'absolute') {
          entity.delayDays = 0;
          entity.scheduledDate = step.scheduledDate ?? null;
        } else {
          entity.delayDays = step.delayDays;
          entity.scheduledDate = null;
        }

        return entity;
      });
  }

  private buildSenderEntities(
    senders: Array<{
      mailboxId: string;
      senderName: string;
      senderEmail: string;
      signature?: string;
      dailySendQuota?: number;
    }>,
    campaignId?: string,
  ): EmailCampaignMailboxSenderEntity[] {
    return senders.map((sender) => {
      const entity = new EmailCampaignMailboxSenderEntity();
      if (campaignId) {
        entity.campaignId = campaignId;
      }
      entity.mailboxId = sender.mailboxId;
      entity.senderName = sender.senderName.trim();
      entity.senderEmail = sender.senderEmail.trim().toLowerCase();
      entity.signature = sender.signature?.trim() ?? null;
      entity.dailySendQuota = sender.dailySendQuota ?? null;
      entity.sendsTodayCount = 0;
      entity.sendsTodayDate = null;
      entity.status = 'active';
      return entity;
    });
  }
}
