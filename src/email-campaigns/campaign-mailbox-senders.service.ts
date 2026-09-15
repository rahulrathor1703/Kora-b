import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { MailboxesRepository } from '../mailboxes/mailboxes.repository';
import {
  applyCampaignPause,
  applyCampaignPauseManual,
} from './campaign-action.util';
import {
  assertLiveCampaignMailboxActionAllowed,
  assertMailboxNotDuplicate,
  assertMinActiveSendersRemain,
  assertPauseMailboxSenderAllowed,
  assertResumeMailboxSenderAllowed,
  assertStopMailboxSenderAllowed,
  countActiveSenders,
} from './campaign-mailbox-sender-action.util';
import { buildMailboxConflictMessage } from './campaign-mailbox-lock.util';
import type {
  CreateMailboxSenderDto,
  PauseCampaignMailboxSenderDto,
  StopCampaignMailboxSenderDto,
  UpdateCampaignMailboxSenderDto,
} from './dto/email-campaign.dto';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import type { EmailCampaignEntity } from './entities/email-campaign.entity';
import {
  EmailCampaignMapper,
  type EmailCampaignMailboxSenderResponse,
  type EmailCampaignResponse,
} from './mappers/email-campaign.mapper';

@Injectable()
export class CampaignMailboxSendersService {
  constructor(
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly mailboxesRepository: MailboxesRepository,
    private readonly emailCampaignMapper: EmailCampaignMapper,
  ) {}

