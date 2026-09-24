import {
  isDeliveryStatusNotification,
  parseBounceEmail,
} from './bounce-parser.util';
import { CampaignRecipientMapper } from '../mappers/campaign-recipient.mapper';
import type { EmailCampaignMessageEntity } from '../entities/email-campaign-message.entity';
import type { EmailCampaignRecipientEntity } from '../entities/email-campaign-recipient.entity';

describe('bounce-parser.util', () => {
  it('extracts Final-Recipient from a DSN body', () => {
    const parsed = parseBounceEmail({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text: [
        'Final-Recipient: rfc822; failed@example.com',
        'Action: failed',
        'Message-ID: <abc123@mail.gmail.com>',
      ].join('\n'),
    });

    expect(parsed.failedRecipientEmails).toContain('failed@example.com');
    expect(parsed.messageIds).toContain('abc123@mail.gmail.com');
  });

  it('does not scrape arbitrary emails from non-DSN bodies', () => {
    const parsed = parseBounceEmail({
      from: 'mailer-daemon@googlemail.com',
      subject: 'Delivery Status Notification (Failure)',
      text: 'Thanks for your email. Contact support@example.com or user@client.com',
    });

    expect(parsed.failedRecipientEmails).toEqual([]);
  });

  it('detects delivery status notification markers', () => {
    expect(
      isDeliveryStatusNotification('Final-Recipient: rfc822; a@b.com'),
    ).toBe(true);
    expect(isDeliveryStatusNotification('Thanks for your reply')).toBe(false);
  });
});

describe('CampaignRecipientMapper', () => {
  const mapper = new CampaignRecipientMapper();

  function buildRecipient(): EmailCampaignRecipientEntity {
    return {
      id: 'recipient-1',
      campaignId: 'campaign-1',
      email: 'user@example.com',
      mergeFields: {},
      currentStepOrder: 1,
      status: 'failed',
      nextSendAt: null,
      lastSentAt: new Date('2026-08-14T10:00:00Z'),
      replyCategory: null,
      repliedAt: null,
      replySubject: null,
      contactDisposition: 'eligible',
      createdAt: new Date('2026-08-14T09:00:00Z'),
      campaign: {} as never,
    };
  }

  function buildMessage(
    overrides: Partial<EmailCampaignMessageEntity> = {},
  ): EmailCampaignMessageEntity {
    return {
      id: 'message-1',
      campaignId: 'campaign-1',
      recipientId: 'recipient-1',
      stepOrder: 1,
      trackingToken: '00000000-0000-0000-0000-000000000001',
      providerMessageId: '<provider-id@mail.gmail.com>',
      deliveryStatus: 'bounced',
      sentAt: new Date('2026-08-14T10:00:00Z'),
      bouncedAt: new Date('2026-08-14T10:30:00Z'),
      bounceReason: 'Delivery failure',
      openedAt: new Date('2026-08-14T10:05:00Z'),
      openCount: 1,
      clickedAt: null,
      clickCount: 0,
      createdAt: new Date('2026-08-14T10:00:00Z'),
      recipient: {} as never,
      campaign: {} as never,
      ...overrides,
    };
  }

  it('shows opened instead of bounced when engagement proves delivery', () => {
    const response = mapper.toResponse(buildRecipient(), [buildMessage()]);

    expect(response.engagement.status).toBe('opened');
    expect(response.engagement.bounced).toBe(false);
  });

  it('shows replied when repliedAt is set without replyCategory', () => {
    const recipient = buildRecipient();
    recipient.repliedAt = new Date('2026-08-14T11:00:00Z');
    recipient.status = 'active';

    const response = mapper.toResponse(recipient, [
      buildMessage({
        deliveryStatus: 'sent',
        bouncedAt: null,
        bounceReason: null,
      }),
    ]);

    expect(response.engagement.status).toBe('replied');
    expect(response.repliedAt).toBe('2026-08-14T11:00:00.000Z');
  });
});
