import {
  addActiveDays,
  createDateInTimezone,
  resolveActiveWeekdays,
} from './campaign-schedule.util';

const DEFAULT_MIN_GAP_MINUTES = 1;

function hashSeedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeedToUint32(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits `totalMinutes` into `gapCount` positive gaps (minutes) with a minimum
 * size and pseudo-random weights so consecutive sends feel naturally uneven.
 */
export function generateVariableGapMinutes(
  gapCount: number,
  totalMinutes: number,
  minGapMinutes: number,
  seed: string,
): number[] {
  if (gapCount <= 0) {
    return [];
  }

  const minTotal = gapCount * minGapMinutes;
  if (totalMinutes <= minTotal) {
    const evenGap = totalMinutes / gapCount;
    return Array.from({ length: gapCount }, () => evenGap);
  }

  const random = createSeededRandom(seed);
  const extraMinutes = totalMinutes - minTotal;
  const weights = Array.from({ length: gapCount }, () => random() + 0.05);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map(
    (weight) => minGapMinutes + (weight / weightSum) * extraMinutes,
  );
}

export function computeSendSlotMinutesFromMidnight(
  positionInDay: number,
  sendsOnDay: number,
  windowStartMinutes: number,
  windowEndMinutes: number,
  spacingSeed: string,
): number {
  if (sendsOnDay <= 0) {
    return windowStartMinutes;
  }

  if (positionInDay <= 0) {
    return windowStartMinutes;
  }

  const windowMinutes = Math.max(0, windowEndMinutes - windowStartMinutes - 1);
  const gaps = generateVariableGapMinutes(
    sendsOnDay - 1,
    windowMinutes,
    DEFAULT_MIN_GAP_MINUTES,
    spacingSeed,
  );

  let offsetMinutes = 0;
  for (let index = 0; index < positionInDay; index += 1) {
    offsetMinutes += gaps[index] ?? 0;
  }

  return windowStartMinutes + offsetMinutes;
}

export function computeInitialNextSendAt(
  recipientIndex: number,
  totalRecipients: number,
  dailyBatchSize: number,
  launchDateKey: string,
  windowStartMinutes: number,
  windowEndMinutes: number,
  timezone: string,
  activeWeekdaysInput: readonly (number | string)[] | null | undefined,
  campaignId: string,
  spacingScope = 'initial',
): Date {
  const activeWeekdays = resolveActiveWeekdays(activeWeekdaysInput);
  const dayIndex = Math.floor(recipientIndex / dailyBatchSize);
  const positionInDay = recipientIndex % dailyBatchSize;
  const recipientsRemaining = totalRecipients - dayIndex * dailyBatchSize;
  const recipientsOnDay = Math.min(dailyBatchSize, recipientsRemaining);

  const sendDateKey = addActiveDays(
    launchDateKey,
    dayIndex,
    activeWeekdays,
    timezone,
  );

  const spacingSeed = `${campaignId}:${sendDateKey}:${spacingScope}`;
  const minutesFromMidnight = computeSendSlotMinutesFromMidnight(
    positionInDay,
    recipientsOnDay,
    windowStartMinutes,
    windowEndMinutes,
    spacingSeed,
  );

  const base = createDateInTimezone(
    sendDateKey,
    Math.min(minutesFromMidnight, windowEndMinutes - 1),
    timezone,
  );

  const extraSeconds = (positionInDay * 13 + dayIndex * 7) % 45;
  return new Date(base.getTime() + extraSeconds * 1000);
}

export function assignInitialNextSendAtToRecipients(
  recipients: Array<{ nextSendAt: Date | null }>,
  launchDateKey: string,
  windowStartMinutes: number,
  windowEndMinutes: number,
  timezone: string,
  dailyBatchSize: number,
  activeWeekdays: readonly (number | string)[] | null | undefined,
  campaignId: string,
): void {
  assignStepNextSendAtToRecipients(
    recipients,
    launchDateKey,
    windowStartMinutes,
    windowEndMinutes,
    timezone,
    dailyBatchSize,
    activeWeekdays,
    campaignId,
    'initial',
  );
}

export function assignStepNextSendAtToRecipients(
  recipients: Array<{ nextSendAt: Date | null }>,
  firstSendDateKey: string,
  windowStartMinutes: number,
  windowEndMinutes: number,
  timezone: string,
  dailyBatchSize: number,
  activeWeekdays: readonly (number | string)[] | null | undefined,
  campaignId: string,
  spacingScope: string,
): void {
  const totalRecipients = recipients.length;

  recipients.forEach((recipient, index) => {
    recipient.nextSendAt = computeInitialNextSendAt(
      index,
      totalRecipients,
      dailyBatchSize,
      firstSendDateKey,
      windowStartMinutes,
      windowEndMinutes,
      timezone,
      activeWeekdays,
      campaignId,
      spacingScope,
    );
  });
}
