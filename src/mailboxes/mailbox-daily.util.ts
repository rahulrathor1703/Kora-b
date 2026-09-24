import type { MailboxEntity } from './entities/mailbox.entity';

export function getUtcCalendarDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function applyMailboxDailyReset(
  mailbox: MailboxEntity,
  now: Date,
): void {
  const todayKey = getUtcCalendarDateKey(now);

  if (mailbox.dailySendsDate !== todayKey) {
    mailbox.dailySendsDate = todayKey;
    mailbox.dailySendsUsed = 0;
  }
}

export function getMailboxRemainingCapacity(
  mailbox: MailboxEntity,
  now: Date,
): number {
  applyMailboxDailyReset(mailbox, now);
  return Math.max(0, mailbox.dailySendLimit - mailbox.dailySendsUsed);
}
