import { Injectable } from '@nestjs/common';
import type { EmailCampaignMailboxSenderEntity } from '../entities/email-campaign-mailbox-sender.entity';
import type { EmailCampaignSequenceStepEntity } from '../entities/email-campaign-sequence-step.entity';
import { resolveActiveWeekdays } from '../campaign-schedule.util';
import type {
  EmailCampaignEntity,
  EmailCampaignStatus,
  EmailCampaignStatusBeforePause,
  AudienceListType,
} from '../entities/email-campaign.entity';

export interface EmailCampaignSequenceStepResponse {
  id: string;
  stepOrder: number;
  subject: string;
  body: string;
  delayMode: 'relative' | 'absolute';
  delayDays: number;
  scheduledDate: string | null;
  includeSignature: boolean;
}

export interface EmailCampaignMailboxSenderResponse {
  id: string;
  mailboxId: string;
  senderName: string;
  senderEmail: string;
  signature: string | null;
  dailySendQuota: number | null;
  status: 'active' | 'paused' | 'stopped';
  sendsTodayCount: number;
  sendsTodayDate: string | null;
}

export interface EmailCampaignResponse {
  id: string;
  publicCampaignId: string | null;
  name: string;
  goal: string | null;
  status: EmailCampaignStatus;
  campaignTypeId: string | null;
  brandId: string | null;
  regionId: string | null;
  customFieldValues: Record<string, string>;
  audienceListType: AudienceListType | null;
  audienceListId: string | null;
  audienceCount: number;
  launchAt: string | null;
  dailyBatchSize: number;
  sendingWindowStartMinutes: number | null;
  sendingWindowEndMinutes: number | null;
  timezone: string | null;
  activeWeekdays: number[];
  estimatedEndAt: string | null;
  scheduledAt: string | null;
  pausedUntil: string | null;
  statusBeforePause: EmailCampaignStatusBeforePause | null;
  wizardStepIndex: number | null;
  steps: EmailCampaignSequenceStepResponse[];
  mailboxSenders: EmailCampaignMailboxSenderResponse[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EmailCampaignMapper {
  toResponse(entity: EmailCampaignEntity): EmailCampaignResponse {
    const steps = [...(entity.steps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );

    return {
      id: entity.id,
      publicCampaignId: entity.campaignPublicId,
      name: entity.name,
      goal: entity.goal,
      status: entity.status,
      campaignTypeId: entity.campaignTypeId,
      brandId: entity.brandId,
      regionId: entity.regionId,
      customFieldValues: entity.customFieldValues ?? {},
      audienceListType: entity.audienceListType,
      audienceListId: entity.audienceListId,
      audienceCount: entity.audienceCount,
      launchAt: entity.launchAt?.toISOString() ?? null,
      dailyBatchSize: entity.dailyBatchSize,
      sendingWindowStartMinutes: entity.sendingWindowStartMinutes,
      sendingWindowEndMinutes: entity.sendingWindowEndMinutes,
      timezone: entity.timezone,
      activeWeekdays: resolveActiveWeekdays(entity.activeWeekdays),
      estimatedEndAt: entity.estimatedEndAt?.toISOString() ?? null,
      scheduledAt: entity.scheduledAt?.toISOString() ?? null,
      pausedUntil: entity.pausedUntil?.toISOString() ?? null,
      statusBeforePause: entity.statusBeforePause,
      wizardStepIndex: entity.wizardStepIndex,
      steps: steps.map((step) => this.toStepResponse(step)),
      mailboxSenders: (entity.mailboxSenders ?? []).map((sender) =>
        this.toSenderResponse(sender),
      ),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toStepResponse(
    step: EmailCampaignSequenceStepEntity,
  ): EmailCampaignSequenceStepResponse {
    return {
      id: step.id,
      stepOrder: step.stepOrder,
      subject: step.subject,
      body: step.body,
      delayMode: step.delayMode,
      delayDays: step.delayDays,
      scheduledDate: step.scheduledDate,
      includeSignature: step.includeSignature ?? true,
    };
  }

  private toSenderResponse(
    sender: EmailCampaignMailboxSenderEntity,
  ): EmailCampaignMailboxSenderResponse {
    return {
      id: sender.id,
      mailboxId: sender.mailboxId,
      senderName: sender.senderName,
      senderEmail: sender.senderEmail,
      signature: sender.signature,
      dailySendQuota: sender.dailySendQuota,
      status: sender.status ?? 'active',
      sendsTodayCount: sender.sendsTodayCount,
      sendsTodayDate: sender.sendsTodayDate,
    };
  }
}
