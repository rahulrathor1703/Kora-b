import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EmailCampaignMailboxSenderEntity } from './entities/email-campaign-mailbox-sender.entity';
import { EmailCampaignSequenceStepEntity } from './entities/email-campaign-sequence-step.entity';
import { EmailCampaignRecipientEntity } from './entities/email-campaign-recipient.entity';
import {
  EmailCampaignEntity,
  EmailCampaignStatus,
} from './entities/email-campaign.entity';
import { applyCampaignResume } from './campaign-action.util';
import {
  MAILBOX_LOCKING_CAMPAIGN_STATUSES,
  type MailboxCampaignUsage,
} from './campaign-mailbox-lock.util';

@Injectable()
export class EmailCampaignsRepository {
  constructor(
    @InjectRepository(EmailCampaignEntity)
    private readonly campaignRepository: Repository<EmailCampaignEntity>,
    @InjectRepository(EmailCampaignMailboxSenderEntity)
    private readonly mailboxSenderRepository: Repository<EmailCampaignMailboxSenderEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findAllByOrganizationId(
    organizationId: string,
  ): Promise<EmailCampaignEntity[]> {
    return this.campaignRepository.find({
      where: { organizationId },
      relations: { steps: true, mailboxSenders: true },
      order: { createdAt: 'DESC', steps: { stepOrder: 'ASC' } },
    });
  }

  findByIdAndOrganizationId(
    id: string,
    organizationId: string,
  ): Promise<EmailCampaignEntity | null> {
    return this.campaignRepository.findOne({
      where: { id, organizationId },
      relations: { steps: true, mailboxSenders: true },
      order: { steps: { stepOrder: 'ASC' } },
    });
  }

  findById(id: string): Promise<EmailCampaignEntity | null> {
    return this.campaignRepository.findOne({
      where: { id },
      relations: { steps: true, mailboxSenders: true },
      order: { steps: { stepOrder: 'ASC' } },
    });
  }

  create(data: Partial<EmailCampaignEntity>): EmailCampaignEntity {
    return this.campaignRepository.create(data);
  }

  save(entity: EmailCampaignEntity): Promise<EmailCampaignEntity> {
    return this.campaignRepository.save(entity);
  }

  saveMailboxSenders(
    senders: EmailCampaignMailboxSenderEntity[],
  ): Promise<EmailCampaignMailboxSenderEntity[]> {
    return this.mailboxSenderRepository.save(senders);
  }

  countByMailboxId(mailboxId: string): Promise<number> {
    return this.mailboxSenderRepository.count({ where: { mailboxId } });
  }

  findCampaignsByMailboxId(
    organizationId: string,
    mailboxId: string,
  ): Promise<
    Array<{
      campaignId: string;
      campaignName: string;
      campaignStatus: EmailCampaignStatus;
      senderId: string;
      senderStatus: EmailCampaignMailboxSenderEntity['status'];
      dailySendQuota: number | null;
      sendsTodayCount: number;
      sendsTodayDate: string | null;
      signature: string | null;
    }>
  > {
    return this.mailboxSenderRepository
      .createQueryBuilder('sender')
      .innerJoin('sender.campaign', 'campaign')
      .select('campaign.id', 'campaignId')
      .addSelect('campaign.name', 'campaignName')
      .addSelect('campaign.status', 'campaignStatus')
      .addSelect('sender.id', 'senderId')
      .addSelect('sender.status', 'senderStatus')
      .addSelect('sender.dailySendQuota', 'dailySendQuota')
      .addSelect('sender.sendsTodayCount', 'sendsTodayCount')
      .addSelect('sender.sendsTodayDate', 'sendsTodayDate')
      .addSelect('sender.signature', 'signature')
      .where('sender.mailboxId = :mailboxId', { mailboxId })
      .andWhere('campaign.organizationId = :organizationId', { organizationId })
      .orderBy('campaign.updatedAt', 'DESC')
      .getRawMany();
  }

  findMailboxSenderByIdAndCampaignId(
    senderId: string,
    campaignId: string,
  ): Promise<EmailCampaignMailboxSenderEntity | null> {
    return this.mailboxSenderRepository.findOne({
      where: { id: senderId, campaignId },
    });
  }

  saveMailboxSender(
    sender: EmailCampaignMailboxSenderEntity,
  ): Promise<EmailCampaignMailboxSenderEntity> {
    return this.mailboxSenderRepository.save(sender);
  }

  async findActiveMailboxUsage(
    organizationId: string,
    mailboxIds: string[],
    excludeCampaignId?: string,
  ): Promise<MailboxCampaignUsage[]> {
    if (mailboxIds.length === 0) {
      return [];
    }

    const query = this.mailboxSenderRepository
      .createQueryBuilder('sender')
      .innerJoin('sender.campaign', 'campaign')
      .select('sender.mailboxId', 'mailboxId')
      .addSelect('campaign.id', 'campaignId')
      .addSelect('campaign.name', 'campaignName')
      .where('campaign.organizationId = :organizationId', { organizationId })
      .andWhere('campaign.status IN (:...statuses)', {
        statuses: [...MAILBOX_LOCKING_CAMPAIGN_STATUSES],
      })
      .andWhere('sender.mailboxId IN (:...mailboxIds)', { mailboxIds })
      .andWhere('sender.status = :senderStatus', { senderStatus: 'active' });

    if (excludeCampaignId) {
      query.andWhere('campaign.id != :excludeCampaignId', {
        excludeCampaignId,
      });
    }

    return query.getRawMany<MailboxCampaignUsage>();
  }

  async replaceChildCollections(
    campaignId: string,
    steps: EmailCampaignSequenceStepEntity[],
    mailboxSenders: EmailCampaignMailboxSenderEntity[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const stepRepo = manager.getRepository(EmailCampaignSequenceStepEntity);
      const senderRepo = manager.getRepository(
        EmailCampaignMailboxSenderEntity,
      );

      await stepRepo.delete({ campaignId });
      await senderRepo.delete({ campaignId });

      if (steps.length > 0) {
        await stepRepo.save(steps);
      }

      if (mailboxSenders.length > 0) {
        await senderRepo.save(mailboxSenders);
      }
    });
  }

