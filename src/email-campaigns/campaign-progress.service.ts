import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { CampaignProgressMapper } from './mappers/campaign-progress.mapper';
import { CampaignRecipientMapper } from './mappers/campaign-recipient.mapper';
import type { PaginatedCampaignRecipientsResponse } from './mappers/campaign-recipient.mapper';
import type { CampaignRecipientResponse } from './mappers/campaign-recipient.mapper';
import type {
  ProspectCampaignItemResponse,
  ProspectCampaignListResponse,
} from './mappers/prospect-campaign.mapper';
import type { CampaignRecipientsQueryDto } from './dto/campaign-recipients-query.dto';
import type { AddEmailCampaignRecipientDto } from './dto/email-campaign.dto';
import type { CampaignRecipientEngagementStatus } from './mappers/campaign-recipient.mapper';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import { EmailCampaignMessagesRepository } from './email-campaign-messages.repository';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailExcludedRepository } from './email-excluded.repository';
import { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';
import type { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';
import type { EmailCampaignProgressResponse } from './mappers/campaign-progress.mapper';
import {
  assertExcludeRecipientGloballyAllowed,
  assertPauseRecipientAllowed,
  assertResumeRecipientAllowed,
  assertStopRecipientAllowed,
  applyManualPauseResume,
  parsePausedUntil,
} from './campaign-recipient-action.util';
import { getCalendarDateKeyInTimezone } from './campaign-schedule.util';
import { computeInitialNextSendAt } from './campaign-send-spacing.util';

@Injectable()
export class CampaignProgressService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly messagesRepository: EmailCampaignMessagesRepository,
    private readonly campaignProgressMapper: CampaignProgressMapper,
    private readonly campaignRecipientMapper: CampaignRecipientMapper,
  ) {}

  async getProgress(
    campaignId: string,
    organizationId: string | null,
  ): Promise<EmailCampaignProgressResponse> {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const steps = [...(campaign.steps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );

    const [
      totalContacts,
      contactsLeft,
      sentCount,
      completedCount,
      noReplyYetCount,
      engagementSent,
      engagementOpened,
      engagementClicked,
      engagementReplied,
      engagementBounced,
    ] = await Promise.all([
      this.recipientsRepository.countByCampaignId(campaign.id),
      this.recipientsRepository.countIncompleteByCampaignId(campaign.id),
      this.recipientsRepository.countWithLastSentAt(campaign.id),
      this.recipientsRepository.countCompletedByCampaignId(campaign.id),
      this.recipientsRepository.countNoReplyYet(campaign.id),
      this.messagesRepository.countDeliveredByCampaignId(campaign.id),
      this.messagesRepository.countOpenedByCampaignId(campaign.id),
      this.messagesRepository.countClickedByCampaignId(campaign.id),
      this.recipientsRepository.countRepliedByCampaignId(campaign.id),
      this.messagesRepository.countBouncedByCampaignId(campaign.id),
    ]);

    const funnelCounts = await Promise.all(
      steps.map((step) =>
        this.recipientsRepository.countByMaxStepSentAtLeast(
          campaign.id,
          step.stepOrder,
        ),
      ),
    );

    const replyCategories = [
      'interested',
      'not_now',
      'no',
      'ooo',
      'wrong_person',
    ] as const;
    const replyCountEntries = await Promise.all(
      replyCategories.map(
        async (category) =>
          [
            category,
            await this.recipientsRepository.countByReplyCategory(
              campaign.id,
              category,
            ),
          ] as const,
      ),
    );

    const dispositions = [
      'excluded',
      'paused',
      'stopped',
      'unsubscribed',
      'done',
      'eligible',
    ] as const;
    const dispositionCountEntries = await Promise.all(
      dispositions.map(async (disposition) => {
        if (disposition === 'eligible') {
          return [
            disposition,
            await this.recipientsRepository.countEligibleNotContacted(
              campaign.id,
            ),
          ] as const;
        }

        return [
          disposition,
          await this.recipientsRepository.countByDisposition(
            campaign.id,
            disposition,
          ),
        ] as const;
      }),
    );

    const recipientStatusBreakdown = await this.computeRecipientStatusBreakdown(
      campaign.id,
    );

    return this.campaignProgressMapper.toResponse({
      campaign,
      totalContacts,
      contactsLeft,
      sentCount,
      completedCount,
      funnelCounts,
      replyCounts: Object.fromEntries(replyCountEntries),
      noReplyYetCount,
      dispositionCounts: Object.fromEntries(dispositionCountEntries),
      engagementSent,
      engagementOpened,
      engagementClicked,
      engagementReplied,
      engagementBounced,
      recipientStatusBreakdown,
    });
  }

  private async computeRecipientStatusBreakdown(
    campaignId: string,
  ): Promise<Record<CampaignRecipientEngagementStatus, number>> {
    const statuses: CampaignRecipientEngagementStatus[] = [
      'pending',
      'sent',
      'opened',
      'clicked',
      'bounced',
      'replied',
    ];
    const counts = Object.fromEntries(
      statuses.map((status) => [status, 0]),
    ) as Record<CampaignRecipientEngagementStatus, number>;

    const recipients =
      await this.recipientsRepository.findByCampaignId(campaignId);
    const recipientIds = recipients.map((recipient) => recipient.id);
    const messages =
      await this.messagesRepository.findByCampaignIdAndRecipientIds(
        campaignId,
        recipientIds,
      );
    const messagesByRecipient = new Map<string, EmailCampaignMessageEntity[]>();

    for (const message of messages) {
      const existing = messagesByRecipient.get(message.recipientId) ?? [];
      existing.push(message);
      messagesByRecipient.set(message.recipientId, existing);
    }

    for (const recipient of recipients) {
      const recipientMessages = messagesByRecipient.get(recipient.id) ?? [];
      const mapped = this.campaignRecipientMapper.toResponse(
        recipient,
        recipientMessages,
      );
      counts[mapped.engagement.status] += 1;
    }

    return counts;
  }

  private async requireCampaign(
    id: string,
    organizationId: string | null,
  ): Promise<EmailCampaignEntity> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        id,
        resolvedOrganizationId,
      );

    if (!campaign) {
      throw new NotFoundException('Email campaign not found');
    }

    return campaign;
  }
}

