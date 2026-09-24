import type { EmailCampaignStatus } from './entities/email-campaign.entity';

export const MAILBOX_LOCKING_CAMPAIGN_STATUSES = [
  'scheduled',
  'sending',
] as const satisfies readonly EmailCampaignStatus[];

export type MailboxLockingCampaignStatus =
  (typeof MAILBOX_LOCKING_CAMPAIGN_STATUSES)[number];

export interface MailboxCampaignUsage {
  mailboxId: string;
  campaignId: string;
  campaignName: string;
}

export function isMailboxLockingCampaignStatus(
  status: EmailCampaignStatus,
): status is MailboxLockingCampaignStatus {
  return MAILBOX_LOCKING_CAMPAIGN_STATUSES.includes(
    status as MailboxLockingCampaignStatus,
  );
}

export function buildMailboxConflictMessage(
  mailboxLabel: string,
  campaignName: string,
): string {
  return `"${mailboxLabel}" is already sending from "${campaignName}". Pause, stop, or complete that campaign before using this mailbox.`;
}
