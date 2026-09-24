import { ReplyMonitorService } from './reply-monitor.service';
import type { EmailCampaignMessageEntity } from '../entities/email-campaign-message.entity';
import type { EmailCampaignRecipientEntity } from '../entities/email-campaign-recipient.entity';

describe('ReplyMonitorService.backfillInferredOpens', () => {
  function buildService(overrides?: {
    messages?: EmailCampaignMessageEntity[];
  }) {
    const messages = overrides?.messages ?? [];
    const messagesRepository = {
      findSentWithRepliedRecipientButNoOpen: jest
        .fn()
        .mockResolvedValue(messages),
    };
    const campaignEventService = {
      recordOpen: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ReplyMonitorService(
      {} as never,
      messagesRepository as never,
      {} as never,
      {} as never,
      campaignEventService as never,
      {} as never,
      { backfillIfNeeded: jest.fn().mockResolvedValue(0) } as never,
      {} as never,
    );

    return { service, campaignEventService, messagesRepository };
  }

  function buildMessage(
    overrides: Partial<EmailCampaignMessageEntity> & {
      recipient: EmailCampaignRecipientEntity;
    },
  ): EmailCampaignMessageEntity {
    return {
      id: 'message-1',
      campaignId: 'campaign-1',
      recipientId: 'recipient-1',
      stepOrder: 1,
      trackingToken: 'token',
      providerMessageId: null,
      deliveryStatus: 'sent',
      sentAt: new Date('2026-08-21T10:00:00Z'),
      bouncedAt: null,
      bounceReason: null,
      openedAt: null,
      openCount: 0,
      clickedAt: null,
      clickCount: 0,
      createdAt: new Date('2026-08-21T10:00:00Z'),
      campaign: {} as never,
      ...overrides,
    };
  }

  it('records an inferred open for replied recipients without open tracking', async () => {
    const repliedAt = new Date('2026-08-21T11:00:00Z');
    const recipient = {
      id: 'recipient-1',
      repliedAt,
    } as EmailCampaignRecipientEntity;
    const message = buildMessage({ recipient });

    const { service, campaignEventService } = buildService({
      messages: [message],
    });

    const opensInferred = await service.backfillInferredOpens();

    expect(opensInferred).toBe(1);
    expect(campaignEventService.recordOpen).toHaveBeenCalledWith(
      message,
      repliedAt,
      { metadata: { source: 'inferred_from_reply' } },
    );
  });

  it('skips messages that already have open counts', async () => {
    const recipient = {
      id: 'recipient-1',
      repliedAt: new Date('2026-08-21T11:00:00Z'),
    } as EmailCampaignRecipientEntity;
    const message = buildMessage({ recipient, openCount: 2 });

    const { service, campaignEventService } = buildService({
      messages: [message],
    });

    const opensInferred = await service.backfillInferredOpens();

    expect(opensInferred).toBe(0);
    expect(campaignEventService.recordOpen).not.toHaveBeenCalled();
  });
});
