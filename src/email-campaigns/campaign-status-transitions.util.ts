import type { EmailCampaignStatus } from './entities/email-campaign.entity';

export const SYSTEM_MANAGED_CAMPAIGN_STATUSES = [
  'sending',
  'sent',
  'failed',
  'paused',
  'stopped',
] as const satisfies readonly EmailCampaignStatus[];

export type SystemManagedCampaignStatus =
  (typeof SYSTEM_MANAGED_CAMPAIGN_STATUSES)[number];

const MANUAL_STATUS_TRANSITIONS: Partial<
  Record<EmailCampaignStatus, readonly EmailCampaignStatus[]>
> = {
  draft: ['scheduled'],
  scheduled: ['draft'],
};

export function isManualCampaignStatusTransition(
  fromStatus: EmailCampaignStatus,
  toStatus: EmailCampaignStatus,
): boolean {
  if (fromStatus === toStatus) {
    return false;
  }

  const allowedTargets = MANUAL_STATUS_TRANSITIONS[fromStatus];
  return allowedTargets?.includes(toStatus) ?? false;
}

export function getManualCampaignStatusTransitionError(
  fromStatus: EmailCampaignStatus,
  toStatus: EmailCampaignStatus,
): string | null {
  if (fromStatus === toStatus) {
    return null;
  }

  if (isManualCampaignStatusTransition(fromStatus, toStatus)) {
    return null;
  }

  if (
    SYSTEM_MANAGED_CAMPAIGN_STATUSES.includes(
      fromStatus as SystemManagedCampaignStatus,
    ) ||
    SYSTEM_MANAGED_CAMPAIGN_STATUSES.includes(
      toStatus as SystemManagedCampaignStatus,
    )
  ) {
    return 'Sending, Sent, Failed, Paused, and Stopped statuses are updated automatically and cannot be changed manually.';
  }

  return 'This campaign status cannot be changed manually.';
}
