import { BadRequestException } from '@nestjs/common';
import type {
  EmailCampaignStatus,
  EmailCampaignStatusBeforePause,
} from './entities/email-campaign.entity';
import { parsePausedUntil } from './campaign-recipient-action.util';

export function assertPauseCampaignAllowed(status: EmailCampaignStatus): void {
  if (status !== 'scheduled' && status !== 'sending') {
    throw new BadRequestException(
      'Only scheduled or sending campaigns can be paused',
    );
  }
}

export function assertStopCampaignAllowed(status: EmailCampaignStatus): void {
  if (status !== 'scheduled' && status !== 'sending' && status !== 'paused') {
    throw new BadRequestException(
      'Only scheduled, sending, or paused campaigns can be stopped',
    );
  }
}

export function assertResumeCampaignAllowed(status: EmailCampaignStatus): void {
  if (status !== 'paused') {
    throw new BadRequestException('Only paused campaigns can be resumed');
  }
}

export function applyCampaignPause(
  campaign: {
    status: EmailCampaignStatus;
    pausedUntil: Date | null;
    statusBeforePause: EmailCampaignStatusBeforePause | null;
  },
  pausedUntilInput: string,
): void {
  assertPauseCampaignAllowed(campaign.status);

  campaign.statusBeforePause =
    campaign.status as EmailCampaignStatusBeforePause;
  campaign.status = 'paused';
  campaign.pausedUntil = parsePausedUntil(pausedUntilInput);
}

export function applyCampaignPauseManual(campaign: {
  status: EmailCampaignStatus;
  pausedUntil: Date | null;
  statusBeforePause: EmailCampaignStatusBeforePause | null;
}): void {
  assertPauseCampaignAllowed(campaign.status);

  campaign.statusBeforePause =
    campaign.status as EmailCampaignStatusBeforePause;
  campaign.status = 'paused';
  campaign.pausedUntil = null;
}

export function applyCampaignStop(campaign: {
  status: EmailCampaignStatus;
  pausedUntil: Date | null;
  statusBeforePause: EmailCampaignStatusBeforePause | null;
}): void {
  assertStopCampaignAllowed(campaign.status);

  campaign.status = 'stopped';
  campaign.pausedUntil = null;
  campaign.statusBeforePause = null;
}

export function applyCampaignResume(campaign: {
  status: EmailCampaignStatus;
  pausedUntil: Date | null;
  statusBeforePause: EmailCampaignStatusBeforePause | null;
}): void {
  assertResumeCampaignAllowed(campaign.status);

  if (!campaign.statusBeforePause) {
    throw new BadRequestException('Campaign has no status to resume to');
  }

  campaign.status = campaign.statusBeforePause;
  campaign.pausedUntil = null;
  campaign.statusBeforePause = null;
}
