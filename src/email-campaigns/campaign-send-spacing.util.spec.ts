import {
  assignStepNextSendAtToRecipients,
  computeInitialNextSendAt,
  computeSendSlotMinutesFromMidnight,
  generateVariableGapMinutes,
} from './campaign-send-spacing.util';
import { getMinutesFromMidnightInTimezone } from './campaign-schedule.util';

describe('campaign-send-spacing.util', () => {
  it('generates gaps that sum to the sending window', () => {
    const gaps = generateVariableGapMinutes(9, 180, 1, 'campaign:2026-09-01');
    expect(gaps).toHaveLength(9);
    const total = gaps.reduce((sum, gap) => sum + gap, 0);
    expect(total).toBeCloseTo(180, 5);
    expect(gaps.every((gap) => gap >= 1)).toBe(true);
  });

  it('produces different gaps for different days with the same campaign seed root', () => {
    const dayOne = generateVariableGapMinutes(4, 120, 1, 'campaign:2026-09-01');
    const dayTwo = generateVariableGapMinutes(4, 120, 1, 'campaign:2026-09-02');
    expect(dayOne).not.toEqual(dayTwo);
  });

  it('spaces ten sends across a three-hour window', () => {
    const windowStart = 9 * 60;
    const windowEnd = 12 * 60;
    const slots = Array.from({ length: 10 }, (_, position) =>
      computeSendSlotMinutesFromMidnight(
        position,
        10,
        windowStart,
        windowEnd,
        'campaign:2026-09-01',
      ),
    );

    expect(slots[0]).toBe(windowStart);
    expect(slots[9]).toBeLessThanOrEqual(windowEnd - 1);
    for (let index = 1; index < slots.length; index += 1) {
      expect(slots[index]).toBeGreaterThan(slots[index - 1]);
    }
  });

  it('assigns later days using active weekdays and launch date', () => {
    const timezone = 'UTC';
    const first = computeInitialNextSendAt(
      0,
      12,
      5,
      '2026-09-01',
      9 * 60,
      17 * 60,
      timezone,
      [1, 2, 3, 4, 5],
      'campaign-1',
    );
    const sixth = computeInitialNextSendAt(
      5,
      12,
      5,
      '2026-09-01',
      9 * 60,
      17 * 60,
      timezone,
      [1, 2, 3, 4, 5],
      'campaign-1',
    );

    expect(getMinutesFromMidnightInTimezone(first, timezone)).toBe(9 * 60);
    expect(getMinutesFromMidnightInTimezone(sixth, timezone)).toBe(9 * 60);
    expect(sixth.getTime()).toBeGreaterThan(first.getTime());
  });

  it('spreads follow-up recipients across the due-day window', () => {
    const timezone = 'UTC';
    const cohort: Array<{ nextSendAt: Date | null }> = [
      { nextSendAt: null },
      { nextSendAt: null },
      { nextSendAt: null },
    ];

    assignStepNextSendAtToRecipients(
      cohort,
      '2026-09-10',
      9 * 60,
      12 * 60,
      timezone,
      50,
      [1, 2, 3, 4, 5],
      'campaign-1',
      'step-2',
    );

    const times = cohort.map((recipient) => {
      if (recipient.nextSendAt === null) {
        throw new Error('expected nextSendAt to be assigned');
      }

      return recipient.nextSendAt.getTime();
    });
    expect(new Set(times).size).toBe(3);
    expect(times[0]).toBeLessThan(times[1]);
    expect(times[1]).toBeLessThan(times[2]);
  });
});
