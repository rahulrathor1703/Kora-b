import { BadRequestException } from '@nestjs/common';
import {
  assertExcludeRecipientGloballyAllowed,
  assertPauseRecipientAllowed,
  assertResumeRecipientAllowed,
  assertStopRecipientAllowed,
} from './campaign-recipient-action.util';
import type { EmailCampaignContactDisposition } from './entities/email-campaign-recipient.entity';

describe('campaign-recipient-action.util', () => {
  describe('assertPauseRecipientAllowed', () => {
    it('allows eligible recipients', () => {
      expect(() => assertPauseRecipientAllowed('eligible')).not.toThrow();
    });

    it('rejects paused recipients', () => {
      expect(() => assertPauseRecipientAllowed('paused')).toThrow(
        BadRequestException,
      );
    });

    it('allows globally excluded eligible recipients to pause in this campaign', () => {
      expect(() => assertPauseRecipientAllowed('eligible')).not.toThrow();
    });
  });

  describe('assertStopRecipientAllowed', () => {
    it('allows eligible and paused recipients', () => {
      expect(() => assertStopRecipientAllowed('eligible')).not.toThrow();
      expect(() => assertStopRecipientAllowed('paused')).not.toThrow();
    });

    it('rejects stopped recipients', () => {
      expect(() => assertStopRecipientAllowed('stopped')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertExcludeRecipientGloballyAllowed', () => {
    it('allows eligible, paused, and stopped recipients', () => {
      const allowed: EmailCampaignContactDisposition[] = [
        'eligible',
        'paused',
        'stopped',
      ];

      for (const disposition of allowed) {
        expect(() =>
          assertExcludeRecipientGloballyAllowed(disposition, false),
        ).not.toThrow();
      }
    });

    it('rejects campaign-excluded recipients', () => {
      expect(() =>
        assertExcludeRecipientGloballyAllowed('excluded', false),
      ).toThrow(BadRequestException);
    });

    it('rejects globally excluded recipients', () => {
      expect(() =>
        assertExcludeRecipientGloballyAllowed('stopped', true),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertResumeRecipientAllowed', () => {
    it('allows manually paused recipients', () => {
      expect(() =>
        assertResumeRecipientAllowed(
          'paused',
          new Date('2026-12-01T00:00:00Z'),
        ),
      ).not.toThrow();
    });

    it('rejects reply-paused recipients without a resume date', () => {
      expect(() => assertResumeRecipientAllowed('paused', null, null)).toThrow(
        BadRequestException,
      );
    });

    it('allows reply-paused recipients', () => {
      expect(() =>
        assertResumeRecipientAllowed(
          'paused',
          null,
          new Date('2026-08-16T12:00:00Z'),
        ),
      ).not.toThrow();
    });
  });
});
