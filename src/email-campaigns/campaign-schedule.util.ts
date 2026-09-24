interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export const DEFAULT_ACTIVE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const WEEKDAY_LABEL_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getZonedDateParts(date: Date, timezone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour === '24' ? '0' : lookup.hour),
    minute: Number(lookup.minute),
  };
}

export function resolveActiveWeekdays(
  activeWeekdays: readonly (number | string)[] | null | undefined,
): number[] {
  if (!activeWeekdays || activeWeekdays.length === 0) {
    return [...DEFAULT_ACTIVE_WEEKDAYS];
  }

  const normalized = activeWeekdays.map((day) => Number(day));
  return [...new Set(normalized)].sort((left, right) => left - right);
}

export function getCalendarDateKeyInTimezone(
  date: Date,
  timezone: string,
): string {
  const { year, month, day } = getZonedDateParts(date, timezone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getMinutesFromMidnightInTimezone(
  date: Date,
  timezone: string,
): number {
  const { hour, minute } = getZonedDateParts(date, timezone);
  return hour * 60 + minute;
}

export function getWeekdayInTimezone(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(date);

  return WEEKDAY_LABEL_TO_INDEX[weekday] ?? 0;
}

export function isActiveWeekday(
  date: Date,
  activeWeekdays: number[],
  timezone: string,
): boolean {
  const weekday = getWeekdayInTimezone(date, timezone);
  return activeWeekdays.includes(weekday);
}

export function createDateInTimezone(
  dateKey: string,
  minutesFromMidnight: number,
  timezone: string,
): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;

  let candidate = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const parts = getZonedDateParts(new Date(candidate), timezone);
    const desiredTotalMinutes = hour * 60 + minute;
    const actualTotalMinutes = parts.hour * 60 + parts.minute;
    const dayOffset =
      parts.year * 372 +
      parts.month * 31 +
      parts.day -
      (year * 372 + month * 31 + day);
    const diffMinutes =
      dayOffset * 24 * 60 + (actualTotalMinutes - desiredTotalMinutes);

    if (diffMinutes === 0) {
      return new Date(candidate);
    }

    candidate -= diffMinutes * 60 * 1000;
  }

  return new Date(candidate);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addActiveDays(
  startDateKey: string,
  activeDaysToAdd: number,
  activeWeekdays: number[],
  timezone: string,
): string {
  let currentKey = startDateKey;
  let found = 0;

  while (found < activeDaysToAdd) {
    const candidate = createDateInTimezone(currentKey, 0, timezone);
    if (isActiveWeekday(candidate, activeWeekdays, timezone)) {
      found += 1;
      if (found >= activeDaysToAdd) {
        return currentKey;
      }
    }

    currentKey = addDaysToDateKey(currentKey, 1);
  }

  return currentKey;
}

export function advanceToNextActiveWeekday(
  date: Date,
  activeWeekdays: number[],
  timezone: string,
  windowStartMinutes: number,
): Date {
  let currentKey = getCalendarDateKeyInTimezone(date, timezone);

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const candidate = createDateInTimezone(
      currentKey,
      windowStartMinutes,
      timezone,
    );

    if (isActiveWeekday(candidate, activeWeekdays, timezone)) {
      return candidate;
    }

    currentKey = addDaysToDateKey(currentKey, 1);
  }

  return date;
}

export function computeEstimatedEndAt(
  launchDate: string,
  audienceCount: number,
  dailyBatchSize: number,
  windowEndMinutes: number,
  timezone: string,
  activeWeekdays: number[] = [...DEFAULT_ACTIVE_WEEKDAYS],
): Date {
  const daysNeeded = Math.max(1, Math.ceil(audienceCount / dailyBatchSize));
  const resolvedWeekdays = resolveActiveWeekdays(activeWeekdays);
  const endDateKey = addActiveDays(
    launchDate,
    daysNeeded,
    resolvedWeekdays,
    timezone,
  );
  return createDateInTimezone(endDateKey, windowEndMinutes, timezone);
}

export function isLaunchDateValid(
  launchDate: string,
  timezone: string,
  now = new Date(),
): boolean {
  const todayKey = getCalendarDateKeyInTimezone(now, timezone);
  return launchDate >= todayKey;
}

export function isWithinSendingWindow(
  now: Date,
  startMinutes: number,
  endMinutes: number,
  timezone: string,
): boolean {
  const currentMinutes = getMinutesFromMidnightInTimezone(now, timezone);
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function hasLaunchStarted(launchAt: Date, now = new Date()): boolean {
  return now.getTime() >= launchAt.getTime();
}

export function computeNextSendAt(
  from: Date,
  delayDays: number,
  windowStartMinutes: number,
  timezone: string,
  activeWeekdays: number[] = [...DEFAULT_ACTIVE_WEEKDAYS],
): Date {
  const launchDateKey = getCalendarDateKeyInTimezone(from, timezone);
  const nextDateKey = addDaysToDateKey(launchDateKey, delayDays);
  const candidate = createDateInTimezone(
    nextDateKey,
    windowStartMinutes,
    timezone,
  );

  return advanceToNextActiveWeekday(
    candidate,
    resolveActiveWeekdays(activeWeekdays),
    timezone,
    windowStartMinutes,
  );
}

export function computeNextSendAtForStep(
  step: {
    delayMode: 'relative' | 'absolute';
    delayDays: number;
    scheduledDate: string | null;
  },
  from: Date,
  windowStartMinutes: number,
  timezone: string,
  activeWeekdays: number[] = [...DEFAULT_ACTIVE_WEEKDAYS],
): Date {
  if (step.delayMode === 'absolute' && step.scheduledDate) {
    const candidate = createDateInTimezone(
      step.scheduledDate,
      windowStartMinutes,
      timezone,
    );

    return advanceToNextActiveWeekday(
      candidate,
      resolveActiveWeekdays(activeWeekdays),
      timezone,
      windowStartMinutes,
    );
  }

  return computeNextSendAt(
    from,
    step.delayDays,
    windowStartMinutes,
    timezone,
    activeWeekdays,
  );
}
