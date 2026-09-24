import type { EmailCampaignRecipientStatus } from './entities/email-campaign-recipient.entity';

export interface RecipientStepSnapshot {
  currentStepOrder: number;
  status: EmailCampaignRecipientStatus;
  lastSentAt: Date | null;
}

export function maxStepSent(recipient: RecipientStepSnapshot): number {
  if (recipient.lastSentAt === null) {
    return 0;
  }

  if (recipient.status === 'completed') {
    return recipient.currentStepOrder;
  }

  if (recipient.status === 'active' || recipient.status === 'failed') {
    return Math.max(0, recipient.currentStepOrder - 1);
  }

  return 0;
}

export function computeDaysRunning(launchAt: Date | null, now: Date): number {
  if (!launchAt || now < launchAt) {
    return 0;
  }

  const launchDay = Date.UTC(
    launchAt.getUTCFullYear(),
    launchAt.getUTCMonth(),
    launchAt.getUTCDate(),
  );
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  return Math.max(0, Math.floor((nowDay - launchDay) / (24 * 60 * 60 * 1000)));
}

export function computeTodayPercent(
  launchAt: Date | null,
  estimatedEndAt: Date | null,
  now: Date,
): number | null {
  if (!launchAt || !estimatedEndAt) {
    return null;
  }

  const start = launchAt.getTime();
  const end = estimatedEndAt.getTime();

  if (end <= start) {
    return now.getTime() >= start ? 100 : 0;
  }

  const clampedNow = Math.min(Math.max(now.getTime(), start), end);
  return Math.round(((clampedNow - start) / (end - start)) * 100);
}

export function computePercentComplete(
  completedCount: number,
  totalContacts: number,
): number {
  if (totalContacts <= 0) {
    return 0;
  }

  return Math.round((completedCount / totalContacts) * 100);
}

export function buildFunnelStepLabel(stepOrder: number): string {
  if (stepOrder === 1) {
    return 'Initial Email Sent';
  }

  return `Follow-up ${stepOrder - 1} Sent`;
}

export function computePercentOfTotal(
  count: number,
  totalContacts: number,
): number {
  if (totalContacts <= 0) {
    return 0;
  }

  return Math.round((count / totalContacts) * 100);
}

export const REPLY_BREAKDOWN_DEFINITIONS = [
  { category: 'interested', label: 'Interested' },
  { category: 'not_now', label: 'Not Now' },
  { category: 'no', label: 'No' },
  { category: 'ooo', label: 'OOO' },
  { category: 'wrong_person', label: 'Wrong Person' },
  { category: 'no_reply_yet', label: 'No Reply Yet' },
] as const;

export const DISPOSITION_SUMMARY_DEFINITIONS = [
  {
    disposition: 'excluded',
    label: 'Excluded',
    description: 'Manually excluded from campaign',
  },
  {
    disposition: 'paused',
    label: 'Paused',
    description: 'Temporarily stopped',
  },
  {
    disposition: 'stopped',
    label: 'Stopped',
    description: 'Permanently stopped',
  },
  {
    disposition: 'unsubscribed',
    label: 'Unsubscribed',
    description: 'Opted out',
  },
  {
    disposition: 'done',
    label: 'Done',
    description: 'Sequence completed',
  },
  {
    disposition: 'eligible',
    label: 'Eligible',
    description: 'Not yet contacted',
  },
] as const;
