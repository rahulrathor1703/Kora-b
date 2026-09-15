import { CampaignMessageCorrelationService } from './campaign-message-correlation.service';
import type { EmailCampaignMessageEntity } from './entities/email-campaign-message.entity';

describe('CampaignMessageCorrelationService', () => {
  function buildMessage(
    overrides: Partial<EmailCampaignMessageEntity> = {},
  ): EmailCampaignMessageEntity {
    return {
      id: 'message-1',
      campaignId: 'campaign-1',
      recipientId: 'recipient-1',
      stepOrder: 1,
      mailboxId: null,
      sentSubject: null,
      trackingToken: '00000000-0000-0000-0000-000000000001',
      providerMessageId: null,
      deliveryStatus: 'sent',
      sentAt: new Date('2026-09-07T07:39:00.000Z'),
      bouncedAt: null,
      bounceReason: null,
      openedAt: null,
      openCount: 0,
      clickedAt: null,
      clickCount: 0,
      trackedLinks: [],
      createdAt: new Date('2026-09-07T07:39:00.000Z'),
      recipient: {} as never,
      campaign: {} as never,
      ...overrides,
    };
  }

  it('matches replies by sender email when mailbox metadata is missing', async () => {
    const message = buildMessage({
      mailboxId: null,
      sentSubject: 'Quick question',
    });
    const messagesRepository = {
      findByTrackingToken: jest.fn().mockResolvedValue(null),
      findByProviderMessageId: jest.fn().mockResolvedValue(null),
      findScopedSentMessages: jest.fn().mockResolvedValue([]),
      findRecentSentByRecipientEmailInOrganization: jest
        .fn()
        .mockResolvedValue([message]),
    };
    const service = new CampaignMessageCorrelationService(
      messagesRepository as never,
    );

    const match = await service.matchReplyMessage({
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      rawText: 'Thanks for reaching out.',
      providerMessageIds: [],
      senderEmail: 'prospect@example.com',
      subject: 'Re: Quick question',
      since: new Date('2026-09-01T00:00:00.000Z'),
    });

    expect(match).toEqual({ message, method: 'imap_fallback' });
    expect(
      messagesRepository.findRecentSentByRecipientEmailInOrganization,
    ).toHaveBeenCalledWith(
      'org-1',
      'prospect@example.com',
      new Date('2026-09-01T00:00:00.000Z'),
    );
  });

  it('prefers messages sent from the polling mailbox when multiple candidates exist', async () => {
    const olderMessage = buildMessage({
      id: 'message-old',
      mailboxId: 'mailbox-other',
      sentSubject: 'Older outreach',
    });
    const matchingMailboxMessage = buildMessage({
      id: 'message-new',
      mailboxId: 'mailbox-1',
      sentSubject: 'Quick question',
    });
    const messagesRepository = {
      findByTrackingToken: jest.fn().mockResolvedValue(null),
      findByProviderMessageId: jest.fn().mockResolvedValue(null),
      findScopedSentMessages: jest.fn().mockResolvedValue([]),
      findRecentSentByRecipientEmailInOrganization: jest
        .fn()
        .mockResolvedValue([olderMessage, matchingMailboxMessage]),
    };
    const service = new CampaignMessageCorrelationService(
      messagesRepository as never,
    );

    const match = await service.matchReplyMessage({
      organizationId: 'org-1',
      mailboxId: 'mailbox-1',
      rawText: 'Sounds good.',
      providerMessageIds: [],
      senderEmail: 'prospect@example.com',
      subject: 'Re: Quick question',
      since: new Date('2026-09-01T00:00:00.000Z'),
    });

    expect(match?.message.id).toBe('message-new');
  });
});
