import { BadRequestException } from '@nestjs/common';
import type { EmailCampaignContactDisposition } from './entities/email-campaign-recipient.entity';

const BLOCKED_DISPOSITIONS: EmailCampaignContactDisposition[] = [
  'done',
  'unsubscribed',
];

const EXCLUDE_GLOBALLY_DISPOSITIONS: EmailCampaignContactDisposition[] = [
  'eligible',
  'paused',
  'stopped',
];

export function assertRecipientActionAllowed(
  disposition: EmailCampaignContactDisposition,
): void {
  if (disposition === 'done') {
    throw new BadRequestException(
      'Cannot modify a recipient who completed the sequence',
    );
  }

  if (disposition === 'unsubscribed') {
    throw new BadRequestException('Cannot modify an unsubscribed recipient');
  }
}

export function assertPauseRecipientAllowed(
  disposition: EmailCampaignContactDisposition,
): void {
  assertRecipientActionAllowed(disposition);

  if (disposition !== 'eligible') {
    throw new BadRequestException('Only active recipients can be paused');
  }
}

export function assertStopRecipientAllowed(
  disposition: EmailCampaignContactDisposition,
): void {
  assertRecipientActionAllowed(disposition);

  if (disposition !== 'eligible' && disposition !== 'paused') {
    throw new BadRequestException(
      'Only active or paused recipients can be stopped',
    );
  }
}

export function assertExcludeRecipientGloballyAllowed(
  disposition: EmailCampaignContactDisposition,
  globallyExcluded: boolean,
): void {
  assertRecipientActionAllowed(disposition);

  if (globallyExcluded) {
    throw new BadRequestException(
      'This email is already on the organization exclusion list',
    );
  }

  if (!EXCLUDE_GLOBALLY_DISPOSITIONS.includes(disposition)) {
    throw new BadRequestException('This recipient cannot be globally excluded');
  }
}

export function assertResumeRecipientAllowed(
  disposition: EmailCampaignContactDisposition,
  pausedUntil: Date | null,
  repliedAt: Date | null = null,
): void {
  assertRecipientActionAllowed(disposition);

  if (disposition !== 'paused') {
    throw new BadRequestException('Only paused recipients can be resumed');
  }

  if (pausedUntil === null && repliedAt === null) {
    throw new BadRequestException('This recipient is not paused');
  }
}

export function applyManualPauseResume(recipient: {
  contactDisposition: EmailCampaignContactDisposition;
  pausedUntil: Date | null;
  repliedAt: Date | null;
  allowSendDespiteReply: boolean;
}): void {
  recipient.contactDisposition = 'eligible';
  recipient.pausedUntil = null;

  if (recipient.repliedAt !== null) {
    recipient.allowSendDespiteReply = true;
  }
}

export function parsePausedUntil(pausedUntil: string): Date {
  const parsed = new Date(pausedUntil);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('pausedUntil must be a valid ISO date');
  }

  if (parsed.getTime() <= Date.now()) {
    throw new BadRequestException('pausedUntil must be in the future');
  }

  return parsed;
}

export function isBlockedDisposition(
  disposition: EmailCampaignContactDisposition,
): boolean {
  return BLOCKED_DISPOSITIONS.includes(disposition);
}