@Injectable()
export class EmailCampaignRecipientsService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly messagesRepository: EmailCampaignMessagesRepository,
    private readonly excludedRepository: EmailExcludedRepository,
    private readonly campaignRecipientMapper: CampaignRecipientMapper,
  ) {}

  async listRecipients(
    campaignId: string,
    organizationId: string | null,
    query: CampaignRecipientsQueryDto,
  ): Promise<PaginatedCampaignRecipientsResponse> {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const recipients =
      await this.recipientsRepository.findByCampaignIdWithSearch(
        campaign.id,
        query.search,
      );

    const recipientIds = recipients.map((recipient) => recipient.id);
    const allMessages =
      await this.messagesRepository.findByCampaignIdAndRecipientIds(
        campaign.id,
        recipientIds,
      );
    const messagesByRecipient = this.groupMessagesByRecipient(allMessages);
    const excludedEmails = new Set(
      await this.excludedRepository.findEmailsByOrganizationId(
        campaign.organizationId,
      ),
    );

    const mapped = recipients.map((recipient) =>
      this.toRecipientResponse(
        campaign.id,
        recipient,
        messagesByRecipient.get(recipient.id) ?? [],
        excludedEmails.has(recipient.email.toLowerCase()),
      ),
    );

    let filtered = mapped;

    if (query.status) {
      filtered = filtered.filter(
        (item) => item.engagement.status === query.status,
      );
    }

    if (query.disposition) {
      filtered = filtered.filter(
        (item) => item.contactDisposition === query.disposition,
      );
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { items, total, page, limit };
  }

  async getRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
  ): Promise<CampaignRecipientResponse> {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const recipient = await this.recipientsRepository.findByIdAndCampaignId(
      recipientId,
      campaign.id,
    );

    if (!recipient) {
      throw new NotFoundException('Campaign recipient not found');
    }

    const messages =
      await this.messagesRepository.findByCampaignIdAndRecipientIds(
        campaign.id,
        [recipient.id],
      );

    return this.toRecipientResponse(
      campaign.id,
      recipient,
      messages,
      Boolean(
        await this.excludedRepository.findByOrganizationIdAndEmail(
          campaign.organizationId,
          recipient.email,
        ),
      ),
    );
  }

  async updateRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
    input: {
      replyCategory?: string | null;
      contactDisposition?: string;
    },
  ) {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const recipient = await this.recipientsRepository.findByIdAndCampaignId(
      recipientId,
      campaign.id,
    );

    if (!recipient) {
      throw new NotFoundException('Campaign recipient not found');
    }

    if (input.replyCategory !== undefined) {
      if (input.replyCategory !== null && recipient.lastSentAt === null) {
        throw new BadRequestException(
          'Reply category can only be set after the recipient has been contacted',
        );
      }

      recipient.replyCategory =
        input.replyCategory as typeof recipient.replyCategory;
    }

    if (input.contactDisposition !== undefined) {
      if (input.contactDisposition === 'done') {
        throw new BadRequestException(
          'Done disposition is managed automatically by the send pipeline',
        );
      }

      if (input.contactDisposition === 'excluded') {
        if (recipient.contactDisposition === 'unsubscribed') {
          throw new BadRequestException(
            'Cannot exclude an unsubscribed contact',
          );
        }

        recipient.contactDisposition = 'excluded';
        recipient.nextSendAt = null;
      } else if (input.contactDisposition === 'eligible') {
        if (recipient.contactDisposition !== 'excluded') {
          throw new BadRequestException(
            'Only excluded contacts can be re-included',
          );
        }

        recipient.contactDisposition = 'eligible';
      } else {
        recipient.contactDisposition =
          input.contactDisposition as typeof recipient.contactDisposition;
      }
    }

    const saved = await this.recipientsRepository.save(recipient);

    const messages =
      await this.messagesRepository.findByCampaignIdAndRecipientIds(
        campaign.id,
        [saved.id],
      );

    const globallyExcluded = Boolean(
      await this.excludedRepository.findByOrganizationIdAndEmail(
        campaign.organizationId,
        saved.email,
      ),
    );

    return this.toRecipientResponse(
      campaign.id,
      saved,
      messages,
      globallyExcluded,
    );
  }

  async excludeRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
  ) {
    return this.updateRecipient(campaignId, recipientId, organizationId, {
      contactDisposition: 'excluded',
    });
  }

  async includeRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
  ) {
    return this.updateRecipient(campaignId, recipientId, organizationId, {
      contactDisposition: 'eligible',
    });
  }

  async pauseRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
    pausedUntilInput: string,
  ) {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const recipient = await this.requireRecipient(campaign.id, recipientId);
    const globallyExcluded = Boolean(
      await this.excludedRepository.findByOrganizationIdAndEmail(
        campaign.organizationId,
        recipient.email,
      ),
    );

    assertPauseRecipientAllowed(recipient.contactDisposition);

    const pausedUntil = parsePausedUntil(pausedUntilInput);

    recipient.contactDisposition = 'paused';
    recipient.pausedUntil = pausedUntil;
    recipient.nextSendAt = null;

    return this.saveRecipientResponse(campaign.id, recipient, globallyExcluded);
  }

  async stopRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
  ) {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const recipient = await this.requireRecipient(campaign.id, recipientId);
    const globallyExcluded = Boolean(
      await this.excludedRepository.findByOrganizationIdAndEmail(
        campaign.organizationId,
        recipient.email,
      ),
    );

    assertStopRecipientAllowed(recipient.contactDisposition);

    recipient.contactDisposition = 'stopped';
    recipient.nextSendAt = null;
    recipient.pausedUntil = null;

    return this.saveRecipientResponse(campaign.id, recipient, globallyExcluded);
  }

  async resumeRecipient(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
  ) {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const recipient = await this.requireRecipient(campaign.id, recipientId);
    const globallyExcluded = Boolean(
      await this.excludedRepository.findByOrganizationIdAndEmail(
        campaign.organizationId,
        recipient.email,
      ),
    );

    assertResumeRecipientAllowed(
      recipient.contactDisposition,
      recipient.pausedUntil,
      recipient.repliedAt,
    );

    applyManualPauseResume(recipient);

    return this.saveRecipientResponse(campaign.id, recipient, globallyExcluded);
  }

  async excludeRecipientGlobally(
    campaignId: string,
    recipientId: string,
    organizationId: string | null,
  ) {
    const campaign = await this.requireCampaign(campaignId, organizationId);
    const recipient = await this.requireRecipient(campaign.id, recipientId);
    const globallyExcluded = Boolean(
      await this.excludedRepository.findByOrganizationIdAndEmail(
        campaign.organizationId,
        recipient.email,
      ),
    );

    assertExcludeRecipientGloballyAllowed(
      recipient.contactDisposition,
      globallyExcluded,
    );

    await this.excludedRepository.upsertExcludedAddress({
      organizationId: campaign.organizationId,
      email: recipient.email,
      reason: 'Manually excluded from campaign',
      sourceCampaignId: campaign.id,
    });

    await this.recipientsRepository.stopActiveRecipientsByEmailInOrganization(
      campaign.organizationId,
      recipient.email,
    );

    const updated = await this.recipientsRepository.findByIdAndCampaignId(
      recipientId,
      campaign.id,
    );

    if (!updated) {
      throw new NotFoundException('Campaign recipient not found');
    }

    const messages =
      await this.messagesRepository.findByCampaignIdAndRecipientIds(
        campaign.id,
        [updated.id],
      );

    return this.toRecipientResponse(campaign.id, updated, messages, true);
  }

  async addRecipient(
    campaignId: string,
    organizationId: string | null,
    dto: AddEmailCampaignRecipientDto,
  ): Promise<CampaignRecipientResponse> {
    const campaign = await this.requireCampaign(campaignId, organizationId);

    if (campaign.status !== 'scheduled' && campaign.status !== 'sending') {
      throw new BadRequestException(
        'Recipients can only be added while a campaign is scheduled or sending',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.recipientsRepository.findByCampaignIdAndEmail(
      campaign.id,
      normalizedEmail,
    );

    if (existing) {
      throw new BadRequestException('This email is already in the campaign');
    }

    const excluded = await this.excludedRepository.findByOrganizationIdAndEmail(
      campaign.organizationId,
      normalizedEmail,
    );

    if (excluded) {
      throw new BadRequestException(
        'This email is on the organization exclusion list',
      );
    }

    const firstName = dto.firstName?.trim() ?? '';
    const lastName = dto.lastName?.trim() ?? '';
    const company = dto.company?.trim() ?? '';

    const recipient = new EmailCampaignRecipientEntity();
    recipient.campaignId = campaign.id;
    recipient.email = normalizedEmail;
    recipient.mergeFields = {
      email: normalizedEmail,
      first_name: firstName,
      last_name: lastName,
      full_name: [firstName, lastName].filter(Boolean).join(' ').trim(),
      company,
    };
    recipient.currentStepOrder = 1;
    recipient.status = 'pending';
    recipient.lastSentAt = null;
    if (
      campaign.launchAt &&
      campaign.timezone &&
      campaign.sendingWindowStartMinutes !== null &&
      campaign.sendingWindowEndMinutes !== null
    ) {
      recipient.nextSendAt = computeInitialNextSendAt(
        campaign.audienceCount,
        campaign.audienceCount + 1,
        campaign.dailyBatchSize,
        getCalendarDateKeyInTimezone(campaign.launchAt, campaign.timezone),
        campaign.sendingWindowStartMinutes,
        campaign.sendingWindowEndMinutes,
        campaign.timezone,
        campaign.activeWeekdays,
        campaign.id,
      );
    } else {
      recipient.nextSendAt = null;
    }
    recipient.replyCategory = null;
    recipient.contactDisposition = 'eligible';

    const { recipient: savedRecipient } =
      await this.emailCampaignsRepository.addCampaignRecipient(
        campaign,
        recipient,
      );

    return this.campaignRecipientMapper.toResponse(savedRecipient, [], false);
  }

  async listAudience(
    organizationId: string | null,
    query: {
      campaignId?: string;
      disposition?: 'all' | 'eligible' | 'excluded';
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const { items, total } =
      await this.recipientsRepository.findAudienceByOrganizationId({
        organizationId: resolvedOrganizationId,
        campaignId: query.campaignId,
        disposition: query.disposition ?? 'all',
        search: query.search,
        page,
        limit,
      });

    return {
      items: items.map((row) => ({
        id: row.id,
        email: row.email,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        audienceListType: row.audienceListType,
        audienceListId: row.audienceListId,
        currentStepOrder: row.currentStepOrder,
        contactDisposition: row.contactDisposition,
        lastSentAt: row.lastSentAt?.toISOString() ?? null,
        mergeFields: row.mergeFields,
      })),
      total,
      page,
      limit,
    };
  }

  async listByProspectEmail(
    organizationId: string | null,
    email: string,
  ): Promise<ProspectCampaignListResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return { items: [], total: 0 };
    }

    const recipients =
      await this.recipientsRepository.findByEmailAndOrganizationId(
        resolvedOrganizationId,
        normalizedEmail,
      );

    if (recipients.length === 0) {
      return { items: [], total: 0 };
    }

    const excludedEmails = new Set(
      await this.excludedRepository.findEmailsByOrganizationId(
        resolvedOrganizationId,
      ),
    );

    const recipientsByCampaign = new Map<
      string,
      EmailCampaignRecipientEntity[]
    >();

    for (const recipient of recipients) {
      const existing = recipientsByCampaign.get(recipient.campaignId) ?? [];
      existing.push(recipient);
      recipientsByCampaign.set(recipient.campaignId, existing);
    }

    const messagesByRecipient = new Map<string, EmailCampaignMessageEntity[]>();

    for (const [campaignId, campaignRecipients] of recipientsByCampaign) {
      const recipientIds = campaignRecipients.map((recipient) => recipient.id);
      const messages =
        await this.messagesRepository.findByCampaignIdAndRecipientIds(
          campaignId,
          recipientIds,
        );

      for (const message of messages) {
        const existing = messagesByRecipient.get(message.recipientId) ?? [];
        existing.push(message);
        messagesByRecipient.set(message.recipientId, existing);
      }
    }

    const items: ProspectCampaignItemResponse[] = recipients.map(
      (recipient) => {
        const campaign = recipient.campaign;

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          audienceListType: campaign.audienceListType,
          audienceListId: campaign.audienceListId,
          recipient: this.toRecipientResponse(
            campaign.id,
            recipient,
            messagesByRecipient.get(recipient.id) ?? [],
            excludedEmails.has(recipient.email.toLowerCase()),
          ),
        };
      },
    );

    return { items, total: items.length };
  }

  private groupMessagesByRecipient(
    messages: EmailCampaignMessageEntity[],
  ): Map<string, EmailCampaignMessageEntity[]> {
    const grouped = new Map<string, EmailCampaignMessageEntity[]>();

    for (const message of messages) {
      const existing = grouped.get(message.recipientId) ?? [];
      existing.push(message);
      grouped.set(message.recipientId, existing);
    }

    return grouped;
  }

  private async requireRecipient(
    campaignId: string,
    recipientId: string,
  ): Promise<EmailCampaignRecipientEntity> {
    const recipient = await this.recipientsRepository.findByIdAndCampaignId(
      recipientId,
      campaignId,
    );

    if (!recipient) {
      throw new NotFoundException('Campaign recipient not found');
    }

    return recipient;
  }

  private async saveRecipientResponse(
    campaignId: string,
    recipient: EmailCampaignRecipientEntity,
    globallyExcluded = false,
  ) {
    const saved = await this.recipientsRepository.save(recipient);
    const messages =
      await this.messagesRepository.findByCampaignIdAndRecipientIds(
        campaignId,
        [saved.id],
      );

    return this.toRecipientResponse(
      campaignId,
      saved,
      messages,
      globallyExcluded,
    );
  }

  private toRecipientResponse(
    campaignId: string,
    recipient: EmailCampaignRecipientEntity,
    messages: EmailCampaignMessageEntity[],
    globallyExcluded = false,
  ) {
    return this.campaignRecipientMapper.toResponse(
      recipient,
      messages,
      globallyExcluded,
    );
  }

  private async requireCampaign(
    id: string,
    organizationId: string | null,
  ): Promise<EmailCampaignEntity> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        id,
        resolvedOrganizationId,
      );

    if (!campaign) {
      throw new NotFoundException('Email campaign not found');
    }

    return campaign;
  }
}
