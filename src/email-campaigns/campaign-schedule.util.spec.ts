import {
  addActiveDays,
  advanceToNextActiveWeekday,
  computeEstimatedEndAt,
  computeNextSendAt,
  getWeekdayInTimezone,
  isActiveWeekday,
  resolveActiveWeekdays,
} from './campaign-schedule.util';

describe('campaign-schedule.util active weekdays', () => {
  const timezone = 'America/New_York';
  const weekdaysOnly = [1, 2, 3, 4, 5];

  describe('resolveActiveWeekdays', () => {
    it('defaults to all days when empty or missing', () => {
      expect(resolveActiveWeekdays(null)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(resolveActiveWeekdays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('deduplicates and sorts provided weekdays', () => {
      expect(resolveActiveWeekdays([5, 1, 1, 3])).toEqual([1, 3, 5]);
    });

    it('coerces string weekdays from TypeORM simple-array columns', () => {
      expect(resolveActiveWeekdays(['1', '2', '3', '4', '5'])).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });
  });

  describe('getWeekdayInTimezone', () => {
    it('returns Monday for a known Monday in New York', () => {
      const monday = new Date('2026-08-24T14:00:00.000Z');
      expect(getWeekdayInTimezone(monday, timezone)).toBe(1);
    });
  });

  describe('isActiveWeekday', () => {
    it('returns false on weekends when only weekdays are active', () => {
      const saturday = new Date('2026-08-22T14:00:00.000Z');
      expect(isActiveWeekday(saturday, weekdaysOnly, timezone)).toBe(false);
    });

    it('returns true on weekdays when only weekdays are active', () => {
      const monday = new Date('2026-08-24T14:00:00.000Z');
      expect(isActiveWeekday(monday, weekdaysOnly, timezone)).toBe(true);
    });

    it('returns true on weekdays when stored as strings from the database', () => {
      const monday = new Date('2026-08-24T12:33:00.000Z');
      const storedWeekdays = resolveActiveWeekdays(['1', '2', '3', '4', '5']);
      expect(isActiveWeekday(monday, storedWeekdays, 'Asia/Calcutta')).toBe(
        true,
      );
    });
  });

  describe('addActiveDays', () => {
    it('skips inactive days when counting send days', () => {
      const launchDate = '2026-08-21';
      expect(addActiveDays(launchDate, 2, weekdaysOnly, timezone)).toBe(
        '2026-08-24',
      );
    });
  });

  describe('computeEstimatedEndAt', () => {
    it('extends the end date when weekends are inactive', () => {
      const allDaysEnd = computeEstimatedEndAt(
        '2026-08-21',
        100,
        50,
        17 * 60,
        timezone,
        [0, 1, 2, 3, 4, 5, 6],
      );
      const weekdaysEnd = computeEstimatedEndAt(
        '2026-08-21',
        100,
        50,
        17 * 60,
        timezone,
        weekdaysOnly,
      );

      expect(weekdaysEnd.getTime()).toBeGreaterThan(allDaysEnd.getTime());
    });
  });

  describe('advanceToNextActiveWeekday', () => {
    it('moves Saturday follow-ups to Monday', () => {
      const saturday = new Date('2026-08-22T14:00:00.000Z');
      const nextActive = advanceToNextActiveWeekday(
        saturday,
        weekdaysOnly,
        timezone,
        9 * 60,
      );

      expect(getWeekdayInTimezone(nextActive, timezone)).toBe(1);
    });
  });

  describe('computeNextSendAt', () => {
    it('snaps follow-up send time to the next active weekday', () => {
      const friday = new Date('2026-08-21T14:00:00.000Z');
      const nextSendAt = computeNextSendAt(
        friday,
        1,
        9 * 60,
        timezone,
        weekdaysOnly,
      );

      expect(getWeekdayInTimezone(nextSendAt, timezone)).toBe(1);
    });
  });
});
