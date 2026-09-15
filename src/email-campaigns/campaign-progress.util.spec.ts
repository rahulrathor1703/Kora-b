import {
  buildFunnelStepLabel,
  computeDaysRunning,
  computePercentComplete,
  computePercentOfTotal,
  computeTodayPercent,
  maxStepSent,
} from './campaign-progress.util';

describe('campaign-progress.util', () => {
  describe('maxStepSent', () => {
    it('returns 0 when no email has been sent', () => {
      expect(
        maxStepSent({
          currentStepOrder: 1,
          status: 'pending',
          lastSentAt: null,
        }),
      ).toBe(0);
    });

    it('returns 1 after initial email when waiting on follow-up', () => {
      expect(
        maxStepSent({
          currentStepOrder: 2,
          status: 'active',
          lastSentAt: new Date('2026-08-14T10:00:00.000Z'),
        }),
      ).toBe(1);
    });

    it('returns final step when sequence is completed', () => {
      expect(
        maxStepSent({
          currentStepOrder: 2,
          status: 'completed',
          lastSentAt: new Date('2026-08-14T10:00:00.000Z'),
        }),
      ).toBe(2);
    });
  });

  describe('computeDaysRunning', () => {
    it('returns 0 before launch', () => {
      const launchAt = new Date('2026-08-20T00:00:00.000Z');
      const now = new Date('2026-08-14T00:00:00.000Z');

      expect(computeDaysRunning(launchAt, now)).toBe(0);
    });

    it('counts whole calendar days since launch', () => {
      const launchAt = new Date('2026-08-07T00:00:00.000Z');
      const now = new Date('2026-08-14T12:00:00.000Z');

      expect(computeDaysRunning(launchAt, now)).toBe(7);
    });
  });

  describe('computeTodayPercent', () => {
    it('returns null when schedule dates are missing', () => {
      expect(computeTodayPercent(null, new Date(), new Date())).toBeNull();
    });

    it('returns position between launch and estimated end', () => {
      const launchAt = new Date('2026-08-01T00:00:00.000Z');
      const estimatedEndAt = new Date('2026-08-11T00:00:00.000Z');
      const now = new Date('2026-08-06T00:00:00.000Z');

      expect(computeTodayPercent(launchAt, estimatedEndAt, now)).toBe(50);
    });
  });

  describe('computePercentComplete', () => {
    it('returns 0 when there are no contacts', () => {
      expect(computePercentComplete(0, 0)).toBe(0);
    });

    it('rounds completed percentage', () => {
      expect(computePercentComplete(2, 8)).toBe(25);
    });
  });

  describe('buildFunnelStepLabel', () => {
    it('labels initial and follow-up steps', () => {
      expect(buildFunnelStepLabel(1)).toBe('Initial Email Sent');
      expect(buildFunnelStepLabel(3)).toBe('Follow-up 2 Sent');
    });
  });

  describe('computePercentOfTotal', () => {
    it('returns 0 when total is zero', () => {
      expect(computePercentOfTotal(3, 0)).toBe(0);
    });
  });
});