  async addSender(
    campaignId: string,
    dto: CreateMailboxSenderDto,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireLiveCampaign(
      campaignId,
      resolvedOrganizationId,
    );

    assertMailboxNotDuplicate(campaign.mailboxSenders ?? [], dto.mailboxId);

    await this.validateMailboxAssignment(
      dto.mailboxId,
      dto.dailySendQuota,
      resolvedOrganizationId,
      campaign.id,
    );

    const activeSenders = this.getActiveSenders(campaign);
    this.validateQuotaTotals(
      [
        ...activeSenders.map((sender) => ({
          dailySendQuota: sender.dailySendQuota,
        })),
        { dailySendQuota: dto.dailySendQuota },
      ],
      campaign.dailyBatchSize,
    );

    const sender = new EmailCampaignMailboxSenderEntity();
    sender.campaignId = campaign.id;
    sender.mailboxId = dto.mailboxId;
    sender.senderName = dto.senderName.trim();
    sender.senderEmail = dto.senderEmail.trim().toLowerCase();
    sender.signature = dto.signature?.trim() ?? null;
    sender.dailySendQuota = dto.dailySendQuota;
    sender.sendsTodayCount = 0;
    sender.sendsTodayDate = null;
    sender.status = 'active';

    await this.emailCampaignsRepository.saveMailboxSender(sender);

    const refreshed = await this.requireCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async updateSender(
    campaignId: string,
    senderId: string,
    dto: UpdateCampaignMailboxSenderDto,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireLiveCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    const sender = this.requireSender(campaign, senderId);

    if (sender.status === 'stopped') {
      throw new BadRequestException('Stopped mailbox senders cannot be edited');
    }

    const nextMailboxId = dto.mailboxId ?? sender.mailboxId;

    if (dto.mailboxId && dto.mailboxId !== sender.mailboxId) {
      assertMailboxNotDuplicate(
        campaign.mailboxSenders ?? [],
        dto.mailboxId,
        senderId,
      );

      await this.validateMailboxAssignment(
        dto.mailboxId,
        dto.dailySendQuota ?? sender.dailySendQuota,
        resolvedOrganizationId,
        campaign.id,
      );

      sender.mailboxId = dto.mailboxId;
      sender.sendsTodayCount = 0;
      sender.sendsTodayDate = null;
    } else if (dto.mailboxId) {
      await this.validateMailboxAssignment(
        nextMailboxId,
        dto.dailySendQuota ?? sender.dailySendQuota,
        resolvedOrganizationId,
        campaign.id,
      );
    } else if (dto.dailySendQuota !== undefined) {
      await this.validateMailboxQuota(
        nextMailboxId,
        dto.dailySendQuota,
        resolvedOrganizationId,
      );
    }

    if (dto.senderName !== undefined) {
      sender.senderName = dto.senderName.trim();
    }

    if (dto.senderEmail !== undefined) {
      sender.senderEmail = dto.senderEmail.trim().toLowerCase();
    }

    if (dto.signature !== undefined) {
      sender.signature = dto.signature.trim() || null;
    }

    if (dto.dailySendQuota !== undefined) {
      sender.dailySendQuota = dto.dailySendQuota;
    }

    const activeSenders = this.getActiveSenders(campaign).filter(
      (candidate) => candidate.id !== sender.id,
    );

    if (sender.status === 'active') {
      this.validateQuotaTotals(
        [
          ...activeSenders.map((candidate) => ({
            dailySendQuota: candidate.dailySendQuota,
          })),
          { dailySendQuota: sender.dailySendQuota },
        ],
        campaign.dailyBatchSize,
      );
    }

    await this.emailCampaignsRepository.saveMailboxSender(sender);

    const refreshed = await this.requireCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async pauseSender(
    campaignId: string,
    senderId: string,
    organizationId: string | null,
    dto?: PauseCampaignMailboxSenderDto,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireLiveCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    const sender = this.requireSender(campaign, senderId);

    assertPauseMailboxSenderAllowed(sender.status);

    const activeCount = countActiveSenders(campaign.mailboxSenders ?? []);
    const isLastActiveSender = activeCount <= 1;

    if (isLastActiveSender && campaign.status !== 'paused') {
      if (!dto?.pauseCampaign || !dto.pausedUntil) {
        assertMinActiveSendersRemain(activeCount, 'pause');
      } else {
        applyCampaignPause(campaign, dto.pausedUntil);
        await this.emailCampaignsRepository.save(campaign);
      }
    }

    sender.status = 'paused';
    await this.emailCampaignsRepository.saveMailboxSender(sender);

    const refreshed = await this.requireCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async resumeSender(
    campaignId: string,
    senderId: string,
    organizationId: string | null,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireLiveCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    const sender = this.requireSender(campaign, senderId);

    assertResumeMailboxSenderAllowed(sender.status);

    await this.validateMailboxAssignment(
      sender.mailboxId,
      sender.dailySendQuota,
      resolvedOrganizationId,
      campaign.id,
    );

    const activeSenders = this.getActiveSenders(campaign);
    this.validateQuotaTotals(
      [
        ...activeSenders.map((candidate) => ({
          dailySendQuota: candidate.dailySendQuota,
        })),
        { dailySendQuota: sender.dailySendQuota },
      ],
      campaign.dailyBatchSize,
    );

    sender.status = 'active';
    await this.emailCampaignsRepository.saveMailboxSender(sender);

    const refreshed = await this.requireCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  async resumePausedSendersForCampaign(
    campaign: EmailCampaignEntity,
    organizationId: string,
  ): Promise<void> {
    const pausedSenders = (campaign.mailboxSenders ?? []).filter(
      (sender) => sender.status === 'paused',
    );

    if (pausedSenders.length === 0) {
      throw new BadRequestException('No paused mailbox senders to resume');
    }

    for (const sender of pausedSenders) {
      assertResumeMailboxSenderAllowed(sender.status);
      await this.validateMailboxAssignment(
        sender.mailboxId,
        sender.dailySendQuota,
        organizationId,
        campaign.id,
      );
    }

    const activeSenders = this.getActiveSenders(campaign);
    this.validateQuotaTotals(
      [
        ...activeSenders.map((candidate) => ({
          dailySendQuota: candidate.dailySendQuota,
        })),
        ...pausedSenders.map((candidate) => ({
          dailySendQuota: candidate.dailySendQuota,
        })),
      ],
      campaign.dailyBatchSize,
    );

    for (const sender of pausedSenders) {
      sender.status = 'active';
      await this.emailCampaignsRepository.saveMailboxSender(sender);
    }
  }

  async stopSender(
    campaignId: string,
    senderId: string,
    organizationId: string | null,
    dto?: StopCampaignMailboxSenderDto,
  ): Promise<EmailCampaignResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const campaign = await this.requireLiveCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    const sender = this.requireSender(campaign, senderId);

    assertStopMailboxSenderAllowed(sender.status);

    if (sender.status === 'active') {
      const activeCount = countActiveSenders(campaign.mailboxSenders ?? []);
      const isLastActiveSender = activeCount <= 1;

      if (isLastActiveSender && campaign.status !== 'paused') {
        if (!dto?.pauseCampaign) {
          assertMinActiveSendersRemain(activeCount, 'stop');
        } else {
          applyCampaignPauseManual(campaign);
          await this.emailCampaignsRepository.save(campaign);
        }
      }
    }

    sender.status = 'stopped';
    await this.emailCampaignsRepository.saveMailboxSender(sender);

    const refreshed = await this.requireCampaign(
      campaignId,
      resolvedOrganizationId,
    );
    return this.emailCampaignMapper.toResponse(refreshed);
  }

  private async requireLiveCampaign(
    id: string,
    organizationId: string,
  ): Promise<EmailCampaignEntity> {
    const campaign = await this.requireCampaign(id, organizationId);
    assertLiveCampaignMailboxActionAllowed(campaign.status);
    return campaign;
  }

  private async requireCampaign(
    id: string,
    organizationId: string,
  ): Promise<EmailCampaignEntity> {
    const campaign =
      await this.emailCampaignsRepository.findByIdAndOrganizationId(
        id,
        organizationId,
      );

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  private requireSender(
    campaign: EmailCampaignEntity,
    senderId: string,
  ): EmailCampaignMailboxSenderEntity {
    const sender = (campaign.mailboxSenders ?? []).find(
      (candidate) => candidate.id === senderId,
    );

    if (!sender) {
      throw new NotFoundException('Mailbox sender not found');
    }

    return sender;
  }

  private getActiveSenders(
    campaign: EmailCampaignEntity,
  ): EmailCampaignMailboxSenderEntity[] {
    return (campaign.mailboxSenders ?? []).filter(
      (sender) => sender.status === 'active',
    );
  }

  private async validateMailboxAssignment(
    mailboxId: string,
    dailySendQuota: number | null | undefined,
    organizationId: string,
    excludeCampaignId: string,
  ): Promise<void> {
    await this.validateMailboxQuota(mailboxId, dailySendQuota, organizationId);
    await this.validateMailboxLock(
      mailboxId,
      organizationId,
      excludeCampaignId,
    );
  }

  private async validateMailboxQuota(
    mailboxId: string,
    dailySendQuota: number | null | undefined,
    organizationId: string,
  ): Promise<void> {
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      mailboxId,
      organizationId,
    );

    if (!mailbox) {
      throw new BadRequestException(
        `Mailbox ${mailboxId} not found in organization`,
      );
    }

    if (mailbox.status !== 'active') {
      throw new BadRequestException(
        `Mailbox "${mailbox.email}" must be active to send from a campaign`,
      );
    }

    if (dailySendQuota != null && dailySendQuota > mailbox.dailySendLimit) {
      throw new BadRequestException(
        `Daily send quota for "${mailbox.email}" cannot exceed the mailbox limit of ${mailbox.dailySendLimit}`,
      );
    }
  }

  private async validateMailboxLock(
    mailboxId: string,
    organizationId: string,
    excludeCampaignId: string,
  ): Promise<void> {
    const conflicts =
      await this.emailCampaignsRepository.findActiveMailboxUsage(
        organizationId,
        [mailboxId],
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

  private validateQuotaTotals(
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
}

export type { EmailCampaignMailboxSenderResponse };
