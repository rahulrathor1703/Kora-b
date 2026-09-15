import { BadRequestException } from '@nestjs/common';
import type { EmailCampaignStatus } from './entities/email-campaign.entity';
import type { EmailCampaignMailboxSenderStatus } from './entities/email-campaign-mailbox-sender.entity';

export const LIVE_CAMPAIGN_MAILBOX_STATUSES = [
  'scheduled',
  'sending',
  'paused',
] as const satisfies readonly EmailCampaignStatus[];

export type LiveCampaignMailboxStatus =
  (typeof LIVE_CAMPAIGN_MAILBOX_STATUSES)[number];

export function assertLiveCampaignMailboxActionAllowed(
  status: EmailCampaignStatus,
): void {
  if (
    !LIVE_CAMPAIGN_MAILBOX_STATUSES.includes(
      status as LiveCampaignMailboxStatus,
    )
  ) {
    throw new BadRequestException(
      'Mailbox senders can only be managed while campaign is scheduled, sending, or paused',
    );
  }
}

export function assertPauseMailboxSenderAllowed(
  status: EmailCampaignMailboxSenderStatus,
): void {
  if (status !== 'active') {
    throw new BadRequestException('Only active mailbox senders can be paused');
  }
}

export function assertResumeMailboxSenderAllowed(
  status: EmailCampaignMailboxSenderStatus,
): void {
  if (status !== 'paused') {
    throw new BadRequestException('Only paused mailbox senders can be resumed');
  }
}

export function assertStopMailboxSenderAllowed(
  status: EmailCampaignMailboxSenderStatus,
): void {
  if (status !== 'active' && status !== 'paused') {
    throw new BadRequestException(
      'Only active or paused mailbox senders can be stopped',
    );
  }
}

export function assertMinActiveSendersRemain(
  activeCount: number,
  action: 'pause' | 'stop',
): void {
  if (activeCount <= 1) {
    throw new BadRequestException(
      `Cannot ${action} the last active mailbox sender while campaign is running`,
    );
  }
}

export const CAMPAIGN_RESUME_REQUIRES_MAILBOX_MESSAGE =
  'Cannot resume campaign without an active mailbox sender. Add a mailbox to this campaign before resuming.';

export function assertCampaignResumeHasActiveSenders(
  senders: Array<{ status: EmailCampaignMailboxSenderStatus }>,
  resumePausedMailboxSenders?: boolean,
): void {
  if (senders.length === 0) {
    return;
  }

  const activeCount = countActiveSenders(senders);
  if (activeCount > 0) {
    return;
  }

  const pausedCount = senders.filter(
    (sender) => sender.status === 'paused',
  ).length;
  if (pausedCount > 0) {
    if (resumePausedMailboxSenders) {
      return;
    }

    throw new BadRequestException(
      'Cannot resume campaign without an active mailbox sender. Resume paused mailboxes to continue sending.',
    );
  }

  throw new BadRequestException(CAMPAIGN_RESUME_REQUIRES_MAILBOX_MESSAGE);
}

export function countActiveSenders(
  senders: Array<{ status: EmailCampaignMailboxSenderStatus }>,
): number {
  return senders.filter((sender) => sender.status === 'active').length;
}

export function assertMailboxNotDuplicate(
  senders: Array<{
    id?: string;
    mailboxId: string;
    status: EmailCampaignMailboxSenderStatus;
  }>,
  mailboxId: string,
  excludeSenderId?: string,
): void {
  const duplicate = senders.find(
    (sender) =>
      sender.mailboxId === mailboxId &&
      sender.id !== excludeSenderId &&
      (sender.status === 'active' || sender.status === 'paused'),
  );

  if (duplicate) {
    throw new BadRequestException(
      'This mailbox is already assigned to this campaign',
    );
  }
}