  findByStatuses(
    statuses: EmailCampaignStatus[],
  ): Promise<EmailCampaignEntity[]> {
    if (statuses.length === 0) {
      return Promise.resolve([]);
    }

    return this.campaignRepository.find({
      where: { status: In(statuses) },
      relations: { steps: true, mailboxSenders: true },
      order: { steps: { stepOrder: 'ASC' } },
    });
  }

  async addCampaignRecipient(
    campaign: EmailCampaignEntity,
    recipient: EmailCampaignRecipientEntity,
  ): Promise<{
    campaign: EmailCampaignEntity;
    recipient: EmailCampaignRecipientEntity;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const recipientRepo = manager.getRepository(EmailCampaignRecipientEntity);
      const campaignRepo = manager.getRepository(EmailCampaignEntity);

      const savedRecipient = await recipientRepo.save(recipient);
      campaign.audienceCount += 1;
      const savedCampaign = await campaignRepo.save(campaign);

      return { campaign: savedCampaign, recipient: savedRecipient };
    });
  }

  async scheduleCampaignWithRecipients(
    campaign: EmailCampaignEntity,
    recipients: EmailCampaignRecipientEntity[],
  ): Promise<EmailCampaignEntity> {
    return this.dataSource.transaction(async (manager) => {
      const recipientRepo = manager.getRepository(EmailCampaignRecipientEntity);
      const campaignRepo = manager.getRepository(EmailCampaignEntity);

      await recipientRepo.delete({ campaignId: campaign.id });

      if (recipients.length > 0) {
        await recipientRepo.insert(recipients);
      }

      return campaignRepo.save(campaign);
    });
  }

  findByAudienceList(
    organizationId: string,
    audienceListType: 'contact' | 'manual',
    audienceListId: string,
  ): Promise<EmailCampaignEntity[]> {
    return this.campaignRepository.find({
      where: { organizationId, audienceListType, audienceListId },
      order: { createdAt: 'DESC' },
    });
  }

  async resetToDraft(
    campaign: EmailCampaignEntity,
  ): Promise<EmailCampaignEntity> {
    return this.dataSource.transaction(async (manager) => {
      const recipientRepo = manager.getRepository(EmailCampaignRecipientEntity);
      const campaignRepo = manager.getRepository(EmailCampaignEntity);

      await recipientRepo.delete({ campaignId: campaign.id });

      campaign.status = 'draft';
      campaign.launchAt = null;
      campaign.scheduledAt = null;
      campaign.estimatedEndAt = null;
      campaign.timezone = null;
      campaign.activeWeekdays = null;
      campaign.sendingWindowStartMinutes = null;
      campaign.sendingWindowEndMinutes = null;
      campaign.dailyBatchSize = 50;
      campaign.audienceCount = 0;
      campaign.sendsTodayCount = 0;
      campaign.sendsTodayDate = null;
      campaign.pausedUntil = null;
      campaign.statusBeforePause = null;

      return campaignRepo.save(campaign);
    });
  }

  async resumeExpiredPauses(now: Date): Promise<number> {
    const expired = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.status = :status', { status: 'paused' })
      .andWhere('campaign.pausedUntil IS NOT NULL')
      .andWhere('campaign.pausedUntil <= :now', { now })
      .getMany();

    if (expired.length === 0) {
      return 0;
    }

    for (const campaign of expired) {
      applyCampaignResume(campaign);
    }

    await this.campaignRepository.save(expired);
    return expired.length;
  }

  async deleteById(id: string): Promise<void> {
    await this.campaignRepository.delete({ id });
  }
}
